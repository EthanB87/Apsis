# APSIS — Nutrition Tracking Spec (Addendum to BUILD.md)

> Companion to BUILD.md. **Scope change (2026-07-13): nutrition tracking is now v1 scope,
> built as Phase 7 of the v1.0 milestone.** Originally written as v1.1/v2 scope; promoted
> to v1 by decision of the owner. Phase 7 is sequenced after Phase 6 (App Store submission)
> — the ~July 28 submission build ships without nutrition; nutrition lands in the first
> v1.x update unless explicitly re-decided.
> Positioning: nutrition is INCLUDED in the single premium tier (no add-on SKU).

---

## 1. Product scope (locked)

**In scope:**
- **Manual food logging** — search, recents, favorites, custom foods, and full manual
  ingredient/macro entry (user types name + macros). Fast entry is the bar: match
  MacroFactor/MFP speed or better.
- **Barcode scanning** — camera scan → product lookup → confirm serving → log.
- **Nutrition label scanning** — photograph the printed nutrition-facts label; OCR the
  macros (kcal/P/C/F, serving size) into a pre-filled custom food the user confirms.
- **Custom recipes/meals** — combine ingredients into a saved meal with per-serving macros.
- **Day-type adaptive targets** — the differentiator: daily kcal/P/C/F targets computed
  from bodyweight, goal mode, AND the day's logged training (heavy-lift / long-run /
  double / rest), per the nutrition model in the PRD (§6). This is what no macro app does.

**Explicitly OUT of scope:**
- ❌ Photo-based food recognition / "AI estimates your plate." Deliberately excluded —
  accuracy isn't there and it undermines trust with a data-savvy audience. Label OCR ≠
  photo estimation; label scanning reads printed numbers, which is accurate.
- ❌ Micronutrient depth at launch (track kcal + macros + sodium/fiber only; expand later).
- ❌ Meal plans / recipes content library (MacroFactor/FoodCoach territory).
- ❌ Restaurant chain-menu database (expensive; revisit on demand signals).

**Quality bar:** "as good as any tracking app" means: search returns a usable result in
<1s; barcode hit-rate that doesn't embarrass us in Canada/US; logging a repeat food takes
≤3 taps; label scan fills a custom food in one shot.

---

## 2. Food database provider research (mid-2026 pricing)

The database is the biggest cost + quality decision in nutrition. Market splits into
enterprise-contract providers (deep data, opaque pricing) and self-serve providers
(public pricing, instant keys).

| Provider | Coverage | Barcode | Pricing | Verdict for Apsis |
|---|---|---|---|---|
| **Open Food Facts** | 2.8M+ products, 150+ countries, community-built | Yes — free | **Free** (ODbL, attribution required) | Best free base layer; strong in Europe, patchier NA branded coverage; quality varies (crowdsourced) |
| **USDA FoodData Central** | ~250–300K US foods, government-verified | No barcode lookup | **Free** | Gold-standard generic/whole foods; no barcodes, US-only, quarterly updates. Great supplement, not sufficient alone |
| **YMove** | USDA + OFF combined + AI logging, 180+ country barcodes | Yes | **~$19/mo self-serve**, 7-day trial, public pricing | Strongest budget commercial option: one key, serverless-friendly, label localization included. Newer entrant (smaller track record) |
| **Chomp** | 800K+ products, 700K+ UPCs | Yes | **$299/mo** | Mid-tier commercial barcode DB; email-only support |
| **Edamam** | 900K+ foods, 615K+ UPCs, NLP analysis | Yes | **Free tier → ~$999/mo** range; sells nutrition/food-DB/recipes as separate products | Solid and established, but product split means stacking SKUs to get full coverage |
| **FatSecret Platform** | 1.9–2.3M items, 56+ countries, >90% global barcode success | Yes — best-in-class | **Free basic tier; Premier is quote-based contract** (the tier with barcodes/volume) | Best data + best barcode coverage, but procurement cycle, no public pricing, and OAuth IP-whitelisting clashes with serverless backends |
| **Nutritionix** | 800K–1.9M items, best US chain-restaurant coverage, NLP queries | Yes | **Free dev tier (500 req/day) → enterprise from ~$1,850/mo** | Overkill/overpriced for this phase; only compelling if restaurant menus become core |
| **Spoonacular** | 365K+, recipe-first | Partial | Free → ~$149/mo | Recipe-centric; wrong shape for a macro tracker |

**Key market notes:**
- The tier most apps actually need from FatSecret (barcodes, volume) sits behind a sales
  process; budget real time for procurement if chosen.
- Nutritionix free tier (500 req/day) is fine for development but not production.
- OFF is free forever but crowdsourced: expect missing/incorrect NA entries; plan for
  user-submitted corrections.

---

## 3. Recommended database strategy (hybrid, staged)

**Stage 1 — Phase 7 launch (target cost: $0–19/mo):**
1. **Local-first food cache** (same offline-first principle as training): every food a
   user logs is cached on device + in our DB; repeat logging never hits a third-party API.
2. **Open Food Facts** as the free barcode/product base layer (attribution in settings).
3. **USDA FDC** for generic/whole foods (chicken breast, rice, oats — the foods hybrid
   athletes actually eat daily).
4. **User-created foods + label-scan entries** feed a growing Apsis-owned database —
   every label scan improves OUR coverage where OFF is weak. This is a compounding asset.
5. If OFF's NA barcode miss-rate hurts in beta, bolt on **YMove ($19/mo)** as the
   commercial fallback for barcode misses only (call it second, cache the result).

**Stage 2 — scale (revisit at ~5–10K MAU):**
- Evaluate **FatSecret Premier** (best global barcode coverage) once revenue supports a
  contract and we have volume numbers to negotiate with.

**Why this order:** costs ~nothing at launch, keeps repeat-logging offline/instant,
and converts our own users' label scans into a proprietary database moat instead of
paying to rent one.

---

## 4. Label scanning implementation

- **On-device OCR, not a paid API:** Apple's Vision framework (VNRecognizeTextRequest)
  reads nutrition labels on-device — free, private, offline. Parse kcal/protein/carbs/fat/
  serving via regex over recognized text; show a confirm/edit sheet before saving.
- Every confirmed label scan saves as a custom food AND (with user consent) contributes
  to the shared Apsis food DB (see §3.4).
- Barcode scanning: expo-camera / VisionCamera barcode module → lookup chain:
  local cache → Apsis DB → OFF → (optional) commercial fallback.

---

## 5. Data model additions (extends BUILD.md §5)

```
food
  id, name, brand?, barcode?, source('user'|'off'|'usda'|'apsis'|'commercial'),
  per100g: kcal, protein_g, carb_g, fat_g, fiber_g?, sodium_mg?,
  servingName?, servingGrams?, verified(bool), createdByUserId?

food_log
  id, userId, localDate, meal('breakfast'|'lunch'|'dinner'|'snack'),
  foodId?, qtyGrams, kcal, p, c, f          -- denormalized for fast day totals
  quickAdd(bool)                             -- macro-only entry without a food row

recipe
  id, userId, name, servings
recipe_ingredient
  recipeId, foodId, qtyGrams

nutrition_target                             -- generated daily (PRD §6.4)
  userId, localDate, dayType('heavy_lift'|'long_run'|'double'|'rest'|'mixed'),
  kcal, protein_g, carb_g, fat_g, source('auto'|'override')
```

Engine addition (`packages/engine`): `dailyMacroTarget(profile, dayType, sessionKcal) ->
{kcal,p,c,f}` — pure function, same golden-file test treatment as HSS.

---

## 6. Pricing decision (locked)

- **One premium tier. Nutrition included. No add-on SKU.** An add-on recreates the
  fragmentation Apsis sells against.
- Nutrition now ships inside v1, so the original "raise price at v2 launch + grandfather
  founding users" mechanics no longer apply as written. Carry-over intent: premium pricing
  (e.g. $9.99/mo · $59.99/yr) is justified by nutrition being included from the start; if
  the July 28 submission ships before Phase 7 completes, the pre-nutrition early adopters
  are the "founding users" — honor the grandfather promise for anyone who subscribes
  before nutrition lands, and announce it BEFORE the nutrition update ships ("lock your
  price before nutrition drops") as a conversion lever and build-in-public story.
- Comparison anchor for marketing: MacroFactor is ~$72/yr for nutrition alone; Apsis
  premium = training load + readiness + nutrition for less.

## 7. Build-order note for Claude Code

When Phase 7 begins: read this file + BUILD.md + the PRD nutrition model (§6). Build order:
(1) food/food_log schema + manual logging + quick-add, (2) day-type target engine fn,
(3) barcode chain with OFF, (4) label OCR, (5) recipes. Ship 1–2 before 3–5 if timeline
pressures — manual logging + adaptive targets is already a sellable increment.
