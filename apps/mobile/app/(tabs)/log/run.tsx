/**
 * apps/mobile/app/(tabs)/log/run.tsx — the single-screen run/erg/conditioning ledger (RUN-01..05)
 *
 * One scrollable, keyboard-safe ledger card (04-UI-SPEC.md section 7): an activity segmented
 * control (RUN/ERG/CONDITIONING), a DISTANCE field that hides for CONDITIONING (D-16), the
 * DURATION hero field (the only required field, smart h:mm:ss digit entry via
 * `parseDurationDigits`, D-11), an optional AVG HR field, a live pace readout (D-12, hidden
 * for CONDITIONING), a date row defaulting to TODAY with a native date sheet capped at today
 * (D-13), and an optional note field (RUN-05). Saving calls `saveRun` (lib/runEntry.ts) then
 * navigates to `/session/finish` with the new workoutId.
 *
 * Validation is clamp-and-warn, never block (D-15): Save is disabled only when `durationS`
 * is 0 — the single required field. Distance/HR stay in raw local-text state (not reformatted
 * on every keystroke) so a typed "6.2" never gets stomped mid-entry, matching `SetRow.tsx`'s
 * established tap-to-type convention for this app.
 *
 * Security (T-04-09): raw errors are console.error'd for diagnostics only; the user sees the
 * exact UI-SPEC generic message.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { db } from '@apsis/db';
import {
  formatPaceMinSec,
  miToKmExact,
  paceSecPerKmToSecPerMi,
  parseDurationDigits,
  type Units,
} from '@apsis/shared';

import Colors from '@/constants/Colors';
import {
  DISABLED_OPACITY,
  HIT_TARGET_MIN,
  Kicker,
  Radius,
  Spacing,
  Typography,
  tabularNums,
} from '@/constants/theme';
import { fetchProfileSummary } from '@/lib/commitSet';
import { dateToLocalDateStr, todayLocalDate } from '@/lib/localDate';
import { saveRun, type RunEntryInput } from '@/lib/runEntry';
import { computePaceSecPerKm, type RunActivityType } from '@/lib/runEntryLogic';

const SAVE_ERROR_MESSAGE = "Couldn't save that run. Nothing was lost — try again.";
const MIN_PLAUSIBLE_PACE_SEC_PER_KM = 150; // 2:30/km (D-15)
const MAX_PLAUSIBLE_HR = 220; // D-15

const ACTIVITY_OPTIONS: { value: RunActivityType; label: string }[] = [
  { value: 'run', label: 'RUN' },
  { value: 'erg', label: 'ERG' },
  { value: 'conditioning', label: 'CONDITIONING' },
];

function distanceCaption(activityType: RunActivityType, units: Units): string {
  if (activityType === 'erg') return 'DISTANCE (M)';
  return units === 'imperial' ? 'DISTANCE (MI)' : 'DISTANCE (KM)';
}

/** Parses the raw distance text (in whatever unit the caption currently shows) into metric
 * meters for storage/engine input — never ad hoc: km/mi conversion goes through @apsis/shared. */
function toDistanceM(text: string, activityType: RunActivityType, units: Units): number | undefined {
  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  if (activityType === 'erg') return parsed;
  const km = units === 'imperial' ? miToKmExact(parsed) : parsed;
  return km * 1000;
}

/** ERG's /500m split — distinct from RUN/MI's /km or /mi pace domain (Pitfall 6: display-only
 * here, never fed into IF resolution for erg — that gating lives in runEntryLogic.ts). */
function paceSecPer500m(distanceM: number | undefined, durationS: number): number | undefined {
  if (distanceM == null || distanceM <= 0 || durationS <= 0) return undefined;
  return durationS / (distanceM / 500);
}

export default function RunEntryScreen(): React.JSX.Element {
  const router = useRouter();

  const [activityType, setActivityType] = useState<RunActivityType>('run');
  const [distanceText, setDistanceText] = useState('');
  const [durationS, setDurationS] = useState(0);
  const [durationDisplay, setDurationDisplay] = useState('');
  const [hrText, setHrText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [units, setUnits] = useState<Units>('metric');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile units (for the DISTANCE caption + pace display unit, ONB-04) are read once on
  // mount — a fresh screen each time this route is pushed, so no focus-gating is needed here
  // (unlike session.tsx's stacked-screen rehydrate concern).
  useEffect(() => {
    let cancelled = false;
    fetchProfileSummary(db)
      .then((profile) => {
        if (!cancelled) setUnits(profile.units);
      })
      .catch((err: unknown) => console.error('[Apsis] Failed to load profile units:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const localDate = useMemo(() => dateToLocalDateStr(selectedDate), [selectedDate]);
  const isToday = localDate === todayLocalDate();
  const dateLabel = isToday
    ? 'TODAY'
    : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  const distanceM = useMemo(
    () => (activityType === 'conditioning' ? undefined : toDistanceM(distanceText, activityType, units)),
    [distanceText, activityType, units]
  );
  const avgHr = useMemo(() => {
    const parsed = Number.parseInt(hrText, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [hrText]);

  const paceSecPerKm = useMemo(() => computePaceSecPerKm(distanceM, durationS), [distanceM, durationS]);
  const paceSec500 = useMemo(() => paceSecPer500m(distanceM, durationS), [distanceM, durationS]);

  const paceDisplay = useMemo(() => {
    if (activityType === 'conditioning') return null;
    if (activityType === 'erg') {
      return paceSec500 == null ? null : `${formatPaceMinSec(paceSec500)} /500M`;
    }
    if (paceSecPerKm == null) return null;
    const displaySec = units === 'imperial' ? paceSecPerKmToSecPerMi(paceSecPerKm) : paceSecPerKm;
    return `${formatPaceMinSec(displaySec)} /${units === 'imperial' ? 'MI' : 'KM'}`;
  }, [activityType, paceSec500, paceSecPerKm, units]);

  // D-15 clamp-and-warn: non-blocking inline notices only, never disable Save for these.
  const paceWarning =
    activityType === 'run' && paceSecPerKm != null && paceSecPerKm < MIN_PLAUSIBLE_PACE_SEC_PER_KM
      ? 'That pace looks unusually fast — double-check the distance and duration.'
      : null;
  const hrWarning =
    avgHr != null && avgHr > MAX_PLAUSIBLE_HR
      ? 'That heart rate looks unusually high — double-check the number.'
      : null;

  const saveDisabled = saving || durationS === 0;

  function handleDurationChange(text: string): void {
    const parsed = parseDurationDigits(text);
    setDurationS(parsed.totalSeconds);
    setDurationDisplay(parsed.display);
  }

  function handleDateChange(event: DateTimePickerEvent, date?: Date): void {
    if (Platform.OS === 'android') {
      // Android's dialog is self-dismissing; unmount on every change (set or dismissed)
      // so a subsequent tap remounts a fresh dialog instead of reopening a stale one.
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed' || !date) return;
    setSelectedDate(date);
    if (Platform.OS === 'ios' && event.type === 'set') {
      setShowDatePicker(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (saveDisabled) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const input: RunEntryInput = {
        activityType,
        distanceM,
        durationS,
        avgHr,
        note: noteText.trim() ? noteText.trim() : undefined,
        localDate,
      };
      const workoutId = await saveRun(db, input);
      router.push({ pathname: '/session/finish', params: { workoutId } });
    } catch (err: unknown) {
      console.error('[Apsis] Failed to save run:', err);
      setErrorMessage(SAVE_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => Keyboard.dismiss()} accessible={false}>
            <View style={styles.card}>
              {/* 1. Activity segmented control (bone active fill — same-screen volt Save CTA). */}
              <View style={styles.segmentedTrack}>
                {ACTIVITY_OPTIONS.map((option) => {
                  const active = option.value === activityType;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setActivityType(option.value)}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected: active }}
                      style={[styles.segment, active && styles.segmentActive]}>
                      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 2. DISTANCE — hidden entirely for CONDITIONING (D-16). */}
              {activityType !== 'conditioning' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.kicker}>{distanceCaption(activityType, units)}</Text>
                  <TextInput
                    value={distanceText}
                    onChangeText={(text) => setDistanceText(text.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={Colors.dark.mutedText}
                    keyboardType="decimal-pad"
                    style={styles.valueField}
                    accessibilityLabel="Distance"
                  />
                </View>
              ) : null}

              {/* 3. DURATION — the only required field; smart right-to-left h:mm:ss entry (D-11). */}
              <View style={styles.fieldGroup}>
                <Text style={styles.kicker}>DURATION</Text>
                <TextInput
                  value={durationDisplay}
                  onChangeText={handleDurationChange}
                  placeholder="0:00"
                  placeholderTextColor={Colors.dark.mutedText}
                  keyboardType="number-pad"
                  style={styles.durationField}
                  accessibilityLabel="Duration"
                />
              </View>

              {/* 4. AVG HR — optional. */}
              <View style={styles.fieldGroup}>
                <Text style={styles.kicker}>AVG HR (BPM)</Text>
                <TextInput
                  value={hrText}
                  onChangeText={(text) => setHrText(text.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={Colors.dark.mutedText}
                  keyboardType="number-pad"
                  style={styles.valueField}
                  accessibilityLabel="Average heart rate"
                />
              </View>
              {hrWarning ? <Text style={styles.warningLabel}>{hrWarning}</Text> : null}

              {/* 5. Live pace readout (D-12) — hidden for CONDITIONING. */}
              {paceDisplay ? (
                <View style={styles.paceRow}>
                  <Text style={styles.paceValue}>{paceDisplay}</Text>
                  <Text style={styles.paceLabel}>PACE</Text>
                </View>
              ) : null}
              {paceWarning ? <Text style={styles.warningLabel}>{paceWarning}</Text> : null}

              {/* 6. Date row (D-13) — quiet mono TODAY, tap opens the native date sheet. */}
              <Pressable
                onPress={() => setShowDatePicker((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel="Session date"
                style={styles.dateRow}>
                <Text style={styles.dateLabel}>{dateLabel}</Text>
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={handleDateChange}
                />
              ) : null}

              {/* 7. Note field (optional, RUN-05). */}
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="ADD NOTE"
                placeholderTextColor={Colors.dark.mutedText}
                multiline
                numberOfLines={1}
                style={styles.noteField}
                accessibilityLabel="Note"
              />
            </View>
          </Pressable>

          {errorMessage ? <Text style={styles.errorLabel}>{errorMessage}</Text> : null}
        </ScrollView>

        {/* 8. Primary CTA — pinned bottom, volt fill (D-15: disabled only when duration is 0). */}
        <Pressable
          onPress={handleSave}
          disabled={saveDisabled}
          accessibilityRole="button"
          accessibilityLabel="Save Run"
          accessibilityState={{ disabled: saveDisabled }}
          style={({ pressed }) => [
            styles.button,
            saveDisabled && styles.buttonDisabled,
            pressed && !saveDisabled && styles.buttonPressed,
          ]}>
          <Text style={[styles.buttonLabel, saveDisabled && styles.buttonLabelDisabled]}>Save Run</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  segmentedTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.steel,
    borderRadius: Radius.sm,
    padding: 2,
    minHeight: HIT_TARGET_MIN,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  segmentActive: {
    backgroundColor: Colors.dark.text, // bone — same-screen volt Save CTA (segmented-control convention)
  },
  segmentLabel: {
    ...Kicker,
    color: Colors.dark.mutedText,
  },
  segmentLabelActive: {
    color: Colors.dark.background, // void text on bone fill
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  kicker: {
    ...Kicker,
    color: Colors.dark.mutedText,
  },
  valueField: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 18,
    color: Colors.dark.text,
    textAlign: 'center',
    ...tabularNums,
  },
  durationField: {
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 28,
    color: Colors.dark.text,
    textAlign: 'center',
    ...tabularNums,
  },
  paceRow: {
    alignItems: 'center',
    gap: 2,
  },
  paceValue: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 20,
    color: Colors.dark.text,
    ...tabularNums,
  },
  paceLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: Colors.dark.mutedText,
  },
  dateRow: {
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: {
    ...Kicker,
    color: Colors.dark.mutedText,
  },
  noteField: {
    ...Typography.body,
    minHeight: HIT_TARGET_MIN,
    maxHeight: HIT_TARGET_MIN * 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    color: Colors.dark.text,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    textAlignVertical: 'top',
  },
  warningLabel: {
    ...Typography.label,
    color: Colors.dark.warning,
  },
  errorLabel: {
    ...Typography.label,
    color: Colors.dark.destructive,
    marginTop: Spacing.md,
  },
  button: {
    minHeight: 48,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: Colors.dark.steel,
    opacity: DISABLED_OPACITY,
  },
  buttonPressed: {
    backgroundColor: Colors.dark.accentPressed,
  },
  buttonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
  buttonLabelDisabled: {
    color: Colors.dark.mutedText,
  },
});
