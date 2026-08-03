# Phase 8: Share Card Social Overlay - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 08-share-card-social-overlay
**Areas discussed:** Card content & format, Card visual style, Entry points & flow, Stat privacy & customization, Photo legibility & overlay layout, Photo crop & framing, Permission-denied & edge cases, Card resolution & fidelity

---

## Card content & format

| Option | Description | Selected |
|--------|-------------|----------|
| Square 1080×1080 (Recommended) | Most universal — iMessage, IG feed, X, WhatsApp; one format | ✓ |
| Story 1080×1920 (9:16) | Full-bleed stories format; crops badly in feeds/chats | |
| Both square + story | Best coverage but doubles layout work | |

**User's choice:** Square 1080×1080

| Option | Description | Selected |
|--------|-------------|----------|
| HSS ring + number (Recommended) | Volt ring with big session score — reuses HssRing language, score is the moat | ✓ |
| Big HSS number only | Typography-first, no ring | |
| Stats grid, HSS as peer | All stats equal weight, no focal point | |

**User's choice:** HSS ring + number as hero

| Option | Description | Selected |
|--------|-------------|----------|
| Core trio (Recommended) | Lift: volume/sets/duration; run: distance/pace/duration | ✓ |
| Rich detail | Trio plus exercise names / avg HR — busier, overflow rules needed | |
| HSS only, no stats | Pure score flex, loses context | |

**User's choice:** Core trio

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle footer (Recommended) | Small wordmark + plate-mark corner, mono date + type caption | ✓ |
| Prominent header | Large wordmark — reads more ad than achievement | |
| Watermark only, no metadata | Cleanest but loses what/when context | |

**User's choice:** Subtle footer

---

## Card visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Pure void dark card (Recommended) | Branded void card, zero new deps | (initial mis-click) |
| Photo optional, card default | Card default with add-photo option | |
| Photo-first like Strava | Stats overlay the athlete's photo; needs expo-image-picker (new native dep, 06-06 gate) | ✓ |

**User's choice:** Photo-first like Strava
**Notes:** User initially selected the void card, then corrected on the next question: "also i want user photo first like strava not branded background i hit the wrong option". Chosen with awareness of the new-native-dep / 06-06-gate tradeoff stated in the option description.

| Option | Description | Selected |
|--------|-------------|----------|
| Share edition (Recommended) | Same void/volt/mono language recomposed for 1080px social | ✓ |
| Mirror in-app exactly | Reuse in-app sizing as-is | |
| You decide | Claude's discretion | |

**User's choice:** Share edition

| Option | Description | Selected |
|--------|-------------|----------|
| Void branded card (Recommended) | Photo skip → branded card, same overlay; never blocks | ✓ |
| Require a photo | No photo, no card | |

**User's choice:** Void branded card fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Library pick only (Recommended) | expo-image-picker library flow only | ✓ |
| Library + camera capture | Also take-photo-now via installed expo-camera | |

**User's choice:** Library pick only

---

## Entry points & flow

| Option | Description | Selected |
|--------|-------------|----------|
| Finish + History detail (Recommended) | Share from finish.tsx AND session/detail.tsx | ✓ |
| Finish screen only | Single entry point | |
| History detail only | After-the-fact only | |

**User's choice:** Finish + History detail

| Option | Description | Selected |
|--------|-------------|----------|
| Compose screen w/ preview (Recommended) | Pick/swap photo, live preview, Share → share sheet | ✓ |
| Straight to share sheet | No preview; posting blind | |

**User's choice:** Compose screen with preview

| Option | Description | Selected |
|--------|-------------|----------|
| Secondary bone button (Recommended) | Bone-filled Share button; Done keeps volt | ✓ |
| Icon button in header | Subtle share icon | |
| Post-Done prompt | Share prompt after Done | |

**User's choice:** Secondary bone button

| Option | Description | Selected |
|--------|-------------|----------|
| Purely user-initiated (Recommended) | No nudges/nags | ✓ |
| Milestone nudges | PR/high-HSS prompts | |

**User's choice:** Purely user-initiated

---

## Stat privacy & customization

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed card (Recommended) | HSS + core trio always; zero toggle UI | ✓ |
| Per-stat toggles | Hide individual stats; needs reflow logic | |
| HSS-only toggle | Two fixed compositions | |

**User's choice:** Fixed card

---

## Photo legibility & overlay layout

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-anchored + gradient (Recommended) | Ring + stats along bottom over void→transparent scrim | ✓ |
| Center hero + full dim | Big ring center, uniform scrim | |
| You decide | Claude's discretion | |

**User's choice:** Bottom-anchored + gradient scrim

---

## Photo crop & framing

| Option | Description | Selected |
|--------|-------------|----------|
| Native square crop at pick (Recommended) | expo-image-picker allowsEditing iOS crop UI | ✓ |
| Auto center-crop | No crop UI | |
| Pinch-to-reposition in compose | Custom pan/zoom | |

**User's choice:** Native square crop at pick

---

## Permission-denied & edge cases

| Option | Description | Selected |
|--------|-------------|----------|
| Quiet fallback to void card (Recommended) | Silent fallback + settings hint | |
| Explain + Settings deep-link | Alert with Open Settings, then fall back | ✓ |

**User's choice:** Explain + Settings deep-link (diverged from recommendation — discoverability preferred)

---

## Card resolution & fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| 2× render, JPEG w/ photo (Recommended) | 2160px compose, JPEG for photo / PNG for void | |
| Straight 1080 PNG always | Single simplest path | |
| You decide | Claude's discretion; must be instant + offline | ✓ |

**User's choice:** You decide

---

## Claude's Discretion

- Output resolution/format/quality (instant + offline is the only hard requirement)
- Scrim gradient stops/opacity and overlay spacing for legibility
- Snapshot/share mechanics (Skia makeImageSnapshot vs alternates; file vs base64 handoff);
  any new module flagged as 06-06 gate
- Compose-screen route placement within expo-router conventions

## Deferred Ideas

- Story (9:16) card variant
- Per-stat privacy toggles / HSS-only flex card
- Camera-capture on the share path
- Milestone share nudges
