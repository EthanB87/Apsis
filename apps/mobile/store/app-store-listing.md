# App Store Listing — Apsis

> Source of truth for every App Store Connect text field. These strings are drafted here first,
> require user approval (see Task 3 of `06-05-PLAN.md`), and are then entered verbatim into App
> Store Connect in plan 06-07. Do not invent monetization or features not shipped.

## App Name

**Apsis: Hybrid Training Log**

Character count: 26 / 30 — fits.

## Subtitle

**Lift, run + fuel in one app**

Character count: 27 / 30 — fits. Updated 2026-07-20 to signal the v1 nutrition feature
("fuel") alongside lifting and running; replaces the training-only "One score for lift + run".

## Description

You lift. You run. One number tells you what it cost.

Apsis is the training log for hybrid athletes who lift and run and are tired of stitching
together a lifting app, a running app, and a spreadsheet just to know if today was too much.

Log a lifting session — exercises, sets, reps, load, RPE — as fast as you'd log it in Strong
or Hevy. Log a run or conditioning piece — distance, duration, pace, heart rate if you've got
it. Apsis combines both into a single Hybrid Stress Score (HSS): one honest number for total
training stress, whether it came from a barbell or a road.

See your HSS trend and a readiness read — green, amber, red — right on the home screen, so you
know when to push and when to back off. Your log is the source of truth, not a server — logging
works offline, and your data stays on your device.

Then fuel it. Log food by barcode scan, quick search, or fast manual entry — and Apsis sets daily
calorie and macro targets that adapt to what you actually trained that day: more on a heavy lift
or long run, less on a rest day. No other tracker ties your fuel to your training load.

Connect Apple Health and Apsis pulls in your runs, heart rate, and bodyweight automatically, and
pushes your logged sessions back so they show up alongside your other workouts. HealthKit is
optional — skip it in onboarding and connect later from Settings if you change your mind.

Done with a session? Share it. Apsis builds a branded workout-summary card — your HSS and key
stats, with an optional photo background you pick and compose right on your phone — and hands it
to the standard iOS share sheet so you post it wherever you want.

Built for HYROX and tactical athletes who train two disciplines and need one shared unit for
what it's actually costing them.

- One combined training-load number for lifting and running (HSS)
- Nutrition with day-type adaptive calorie & macro targets — barcode scan, search, or manual entry
- Fast, tap-to-type set logging — no unnecessary steppers or screens
- Readiness trend (green/amber/red) over your last 14–30 days
- Shareable workout-summary card with an optional photo background, sent via the iOS share sheet
- Apple Health import and write-back, fully optional
- Offline-first — your logged data stays on your device (barcode/online food lookups aside)

## Keywords

HYROX, tactical, readiness, macros, nutrition, calories, RPE, HSS, strength, conditioning

Character count: 89 / 100 — fits the App Store Connect keyword field limit (comma-separated,
count includes commas). Adds nutrition search terms (macros, nutrition, calories) for the v1
nutrition feature; dropped "workout tracker", "athlete", "stress" to make room. Still avoids
terms already indexed from the App Name/Subtitle ("hybrid", "training", "log", "score",
"lift"/"run" variants).

## Promotional Text

Lift, run, and fuel — one training-load score, a readiness read, and macro targets that adapt to your training.

## Primary Category

Health & Fitness

## Price

Free — no in-app purchases.

## App Review Notes

Apsis requires no account or login. All logged data (workouts, nutrition, heart rate, bodyweight)
is stored on-device and is never transmitted to us or any server.

HealthKit access is optional and can be skipped during onboarding; it can be connected later from
Settings → Apple Health. All health data stays on-device.

The camera is used only for scanning food barcodes (nutrition feature). When you scan a barcode or
search for a food not already on your device, the app queries public food databases (Open Food Facts
and USDA FoodData Central), sending only the barcode number or typed search text — never any personal,
health, or logged data. Food logging works offline via manual entry.

The only diagnostic data that leaves the device is anonymous crash reports (Sentry) — error type,
stack trace, device/OS model, and app version only; no personal or health information.

Photo-library access is requested only when the user taps to add an optional background photo
to a shareable workout-summary card; the app never accesses the photo library otherwise. The
picked photo is composed into the share image entirely on-device. Neither the photo nor the
composed image is transmitted by the app — the image only leaves the device if the user
explicitly shares it via the standard iOS share sheet.

---

**Status:** Approved 2026-07-13; revised & re-approved 2026-07-20 after nutrition shipped in v1;
revised 2026-08-03 (pending re-approval, see Task 3 of `06-08-PLAN.md`) after the Phase 8 share
card shipped. Changes (owner-approved unless noted): subtitle → "Lift, run + fuel in one app"
(nutrition signal); description gains a nutrition paragraph + bullet; keywords add
macros/nutrition/calories (89/100); promotional text mentions fuel + adaptive macro targets; App
Review notes disclose camera-for-barcode + the Open Food Facts / USDA food-lookup network calls;
the earlier fully-offline claim corrected to "offline-first" (logging is local; barcode/online
food search query external food databases). 2026-08-03 addition: description gains a share-card sentence +
Features bullet; App Review notes gain a photo-library-access disclosure (optional share-card
background photo, composed on-device, shared only via the user-initiated iOS share sheet — no
photo or image transmitted by the app). App name unchanged (26/30). Subtitle unchanged (27/30).
Keywords unchanged (89/100) — the share card introduced no new field-length pressure.
This is the source of truth for App Store Connect entry in plan 06-07.
