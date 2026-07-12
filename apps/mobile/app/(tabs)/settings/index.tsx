/**
 * apps/mobile/app/(tabs)/settings/index.tsx — Settings tab (D-32, ONB-02, ONB-04)
 *
 * Scope is intentionally narrow (D-32): a profile editor reusing the onboarding
 * ProfileReview pattern (D-04), a units toggle, the global default rest-timer duration
 * (feeds Plan 07's rest timer), and an about/version footer. No notification
 * preferences, no data-management/export controls (deferred per 03-CONTEXT.md).
 *
 * Editing pattern: the four review fields (sex, bodyweight, threshold HR, threshold
 * pace) stage locally when a row is tapped — a small modal editor for that one field —
 * then commit together via the "Save Changes" button, mirroring the onboarding review
 * screen's tap-to-edit-then-save shape (D-04). Units and the rest-timer default apply
 * immediately on tap (matching the onboarding units.tsx step's instant-selection feel)
 * since they're single-value toggles, not part of the numeric review batch.
 *
 * Every write goes through useProfile's update() — a parameterized UPDATE against
 * user_profile only. Edits apply to FUTURE calculations only; stored/version-stamped
 * scores (workout.hss, load_daily, per-set stressScore) are never rewritten (D-05,
 * Phase 02 D-06).
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { db } from '@apsis/db';
import { ENGINE_VERSION } from '@apsis/engine';
import type { Sex, Units } from '@apsis/shared';
import {
  kgToDisplayLb,
  lbToKgExact,
  paceSecPerKmToSecPerMi,
  paceSecPerMiToSecPerKm,
} from '@apsis/shared';
import {
  ProfileReview,
  type ProfileReviewField,
  type ProfileReviewValues,
} from '../../../components/onboarding/ProfileReview';
import { useProfile, type ProfileUpdateInput } from '../../../hooks/useProfile';
import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import {
  HAIRLINE_WIDTH,
  HIT_TARGET_MIN,
  Mono,
  Radius,
  Spacing,
  Typography,
  tabularNums,
} from '../../../constants/theme';
import { requestHealthKitAuthorization } from '../../../lib/healthkitAuth';
import { runHealthKitSync } from '../../../lib/healthkitImport';
import { getSyncState, setSyncState } from '../../../lib/healthkitSyncState';

const MIN_PLAUSIBLE_KG = 30;
const MAX_PLAUSIBLE_KG = 250;
const MIN_PLAUSIBLE_HR = 100;
const MAX_PLAUSIBLE_HR = 220;
const MIN_PLAUSIBLE_SEC_PER_KM = 150; // 2:30 /km
const MAX_PLAUSIBLE_SEC_PER_KM = 720; // 12:00 /km

const SEX_OPTIONS: ReadonlyArray<{ value: Sex; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const REST_PRESETS_SEC: ReadonlyArray<number> = [60, 90, 120, 150, 180, 240];

function formatRestLabel(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return seconds === 0 ? `${minutes}:00` : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** D-24: "LAST SYNC {H:MM AM/PM}" mono status line, or the pre-first-sync placeholder. */
function formatHealthKitLastSync(date: Date | null): string {
  if (date == null) return 'LAST SYNC —';
  return `LAST SYNC ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/**
 * WR-02: field editors are seeded with a *rounded display* rendering of the stored
 * metric value. These helpers produce that rendering in one place so the commit
 * handlers can detect "opened but not actually edited" and keep the exact stored
 * value instead of round-tripping the rounded display back to metric (which silently
 * drifts it, e.g. 80 kg -> 176 lb -> 79.83 kg).
 */
function bodyweightDisplayText(kg: number | null, imperial: boolean): string {
  if (kg == null) return '';
  return imperial ? String(kgToDisplayLb(kg)) : String(Math.round(kg));
}

function paceDisplayTexts(secPerKm: number | null, imperial: boolean): { min: string; sec: string } {
  if (secPerKm == null) return { min: '', sec: '' };
  const displaySec = imperial ? paceSecPerKmToSecPerMi(secPerKm) : secPerKm;
  return {
    min: String(Math.floor(displaySec / 60)),
    sec: String(Math.round(displaySec % 60)).padStart(2, '0'),
  };
}

export default function SettingsScreen(): React.JSX.Element {
  const { profile, loading, submitting, errorMessage, loadErrorMessage, reload, update } =
    useProfile();

  const [draft, setDraft] = useState<ProfileReviewValues | null>(null);
  const [editingField, setEditingField] = useState<ProfileReviewField | null>(null);
  const [numericText, setNumericText] = useState('');
  const [paceMinText, setPaceMinText] = useState('');
  const [paceSecText, setPaceSecText] = useState('');
  const [focusedField, setFocusedField] = useState<
    'bodyweight' | 'thresholdHr' | 'paceMin' | 'paceSec' | null
  >(null);

  // D-19/D-21/D-24: HealthKit sync-toggle state, loaded once from the single
  // user_profile row (not part of useProfile's ProfileValues shape).
  const [hkConnected, setHkConnected] = useState(false);
  const [hkLastSyncAt, setHkLastSyncAt] = useState<Date | null>(null);
  const [hkConnecting, setHkConnecting] = useState(false);

  // Seed the local edit draft from the loaded profile row exactly once — subsequent
  // profile updates (e.g. after Save Changes) are applied optimistically to `draft`
  // by the commit handlers, not re-derived here, so an in-progress edit is never
  // clobbered by a background refetch.
  useEffect(() => {
    if (profile != null && draft == null) {
      setDraft({
        sex: profile.sex,
        bodyweightKg: profile.bodyweightKg,
        thresholdHr: profile.thresholdHr,
        thresholdPaceSecPerKm: profile.thresholdPaceSecPerKm,
        units: profile.units,
      });
    }
  }, [profile, draft]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const state = await getSyncState(db);
      if (!cancelled && state != null) {
        setHkConnected(state.healthkitConnected);
        setHkLastSyncAt(state.healthkitLastSyncAt);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // WR-07: a failed profile read must not leave the screen on an indefinite spinner —
  // show the generic error string (never the raw error) with a retry action.
  if (!loading && profile == null && loadErrorMessage != null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadErrorText} accessibilityRole="alert">
            {loadErrorMessage}
          </Text>
          <Pressable
            onPress={() => {
              void reload();
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            style={styles.retryButton}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading || draft == null || profile == null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.dark.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const isImperial = draft.units === 'imperial';

  function openFieldEditor(field: ProfileReviewField): void {
    if (draft == null) return;
    if (field === 'units') {
      // Units is a single-value toggle, applied instantly — same action as the
      // dedicated Units section below, not staged into the batch draft.
      void handleUnitsChange(draft.units === 'imperial' ? 'metric' : 'imperial');
      return;
    }
    setEditingField(field);
    if (field === 'bodyweightKg') {
      setNumericText(bodyweightDisplayText(draft.bodyweightKg, isImperial));
    } else if (field === 'thresholdHr') {
      setNumericText(draft.thresholdHr != null ? String(draft.thresholdHr) : '');
    } else if (field === 'thresholdPaceSecPerKm') {
      const seeded = paceDisplayTexts(draft.thresholdPaceSecPerKm, isImperial);
      setPaceMinText(seeded.min);
      setPaceSecText(seeded.sec);
    }
  }

  function closeFieldEditor(): void {
    setEditingField(null);
  }

  function commitSex(value: Sex): void {
    setDraft((prev) => (prev ? { ...prev, sex: value } : prev));
    setEditingField(null);
  }

  function commitBodyweight(): void {
    // WR-02: if the text still matches the seeded display rendering, the user didn't
    // edit the field — keep the exact stored kg instead of round-tripping the rounded
    // display back to metric (display conversion must be exact-round-trip, D-12).
    const seeded = bodyweightDisplayText(draft?.bodyweightKg ?? null, isImperial);
    if (seeded !== '' && numericText === seeded) {
      setEditingField(null);
      return;
    }
    const parsed = Number(numericText);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const kg = isImperial ? lbToKgExact(parsed) : parsed;
    setDraft((prev) => (prev ? { ...prev, bodyweightKg: kg } : prev));
    setEditingField(null);
  }

  function commitThresholdHr(): void {
    const parsed = Number(numericText);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setDraft((prev) => (prev ? { ...prev, thresholdHr: Math.round(parsed) } : prev));
    setEditingField(null);
  }

  function commitThresholdPace(): void {
    // WR-02: unchanged seeded text -> keep the exact stored sec/km (no display round-trip).
    const seeded = paceDisplayTexts(draft?.thresholdPaceSecPerKm ?? null, isImperial);
    if (seeded.min !== '' && paceMinText === seeded.min && paceSecText === seeded.sec) {
      setEditingField(null);
      return;
    }
    const minVal = Number(paceMinText) || 0;
    const secVal = Number(paceSecText) || 0;
    const totalDisplaySec = minVal * 60 + secVal;
    if (totalDisplaySec <= 0) return;
    const secPerKm = isImperial ? paceSecPerMiToSecPerKm(totalDisplaySec) : totalDisplaySec;
    setDraft((prev) => (prev ? { ...prev, thresholdPaceSecPerKm: secPerKm } : prev));
    setEditingField(null);
  }

  async function handleUnitsChange(next: Units): Promise<void> {
    if (draft == null || draft.units === next) return;
    const previous = draft.units;
    // Optimistic draft update with rollback (WR-02): if the UPDATE fails, the draft
    // must not keep claiming the new units while the DB still holds the old ones.
    setDraft((prev) => (prev ? { ...prev, units: next } : prev));
    const ok = await update({ units: next });
    if (!ok) {
      setDraft((prev) => (prev ? { ...prev, units: previous } : prev));
    }
  }

  async function handleRestPreset(sec: number): Promise<void> {
    await update({ restTimerDefaultSec: sec });
  }

  /** D-03: the permanent re-entry point for onboarding decliners / existing installs. */
  async function handleConnectHealthKit(): Promise<void> {
    if (hkConnecting) return;
    setHkConnecting(true);
    try {
      const granted = await requestHealthKitAuthorization();
      if (granted) {
        await setSyncState(db, { healthkitConnected: true });
        setHkConnected(true);
        // D-22/D-25 fire-and-forget contract, same as onboarding's healthkit.tsx step —
        // never block this screen on the initial 90-day import.
        runHealthKitSync(db, { initial: true }).catch((err: unknown) => {
          console.error('[Apsis] settings initial healthkit sync failed:', err);
        });
      }
    } catch (err: unknown) {
      // D-25: never surface an error dialog here — log only.
      console.error('[Apsis] settings requestHealthKitAuthorization failed:', err);
    } finally {
      setHkConnecting(false);
    }
  }

  /**
   * D-21: the toggle pauses/resumes HK reads/writes — it never removes already-imported
   * sessions. Optimistic-set-then-rollback-on-failure, matching `handleUnitsChange` above.
   */
  async function handleToggleHealthKitSync(next: boolean): Promise<void> {
    const previous = hkConnected;
    setHkConnected(next);
    const ok = await setSyncState(db, { healthkitConnected: next });
    if (!ok) {
      setHkConnected(previous);
    }
  }

  async function handleSaveChanges(): Promise<void> {
    if (draft == null) return;
    const patch: ProfileUpdateInput = {};
    if (draft.sex != null) patch.sex = draft.sex;
    if (draft.bodyweightKg != null) patch.bodyweightKg = draft.bodyweightKg;
    if (draft.thresholdHr != null) patch.thresholdHr = draft.thresholdHr;
    if (draft.thresholdPaceSecPerKm != null) patch.thresholdPaceSecPerKm = draft.thresholdPaceSecPerKm;
    await update(patch);
  }

  const bodyweightParsed = Number(numericText);
  const bodyweightPreviewKg =
    Number.isFinite(bodyweightParsed) && bodyweightParsed > 0
      ? isImperial
        ? lbToKgExact(bodyweightParsed)
        : bodyweightParsed
      : null;
  const bodyweightOutOfRange =
    bodyweightPreviewKg != null && (bodyweightPreviewKg < MIN_PLAUSIBLE_KG || bodyweightPreviewKg > MAX_PLAUSIBLE_KG);

  const thresholdHrParsed = Number(numericText);
  const thresholdHrOutOfRange =
    Number.isFinite(thresholdHrParsed) &&
    thresholdHrParsed > 0 &&
    (thresholdHrParsed < MIN_PLAUSIBLE_HR || thresholdHrParsed > MAX_PLAUSIBLE_HR);

  const paceMinVal = Number(paceMinText) || 0;
  const paceSecVal = Number(paceSecText) || 0;
  const paceTotalDisplaySec = paceMinVal * 60 + paceSecVal;
  const pacePreviewSecPerKm =
    paceTotalDisplaySec > 0 ? (isImperial ? paceSecPerMiToSecPerKm(paceTotalDisplaySec) : paceTotalDisplaySec) : null;
  const paceOutOfRange =
    pacePreviewSecPerKm != null &&
    (pacePreviewSecPerKm < MIN_PLAUSIBLE_SEC_PER_KM || pacePreviewSecPerKm > MAX_PLAUSIBLE_SEC_PER_KM);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // D-19: "connected" (state A -> B) must survive the D-21 toggle being switched OFF —
  // healthkitConnected alone doubles as both "ever connected" and "sync enabled" in the
  // single-bit schema, so a completed prior sync (healthkitLastSyncAt) is also treated as
  // proof of a completed permission sheet even while the toggle is currently paused.
  const hkEverConnected = hkConnected || hkLastSyncAt != null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader kicker="CONFIG" title="Settings" style={styles.screenHeader} />

        <Text style={styles.sectionLabel}>Profile</Text>
        <ProfileReview
          values={draft}
          onEditField={openFieldEditor}
          primaryLabel="Save changes"
          onSubmit={handleSaveChanges}
          submitting={submitting}
          errorMessage={errorMessage}
        />

        <Text style={styles.sectionLabel}>Units</Text>
        <View style={styles.choiceRow}>
          <ChoiceButton label="Metric" sub="km, kg" selected={!isImperial} onPress={() => handleUnitsChange('metric')} />
          <ChoiceButton label="Imperial" sub="mi, lb" selected={isImperial} onPress={() => handleUnitsChange('imperial')} />
        </View>

        <Text style={styles.sectionLabel}>Default Rest Timer</Text>
        <View style={styles.restRow}>
          {REST_PRESETS_SEC.map((sec) => (
            <ChoiceButton
              key={sec}
              label={formatRestLabel(sec)}
              selected={profile.restTimerDefaultSec === sec}
              onPress={() => handleRestPreset(sec)}
              compact
            />
          ))}
        </View>

        <View style={styles.hairlineDivider} />
        <Text style={styles.sectionLabel}>Apple Health</Text>
        {hkEverConnected ? (
          <View style={styles.hkSection}>
            <View style={styles.hkInfoRow}>
              <Text style={styles.hkRowLabel}>Connected</Text>
              <Text style={styles.hkRowSub}>Manage permissions in the Health app.</Text>
            </View>
            <View style={styles.hkToggleRow}>
              <Text style={styles.hkRowLabel}>Sync with Apple Health</Text>
              <Switch
                value={hkConnected}
                onValueChange={handleToggleHealthKitSync}
                trackColor={{ false: Colors.dark.steel, true: Colors.dark.accent }}
                thumbColor={hkConnected ? Colors.dark.background : Colors.dark.text}
                accessibilityLabel="Sync with Apple Health"
              />
            </View>
            <Text style={styles.hkStatusLine}>
              {hkConnected ? formatHealthKitLastSync(hkLastSyncAt) : 'SYNC PAUSED'}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={handleConnectHealthKit}
            disabled={hkConnecting}
            accessibilityRole="button"
            accessibilityLabel="Connect Apple Health"
            accessibilityState={{ disabled: hkConnecting }}
            style={({ pressed }) => [
              styles.hkConnectRow,
              pressed && !hkConnecting && styles.hkConnectRowPressed,
            ]}>
            <Text style={styles.hkRowLabel}>Connect Apple Health</Text>
            <Text style={styles.hkRowSub}>
              Import runs and bodyweight. Your logged sessions go to Health too.
            </Text>
          </Pressable>
        )}
        <View style={styles.hairlineDivider} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Apsis v{appVersion}</Text>
          <Text style={styles.footerText}>Engine v{ENGINE_VERSION}</Text>
        </View>
      </ScrollView>

      <Modal
        visible={editingField != null}
        transparent
        animationType="fade"
        onRequestClose={closeFieldEditor}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {editingField === 'sex' ? (
              <>
                <Text style={styles.modalTitle}>Sex</Text>
                <View style={styles.sexOptions}>
                  {SEX_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => commitSex(opt.value)}
                      accessibilityRole="button"
                      accessibilityLabel={opt.label}
                      accessibilityState={{ selected: draft.sex === opt.value }}
                      style={[styles.sexOption, draft.sex === opt.value && styles.sexOptionSelected]}>
                      <Text
                        style={[
                          styles.sexOptionLabel,
                          draft.sex === opt.value && styles.sexOptionLabelSelected,
                        ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <ModalCancel onPress={closeFieldEditor} />
              </>
            ) : editingField === 'bodyweightKg' ? (
              <>
                <Text style={styles.modalTitle}>Bodyweight</Text>
                <View style={styles.modalInputRow}>
                  <TextInput
                    style={[styles.modalInput, focusedField === 'bodyweight' && styles.modalInputFocused]}
                    value={numericText}
                    onChangeText={(next) => setNumericText(next.replace(/[^0-9.]/g, ''))}
                    onFocus={() => setFocusedField('bodyweight')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.dark.mutedText}
                    autoFocus
                    accessibilityLabel="Bodyweight"
                  />
                  <Text style={styles.modalUnit}>{isImperial ? 'lb' : 'kg'}</Text>
                </View>
                {bodyweightOutOfRange ? (
                  <Text style={styles.modalWarning} accessibilityRole="alert">
                    That looks unusual — are you sure?
                  </Text>
                ) : null}
                <ModalActions onCancel={closeFieldEditor} onSave={commitBodyweight} />
              </>
            ) : editingField === 'thresholdHr' ? (
              <>
                <Text style={styles.modalTitle}>Threshold heart rate</Text>
                <View style={styles.modalInputRow}>
                  <TextInput
                    style={[styles.modalInput, focusedField === 'thresholdHr' && styles.modalInputFocused]}
                    value={numericText}
                    onChangeText={(next) => setNumericText(next.replace(/[^0-9]/g, ''))}
                    onFocus={() => setFocusedField('thresholdHr')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.dark.mutedText}
                    autoFocus
                    accessibilityLabel="Threshold heart rate"
                  />
                  <Text style={styles.modalUnit}>bpm</Text>
                </View>
                {thresholdHrOutOfRange ? (
                  <Text style={styles.modalWarning} accessibilityRole="alert">
                    That looks unusual — are you sure?
                  </Text>
                ) : null}
                <ModalActions onCancel={closeFieldEditor} onSave={commitThresholdHr} />
              </>
            ) : editingField === 'thresholdPaceSecPerKm' ? (
              <>
                <Text style={styles.modalTitle}>Threshold pace</Text>
                <View style={styles.modalInputRow}>
                  <TextInput
                    style={[styles.modalPaceInput, focusedField === 'paceMin' && styles.modalInputFocused]}
                    value={paceMinText}
                    onChangeText={(next) => setPaceMinText(next.replace(/[^0-9]/g, ''))}
                    onFocus={() => setFocusedField('paceMin')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.dark.mutedText}
                    autoFocus
                    accessibilityLabel="Pace minutes"
                  />
                  <Text style={styles.modalColon}>:</Text>
                  <TextInput
                    style={[styles.modalPaceInput, focusedField === 'paceSec' && styles.modalInputFocused]}
                    value={paceSecText}
                    onChangeText={(next) => setPaceSecText(next.replace(/[^0-9]/g, ''))}
                    onFocus={() => setFocusedField('paceSec')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    placeholder="00"
                    placeholderTextColor={Colors.dark.mutedText}
                    accessibilityLabel="Pace seconds"
                  />
                  <Text style={styles.modalUnit}>{isImperial ? '/mi' : '/km'}</Text>
                </View>
                {paceOutOfRange ? (
                  <Text style={styles.modalWarning} accessibilityRole="alert">
                    That looks unusual — are you sure?
                  </Text>
                ) : null}
                <ModalActions onCancel={closeFieldEditor} onSave={commitThresholdPace} />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ChoiceButton({
  label,
  sub,
  selected,
  onPress,
  compact = false,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      accessibilityState={{ selected }}
      style={[
        styles.choiceButton,
        compact && styles.choiceButtonCompact,
        selected && styles.choiceButtonSelected,
      ]}>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
      {sub ? <Text style={[styles.choiceSub, selected && styles.choiceLabelSelected]}>{sub}</Text> : null}
    </Pressable>
  );
}

function ModalActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }): React.JSX.Element {
  return (
    <View style={styles.modalActions}>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        style={[styles.modalActionButton, styles.modalActionGhost]}>
        <Text style={styles.modalActionGhostLabel}>Cancel</Text>
      </Pressable>
      <Pressable
        onPress={onSave}
        accessibilityRole="button"
        accessibilityLabel="Set value"
        style={[styles.modalActionButton, styles.modalActionPrimary]}>
        <Text style={styles.modalActionPrimaryLabel}>Set</Text>
      </Pressable>
    </View>
  );
}

function ModalCancel({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Cancel"
      style={[styles.modalActionButton, styles.modalActionGhost, styles.modalCancelOnly]}>
      <Text style={styles.modalActionGhostLabel}>Cancel</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  loadErrorText: {
    ...Typography.body,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 48,
    minWidth: 120,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  retryLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  screenHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  choiceRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  restRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  choiceButton: {
    flex: 1,
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  choiceButtonCompact: {
    flex: 0,
    minWidth: HIT_TARGET_MIN + 24,
    paddingHorizontal: Spacing.lg,
  },
  // Bone active-fill (not volt): ProfileReview's "Save changes" button above is already
  // the one volt-filled element on this screen (DESIGN-SYSTEM.md §7 one-volt-per-screen rule).
  choiceButtonSelected: {
    borderColor: Colors.dark.text,
    backgroundColor: Colors.dark.text,
  },
  choiceLabel: {
    ...Typography.body,
    ...tabularNums,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  choiceLabelSelected: {
    color: Colors.dark.onAccent,
  },
  choiceSub: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    gap: Spacing.xs,
  },
  footerText: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  hairlineDivider: {
    height: HAIRLINE_WIDTH,
    backgroundColor: Colors.dark.border,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  hkSection: {
    paddingHorizontal: Spacing.lg,
  },
  hkConnectRow: {
    paddingHorizontal: Spacing.lg,
    minHeight: HIT_TARGET_MIN + 12,
    paddingVertical: Spacing.lg,
    borderBottomWidth: HAIRLINE_WIDTH,
    borderBottomColor: Colors.dark.border,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  hkConnectRowPressed: {
    opacity: 0.7,
  },
  hkInfoRow: {
    minHeight: HIT_TARGET_MIN + 12,
    paddingVertical: Spacing.lg,
    borderBottomWidth: HAIRLINE_WIDTH,
    borderBottomColor: Colors.dark.border,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  hkToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: HIT_TARGET_MIN,
    marginTop: Spacing.md,
  },
  hkStatusLine: {
    ...Mono,
    color: Colors.dark.mutedText,
    marginTop: Spacing.sm,
  },
  hkRowLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  hkRowSub: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.surface,
    padding: Spacing.xl,
  },
  modalTitle: {
    ...Typography.heading,
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  modalInput: {
    ...Typography.display,
    ...tabularNums,
    color: Colors.dark.text,
    minWidth: 100,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dark.background,
  },
  modalPaceInput: {
    ...Typography.display,
    ...tabularNums,
    color: Colors.dark.text,
    minWidth: 64,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dark.background,
  },
  modalInputFocused: {
    borderColor: Colors.dark.accent,
  },
  modalColon: {
    ...Typography.display,
    color: Colors.dark.text,
  },
  modalUnit: {
    ...Typography.heading,
    color: Colors.dark.mutedText,
    marginLeft: Spacing.xs,
  },
  modalWarning: {
    ...Typography.label,
    color: Colors.dark.warning,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  sexOptions: {
    gap: Spacing.sm,
  },
  sexOption: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bone active-fill (not volt): this modal's own "Set" action (modalActionPrimary) is
  // already the one volt-filled element in this view (DESIGN-SYSTEM.md §7).
  sexOptionSelected: {
    borderColor: Colors.dark.text,
    backgroundColor: Colors.dark.text,
  },
  sexOptionLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  sexOptionLabelSelected: {
    color: Colors.dark.onAccent,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  modalCancelOnly: {
    marginTop: Spacing.xl,
  },
  modalActionButton: {
    flex: 1,
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionGhost: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
  },
  modalActionGhostLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  modalActionPrimary: {
    backgroundColor: Colors.dark.accent,
  },
  modalActionPrimaryLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
});
