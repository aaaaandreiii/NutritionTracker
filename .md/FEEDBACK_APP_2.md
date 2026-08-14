# Task 1:

You are working on my existing web application **Sugar pAI**.

Your task is to polish the desktop UI/UX of the route:

`/sugar-pai/scan`

Do **not** redesign the product from scratch. Preserve the existing Sugar pAI visual identity: warm cream background, mint/green palette, dark green accents, serif display headings, compact sans-serif UI typography, and the existing overall brand personality.

The current implementation works functionally, but visually it still feels unfinished and occasionally buggy. I want you to make it feel like a production-quality SaaS/consumer-health interface.

## First: inspect before changing anything

Before editing code:

1. Locate the implementation for `/sugar-pai/scan`.
2. Identify all components involved in:

   * global/header navigation
   * secondary Sugar pAI navigation
   * scan workflow stepper
   * Packaged Label / Estimated Meal switch
   * barcode lookup
   * scanner preview
   * product match state
   * evidence/photo upload cards
   * scan-state sidebar
   * estimated meal flow
   * meal component input
   * quick-add foods
3. Identify the existing CSS system/design tokens/Tailwind configuration/component primitives.
4. Reuse the existing architecture and styling system wherever possible.
5. Do not replace working business logic, APIs, barcode logic, camera logic, nutrition analysis, or meal calculation logic unless necessary for a UI-state bug.

This task is primarily a **UI polish + UX hierarchy + layout cleanup** pass.

---

# GLOBAL LAYOUT

Create one coherent desktop layout system for the route.

Use a centered main content container approximately:

`max-width: 1160–1200px`

with consistent horizontal gutters.

The following areas should share the same horizontal alignment wherever appropriate:

* secondary Sugar pAI navigation
* workflow stepper
* Packaged Label / Estimated Meal switch
* scan content
* evidence content
* estimated meal content

Currently these elements begin at slightly different x positions, which makes the page feel assembled from unrelated components.

Do not alter the global product header dramatically, but make the page beneath it feel geometrically aligned with it.

Use a consistent desktop grid for content sections:

`main content + right rail`

approximately:

`minmax(0, 1fr) 320–340px`

with around:

`28–32px gap`

Do not allow right-rail content to create huge meaningless blank regions in the main column.

Cards should generally use consistent:

* border radius
* border color
* padding
* shadow/elevation
* heading spacing

Avoid excessive shadows. Prefer subtle borders and very light elevation.

---

# TYPOGRAPHY

Keep the existing serif display font.

Reduce the oversized `Scan the barcode` hero heading. It currently feels more like a marketing landing page than a utility workflow.

Target approximately:

desktop hero heading: `52–56px`

with controlled line-height.

Section headings should feel significantly smaller than the hero.

Keep body copy around normal readable UI sizing and improve contrast where existing gray text is too faint.

Reserve uppercase/monospace eyebrow labels for genuinely small metadata/status labels. Do not overuse them.

---

# SECONDARY NAVIGATION + STEPPER

Clean up the relationship between:

`Ask / Scan / Today / History / About`

and:

`Identify / Evidence / Review / Context / Log`

The route currently has a lot of navigation chrome.

Do not remove functionality, but reduce the visual weight of the workflow stepper.

Important state fix:

A product should **not** show `Identify` as completed while the user is still being asked to confirm `Use this product`.

Keep `Identify` active until the user confirms the matched product.

Only after confirmation should the workflow advance to `Evidence`.

Make active/completed/upcoming step styling unmistakable but subtle.

---

# PACKAGED LABEL / ESTIMATED MEAL SWITCH

Polish the segmented control.

Requirements:

* clearly visible active state
* consistent border/radius with the rest of the design
* no excessive empty internal space
* both tabs should feel intentionally proportioned
* preserve current functionality
* use the same segmented-control visual language anywhere else it appears

---

# BARCODE LOOKUP — EMPTY STATE

The barcode lookup section is currently too large and vertically stretched.

Keep the two-column concept but tighten it.

The right scanner placeholder is currently a huge dark rectangle that can look like a broken video player.

Before the camera is running:

* render a more compact scanner-ready state
* approximately `320–360px` tall on desktop
* keep the barcode/scanner graphic
* keep a clear camera/scanner affordance
* use concise explanatory text
* it should look intentionally inactive, not like an empty video feed

When the actual live scanner becomes active, allow the camera preview to use an appropriate aspect ratio.

Do not unnecessarily enlarge the entire hero to match the scanner height.

Tighten vertical spacing between:

* eyebrow
* title
* explanatory text
* scanner buttons
* label market
* barcode input

Keep the CTA hierarchy:

Primary: `Open live scanner`

Secondary: `Upload barcode photo`

---

# BARCODE LOOKUP — PRODUCT FOUND STATE

There is currently a major UX problem: the interface can show **two separate `Use this product` actions**.

Fix this.

There must be exactly **one canonical confirmation CTA**.

Preferred implementation:

Left side:

* barcode field
* compact success/match summary only
* e.g. `✓ SkyFlakes 25 g found`
* no second confirmation CTA

Right side:

* canonical product-found card
* product name
* brand / package size
* relevant nutrition summary
* contextual information
* one primary `Use this product` CTA
* one secondary `Not this product` action

Remove duplicated match information where it does not add value.

Do not make the right product card vertically stretch to match the entire left column. It should size naturally to its content:

`align-self: start`

Remove large unused blank space inside the product card.

Normalize product naming consistently across the route.

For example, do not alternate between:

`sky flakes 25g`

`SkyFlakes · 25 g`

`sky flakes 25g`

Use a single formatting function/component.

Preferred presentation:

`SkyFlakes 25 g`

with brand metadata separately if appropriate.

---

# NOVA INFORMATION

The current NOVA section is rendered in a pale yellow treatment that resembles a warning, even though the UI says NOVA is not a health score.

Restyle NOVA as neutral contextual information rather than a warning.

For example:

`NOVA 3 · Processed food`

with a small info affordance explaining what NOVA means.

Keep the existing disclaimer/context, but lower its visual priority.

---

# EVIDENCE UPLOAD CARDS

The three evidence cards are:

1. Nutrition Facts panel — required
2. Ingredients panel
3. Front label — recommended

Preserve this flow.

However, standardize the visual treatment.

Currently some cards use solid borders and others use large dashed containers, which makes the state model feel inconsistent.

Use one common card component.

Inside each card show:

* step number
* title
* required/recommended/optional status
* short explanation
* upload controls
* upload state if present

Use dashed styling only for the actual drop/upload target if needed, not the entire card.

`Use camera` and `Choose image` are equivalent methods, so give them consistent visual weight.

Do not make one look like a large button and the other like an unrelated text link unless there is an intentional hierarchy.

When a photo has been successfully added, transition the card into a clear completed/uploaded state without dramatically changing its dimensions.

---

# SCAN STATE SIDEBAR

The existing sidebar uses developer/system language such as:

`Before evidence`

and:

`Analysis service — Ready to analyse labels`

This feels like internal implementation information.

Rewrite the user-facing hierarchy without altering underlying state logic.

The sidebar should communicate:

1. current readiness/status
2. what the user still needs to add
3. the next action

Example structure:

`Ready to analyze`

`Add a readable Nutrition Facts photo to continue.`

`Adding the ingredients panel improves sugar-source analysis.`

Then the primary CTA.

Keep technical/service/debug information inside the existing collapsed `Technical details` section rather than giving it primary visual prominence.

Keep warnings secondary to the main action.

The sidebar may be sticky on desktop, but its sticky offset must respect the fixed/sticky header and must never overlap navigation.

---

# ESTIMATED MEAL — EMPTY STATE

The current empty state exposes too many competing actions at once.

Establish a stronger hierarchy.

Primary path:

`Add a meal photo`

Secondary path:

`or add foods manually`

The photo card should itself provide the image/camera actions.

Do not show a giant disabled green `Identify foods in photo` CTA before a photo exists.

Either:

* hide the identification CTA until a photo exists

or

* convert the empty photo area itself into the upload CTA

Once a photo exists, reveal/enable:

`Identify foods in photo`

with an obvious primary action state.

---

# MEAL COMPONENTS

Make the manual food entry card the primary workspace for estimated meals.

Keep the search/text field and Add Food behavior.

Improve spacing and alignment between:

* input
* search affordance
* Add food button
* resulting components

Do not show decorative icons that appear clickable unless they actually perform an action.

When no meal components exist, use a concise intentional empty state.

When components are added, keep the layout compact and make quantity/portion editing easy to scan.

Do not alter calculation behavior.

---

# QUICK ADD — IMPORTANT LAYOUT FIX

The current Quick Add implementation creates a serious desktop UX issue.

When scrolling farther down the page, almost the entire left side becomes empty while a long Quick Add card continues down the right sidebar.

This makes the page look broken.

Fix this structurally.

Move Quick Add into or directly beneath the main `Meal components` workspace rather than placing a tall food list in the right rail.

Render common foods as compact clickable chips/buttons, for example:

`Kanin`

`Sinangag`

`Pandesal`

`Pancit`

`Adobo`

plus:

`More…`

Do not render ten vertically stacked full-width rows if a compact chip/grid treatment works.

Preserve all existing food options and click behavior.

If there are more items than comfortably fit, collapse the remainder behind `More` / `Show more`.

The page should no longer produce a viewport where the left ~65% is empty simply because Quick Add is taller than the main content.

---

# ESTIMATED MEAL RIGHT RAIL

The existing right card includes rows such as:

`Start with a photo`

`Add foods manually`

`Meal components`

These currently look like clickable buttons even when they are acting as status indicators.

Remove that ambiguity.

If they are progress indicators, render them as a small checklist/timeline.

If they are truly interactive navigation items, give them clear interactive states.

Do not make static information resemble disabled buttons.

Keep:

* meal name
* meal type
* confirmation/calculation CTA

but visually de-emphasize those fields until at least one meal component exists.

The `Confirm portions and calculate` CTA should become visually prominent only when the user can actually proceed.

---

# SPACING + VISUAL POLISH

Audit the whole route for spacing consistency.

Use a restrained spacing system instead of arbitrary gaps.

Pay particular attention to:

* vertical distance between sections
* card padding
* heading-to-description spacing
* button groups
* sidebar spacing
* input heights
* label spacing

Target roughly:

regular controls: `44–48px` height

cards: approximately `20–28px` padding depending on density

major section gaps: approximately `24–32px`

Avoid unnecessary `min-height` values that create large blank areas.

Avoid forcing cards in the same CSS grid row to equal heights unless the design genuinely benefits.

Use:

`align-items: start`

where appropriate.

---

# COLOR / STATES / ACCESSIBILITY

Retain the existing brand colors.

Do not introduce an unrelated new palette.

Audit:

* disabled state contrast
* muted body text contrast
* borders
* active tabs
* focus rings
* hover states
* keyboard focus
* button disabled states
* form labels

Disabled controls should look disabled but remain readable.

Interactive elements need clear hover and focus-visible states.

Do not rely on green alone to communicate success.

Maintain accessible semantic HTML wherever practical.

---

# MOTION

Use subtle motion only if the project already has a motion system.

Appropriate examples:

* 120–180ms hover transition
* state-card fade/slide when a product match appears
* upload completion transition
* segmented-control active transition

Do not add decorative animation.

---

# DO NOT

Do not:

* redesign unrelated routes
* change APIs
* break barcode scanning
* change nutrition calculations
* change meal calculations
* remove existing functional states
* introduce a new UI framework unless one is already installed and used
* add large dependencies just for styling
* replace the Sugar pAI brand identity
* make everything rounded/pill-shaped
* overuse gradients
* add excessive shadows
* solve spacing issues with arbitrary fixed heights

---

# DESKTOP-FIRST, BUT DO NOT BREAK RESPONSIVENESS

The screenshots being addressed are desktop views.

Optimize the current task for desktop first, particularly around `1440–1600px` viewport widths.

However, do not introduce CSS that breaks existing tablet/mobile behavior.

Prefer responsive grid/flex primitives and existing project breakpoints.

---

# STATES TO TEST

After implementing the changes, manually verify the route in at least these states:

### Packaged Label

* completely empty
* barcode entered, no match
* product match found
* product confirmed
* no evidence uploaded
* Nutrition Facts uploaded
* ingredients missing
* all evidence present

### Estimated Meal

* completely empty
* meal photo selected
* manually entered food
* quick-added food
* multiple components
* ready to calculate

Also verify:

* normal desktop viewport
* narrower desktop/tablet width
* sticky header/sidebar behavior
* scrolling to the bottom of both modes
* no giant unexplained blank regions
* no duplicated primary CTAs
* no clipped or overlapping UI

---

# IMPLEMENTATION APPROACH

Make the changes directly in the existing components rather than creating a parallel redesign.

Prefer reusable primitives where several cards currently duplicate styling.

If useful, extract reusable components such as:

* `ScanSectionCard`
* `EvidenceUploadCard`
* `StatusCard`
* `SegmentedControl`
* `ProductMatchCard`

but only if doing so improves the existing architecture.

Do not over-engineer.

Before finishing, run the project's existing lint/typecheck/tests/build commands relevant to the changed files and fix issues introduced by your changes.

Then give me a concise summary containing:

* files changed
* major UI/UX changes
* any structural component refactors
* any remaining UI issues you noticed but intentionally did not change

The final result should feel **calm, compact, deliberate, and production-ready**, not like a prototype with more styling layered on top.


# Task 2:

Continue polishing the existing Sugar pAI route:

`/sugar-pai/scan`

The previous pass addressed the Scan / Identify / Evidence portions of this route.

This task should focus specifically on:

* Step 3: `Review`
* the transition from Review → Context
* Step 4: `Context`

Do not redesign Sugar pAI from scratch.

Preserve the existing brand system:

* cream background
* green/mint palette
* serif display typography
* compact sans-serif UI typography
* restrained borders
* existing navigation
* existing design tokens/components where possible

The goal is to make these stages feel like a polished consumer nutrition product rather than a developer/research validation dashboard.

Do not change nutrition calculations, evidence rules, database logic, barcode behavior, medical-safety rules, or analysis semantics merely for visual reasons.

However, you may reorganize when and where information is shown.

---

# FIRST: INSPECT THE CURRENT IMPLEMENTATION

Before editing:

1. Locate all components used after Evidence is completed.
2. Trace the state transition:

   * Evidence
   * Review
   * validation/confirmation
   * Context
   * Log
3. Identify where the following are currently rendered:

   * Review header
   * product/serving fields
   * nutrition fields
   * evidence provenance badges
   * ingredients textarea
   * sugar/ingredient context flags
   * captured-evidence sidebar
   * servings-consumed control
   * meal-type control
   * validation CTA
   * Context product summary
   * Smart Context cards
   * Glycemic Evidence
   * Interpretation
   * Evidence used
   * Limitations
   * Technical details
4. Identify any shared form/card/status components already in use.
5. Preserve the existing state machine and backend logic unless the UI currently exposes a state at the wrong workflow stage.

Do not create a parallel redesign.

Refactor existing components directly.

---

# PRIMARY UX PRINCIPLE

The Review stage should answer one question:

**“Are these the package values Sugar pAI should use?”**

The user should not need to understand internal database, extraction, taxonomy, rule-engine, or model implementation details to complete this task.

The Context stage should answer:

**“What useful context can Sugar pAI provide from the label I confirmed, and what can it not determine?”**

Technical provenance must remain available where appropriate, but should be progressively disclosed rather than dominate the normal user experience.

---

# REVIEW HEADER

Keep the existing structure and brand feel, but tighten it.

Preferred hierarchy:

eyebrow:
`REVIEW EVIDENCE`

heading:
`Confirm the label`

supporting copy:
`Check the values below against the package. Leave anything not declared as unavailable rather than entering zero.`

Reduce the oversized heading slightly if needed so this feels like an application workflow rather than a marketing hero.

Target approximately:
`46–52px` desktop.

Remove the floating `READY TO REVIEW` badge unless it communicates a genuinely meaningful state.

Do not show status labels that merely restate the fact that the user is currently on Review.

---

# BACK ACTION

Replace overly state-specific wording such as:

`Retake or replace images`

with a stable navigation action such as:

`← Back to evidence`

The Review page may be reached through a database-only match where no images exist.

Do not imply that images exist when they do not.

---

# SAFETY DISCLAIMER

Keep the existing medical/safety disclaimer.

However, reduce its visual prominence.

Do not make a large informational banner compete with the main Review task.

Use one consistent compact safety note rather than repeating equivalent medical limitations throughout the page.

Detailed limitations should be available later under progressive disclosure.

---

# REMOVE EMPTY RIGHT RAILS

The current Review screen can render a large `Captured Evidence` sidebar containing only:

`No captured panels were needed for this database match.`

and another box saying context becomes available after validation.

This wastes desktop space and makes the page feel unfinished.

Behavior should be conditional.

## If captured images exist

Render a useful sticky evidence rail containing thumbnails such as:

* Nutrition Facts
* Ingredients
* Front label

Each thumbnail should:

* have a clear label
* be clickable to enlarge/view
* show uploaded/available status
* remain useful while the user reviews values

## If no captured images exist

Do not render an empty evidence rail.

Allow the Review form to use the available width.

Do not preserve an empty sidebar purely for visual consistency.

---

# SOURCE / PROVENANCE BADGES

The current interface repeats `DATABASE MATCH` beside nearly every field.

This is visually noisy and causes the badge to lose meaning.

Change the provenance hierarchy.

At the section/card level, establish the default source once, for example:

`Source: Database match`

or an equivalent subtle status.

Only show field-level source/status badges when a field is exceptional.

Examples:

* `Edited`
* `From photo`
* `Not declared`
* `Unavailable`
* `Needs review`

If all values come from the same database match, do not repeat the same badge on every field.

Preserve underlying provenance data.

Only change presentation.

---

# PRODUCT NAME NORMALIZATION

Do not show raw-looking product formatting such as:

`sky flakes 25g`

Create/reuse a safe display formatter so presentation is consistent throughout the route.

Preferred result:

`SkyFlakes 25 g`

or the canonical brand/product naming already used elsewhere.

Preserve raw upstream/database text internally if required.

Do not mutate source records merely for presentation.

---

# PRODUCT & SERVING CARD

Simplify the current layout.

Avoid putting metadata on the left while the actual field label floats on the far right.

Use conventional form hierarchy.

Example:

`Product name`
[input]

then:

`Serving size`     `Unit`
[input]            [input/select]

Keep inputs aligned.

Use consistent widths.

Do not use decorative opposite-end labels that look like column headings but are not.

---

# NUTRITION REVIEW — MAJOR DENSITY IMPROVEMENT

The current `Carbohydrate-first review` is too vertically spacious.

The user is reviewing a compact set of structured values.

Present the nutrition information as a dense, highly scannable review form.

Fields include:

* Total carbohydrate
* Dietary fiber
* Total sugars
* Added sugars
* Sugar alcohols
* Protein
* Total fat

Prefer a row/grid structure visually similar to:

`Nutrient | Value | Status/source`

This does not have to be a literal HTML table if forms are easier to implement accessibly.

The important goal is density and scanability.

Avoid giving every field:

* a large vertical block
* repeated provenance badge
* repeated helper text
* excessive whitespace

Only display helper copy where it materially helps the user.

Important helper copy such as:

`Use the printed total carbohydrate—not net carbs.`

can remain.

Generic repeated text such as:

`As printed for the same serving.`

should not occupy permanent space for several fields.

---

# UNITS

Remove the floating `GRAMS` label from the far-right corner of the card.

Units should be attached directly to values.

Examples:

`17 g`
`2 g`
`5 g`

Use input suffixes or adjacent unit text.

The user should never have to look elsewhere in the card to determine the unit.

---

# NUMBER INPUTS

The current browser-native number spinners are visually noisy.

Where practical, suppress native spinner chrome while preserving:

* numeric validation
* keyboard accessibility
* mobile numeric input behavior
* correct semantics

Do not replace them with decorative custom plus/minus controls unless the project already has a strong accessible component for this.

Keep field height consistent with the rest of the app.

---

# NOT DECLARED / UNAVAILABLE STATES

Do not display text such as:

`Not declared`

inside a control that visually appears to be a numeric spinner.

Model missing-value states deliberately in the UI.

A nutrient should clearly appear as one of:

* explicit numeric value, e.g. `0 g`
* `Not declared`
* `Unavailable`

Make the semantic difference between:

`0 g`

and:

`Not declared`

very clear.

A declared zero means the package explicitly reports zero.

Not declared/unavailable is not equivalent to zero.

Preserve this distinction in existing data logic.

Do not silently convert missing states to zero.

---

# EDITED VALUES

When a user changes a database/photo-derived value:

* mark only that field as `Edited`
* optionally provide an Undo/Restore action
* retain the original value internally
* do not change every field's styling because one field changed

The review experience should make corrections obvious without becoming noisy.

---

# INGREDIENTS

Do not expose raw database formatting artifacts to users.

Examples of undesirable display:

`_WHEAT_ FLOUR`

Normalize ingredient text for presentation.

Example display:

`Wheat flour, coconut oil, vegetable shortening (coconut oil, palm oil and vitamin E [antioxidant]), iodized salt, sugar, sodium bicarbonate (raising agent), yeast`

Preserve the raw original text internally where needed.

Do not alter analysis semantics merely by changing display formatting.

Prefer a readable static ingredient panel by default with an:

`Edit`

action.

Only switch to an editable textarea when the user chooses to edit.

Avoid presenting a large textarea if the normal task is simply verification.

---

# INGREDIENT CONTEXT FLAGS

Keep the underlying ingredient-context functionality, but make it understandable to normal users.

Avoid exposing taxonomy terminology such as:

`SUGAR ALIAS`

as the main explanation.

If the ingredient list contains `sugar` and internal taxonomy maps it to sucrose, present that carefully.

Preferred user-facing concept:

`Sugar detected`

Supporting copy:

`Sugar appears 6th in the ingredient list. Ingredient order confirms presence but does not reveal how many grams come from sugar.`

If a sucrose mapping must be shown, explain it as secondary contextual information rather than silently replacing the package wording.

Do not make taxonomy terminology more prominent than the package ingredient itself.

---

# REVIEW CTA — IMPORTANT

The page title says:

`Confirm the label`

but the current CTA says:

`Validate corrections`

This is inconsistent, especially when the user has not changed anything.

Use stable user-facing language.

Preferred primary CTA:

`Confirm label values`

or:

`Confirm and continue`

The CTA should work whether or not fields were edited.

If useful, supporting text may say:

`2 values edited`

but do not rename the core action based on whether corrections exist.

The CTA does not need to span the entire page width.

Use an appropriately sized primary button aligned consistently with the form.

---

# MOVE SERVINGS CONSUMED + MEAL OUT OF REVIEW

This is an important workflow correction.

The current Review footer asks for:

* `Servings consumed`
* `Meal`

before validating the package label.

These values describe the user's consumption/logging context.

They do not determine whether the package label is accurate.

There is already a later `Log` stage in the workflow.

Therefore:

**Do not ask for servings consumed or meal type as part of label validation.**

Move/reuse these controls in the appropriate Log stage, or immediately before logging if that is how the existing state machine is structured.

Review should only confirm package evidence.

Do not lose the user's existing logging functionality—relocate it appropriately.

If moving these fields requires a significant state-machine change, preserve their state plumbing but change where the controls are rendered.

---

# REVIEW PAGE TARGET STRUCTURE

Aim for something approximately like:

Header:
`REVIEW EVIDENCE`
`Confirm the label`
short supporting copy

Optional source summary:
`SkyFlakes 25 g · Database match`

Card:
`Product & serving`

Card:
`Nutrition per serving`
compact structured nutrient rows

Card:
`Ingredients`
readable ingredient list
Edit action
small ingredient/sugar context note

Footer actions:
`← Back to evidence`
`Confirm label values →`

Optional sticky image rail only when captured evidence actually exists.

The Review page should feel focused and finite.

---

# TRANSITION TO CONTEXT

After label confirmation:

* mark Review as completed
* advance Context to active
* preserve confirmed values
* do not make the user wonder whether confirmation saved successfully
* avoid a visually jarring full-page state reset

If the project already has state-transition motion, use subtle 120–180ms transitions only.

No decorative animation.

---

# CONTEXT HEADER

Keep the existing concept:

`VALIDATED PRODUCT`

`Your evidence, in context.`

This is a strong direction.

Keep the serif identity, but maintain the more compact sizing established elsewhere.

The supporting copy should make clear that Context is based on confirmed package values.

Remove status badges such as `USER CONFIRMED` if they merely restate information already established immediately above.

---

# PRODUCT SUMMARY

Keep the Product Summary component.

Polish it.

Normalize product name formatting.

Avoid repeating `User confirmed` under every nutrient tile.

Establish provenance once:

`Values confirmed by you`

Then present the metrics cleanly:

* Total carbohydrate — 17 g
* Total sugars — 2 g
* Added sugars — 0 g
* Dietary fiber — 1 g

Keep:

`Edit evidence`

as a clear secondary action.

Use compact cards/rows that do not feel cramped.

---

# SMART CONTEXT

The Smart Context section is directionally strong.

Keep actionable guidance such as:

`Add a fiber anchor`

and relevant examples.

However, make the semantics of pills/chips unambiguous.

If a chip is clickable and performs an action, it may look interactive.

If it is only guidance, do not style it exactly like a clickable button.

For guidance-only recommendations, consider:

* plain tagged suggestions
* bullet recommendations
* softer non-button chips

Maintain keyboard/focus behavior for anything actually interactive.

---

# INGREDIENT CONTEXT COPY

Simplify research-style language.

Current concepts such as:

`Ingredient names are context only`

can be rewritten more directly.

Preferred pattern:

`Ingredient amounts aren't available`

`The label confirms that sugar is present, but ingredient order does not tell us how many grams come from sugar.`

The user should understand the limitation without learning the internal reasoning architecture.

Keep the underlying safety constraint unchanged.

---

# GLYCEMIC EVIDENCE — MAJOR PRODUCTION POLISH ISSUE

The normal Context UI must not expose internal/demo implementation content such as:

* `heuristic_demo`
* taxonomy version strings
* local demo placeholders
* experimental demo GI estimates
* demo GI inputs
* internal fixture language

Do not merely restyle this content.

Remove it from the normal consumer-facing Context experience.

If there is no tested-product glycemic evidence, render a calm neutral empty state:

`No tested glycemic-index data found for this product.`

Supporting copy can explain:

`Sugar pAI will not estimate a product-specific GI from its ingredient list.`

If additional explanation is useful, provide a secondary disclosure such as:

`How missing glycemic evidence is handled`

Internal demo values may remain available in development/debug tooling if they are needed for engineering.

Do not alter backend/test behavior solely because the production UI hides the diagnostics.

---

# WARNING COLORS

Do not use pale yellow warning styling simply because data is unavailable.

Reserve warning/amber treatments for something the user should actually pay attention to.

Neutral missing evidence should use a neutral informational treatment.

Examples:

* no tested GI data → neutral
* ingredient quantities unknown → neutral information
* conflicting evidence requiring user action → warning
* validation failure → error

---

# INTERPRETATION

The current Interpretation content contains useful user-facing material.

It is more important than developer diagnostics.

Promote it.

Use simple structure such as:

`What the label tells us`

`What may influence response`

`What the label cannot determine`

Keep this content concise and readable.

It may remain collapsible if space requires, but it should not be visually subordinate to raw technical implementation information.

---

# TECHNICAL DETAILS — PROGRESSIVE DISCLOSURE

The current normal UI exposes information such as:

* barcode/database ID
* label extraction
* raw ingredient text
* deterministic rule engine
* rule version
* vision model
* model identifier such as `gemma4:12b`
* extraction status
* panel-supplied status
* taxonomy/debug information

This is too implementation-heavy for the default consumer flow.

Create two levels of transparency.

## User-facing: `How this was determined`

Show concise provenance such as:

* Product information came from the barcode database.
* Nutrition values were confirmed by you.
* Ingredients were confirmed by you.
* No tested product-specific glycemic data was available.

## Developer/debug diagnostics

Keep raw details such as:

* model names
* rule versions
* raw strings
* extraction pipeline state
* taxonomy versions
* internal status identifiers

out of the default user experience.

If an existing debug/dev mode exists, place them there.

If no debug mode exists, keep them behind a deeply secondary development-only disclosure that is not rendered in normal production mode where practical.

Do not delete useful diagnostic data from the application architecture.

This task is about presentation and information hierarchy.

---

# EVIDENCE USED + LIMITATIONS

The current interface spreads provenance/limitations across:

* Evidence used
* Limitations
* Interpretation
* Technical details

Consolidate this where possible.

For ordinary users, prefer one section:

`Sources & limitations`

Possible contents:

* Product information came from the barcode database.
* Nutrition values were confirmed by you.
* Ingredient quantities cannot be inferred from ingredient order.
* No product-specific glycemic study was available.
* Sugar pAI does not predict individual glucose response.

Keep this section collapsed by default if appropriate.

Avoid repeating the same medical disclaimer in several different cards.

---

# CONTEXT LAYOUT

Do not let a very tall right-side Technical Details card produce large empty regions in the left column.

Avoid repeating the earlier Quick Add layout problem.

Recommended hierarchy:

1. Context header
2. Product summary
3. Smart Context
4. Interpretation / glycemic evidence
5. Sources & limitations
6. next-step/log action

Long supplementary information should generally become full-width/collapsible rather than forcing an unbalanced two-column grid.

Use:

`align-items: start`

Do not force equal-height columns.

Avoid unnecessary `min-height`.

---

# COPY STYLE

Audit the Review and Context screens for system/developer language.

Normal users should rarely need to see terms such as:

* deterministic rules
* taxonomy
* heuristic demo
* rule version
* vision extraction
* extraction pipeline
* raw ingredients
* model identifier

Prefer plain product language.

Do not dumb down clinically/safety-relevant distinctions.

Keep important concepts precise, especially:

* declared zero vs not declared
* ingredient presence vs ingredient quantity
* product-specific evidence vs heuristic inference
* inability to predict individual glucose response

The goal is clarity, not oversimplification.

---

# VISUAL DENSITY

Review should become significantly more compact.

Audit:

* card padding
* input spacing
* helper-text spacing
* repeated badges
* vertical gaps
* large blank rails
* heading height

Use the existing spacing scale where possible.

Approximate targets:

controls:
`44–48px`

card padding:
`20–24px`

normal row gap:
`12–16px`

major section gap:
`24–32px`

Do not solve layout problems with arbitrary fixed heights.

---

# ACCESSIBILITY

Preserve/improve:

* semantic form labels
* focus-visible states
* keyboard navigation
* error descriptions
* numeric input semantics
* expandable accordion semantics
* button vs non-button distinctions
* adequate text contrast

Do not use color alone to communicate:

* edited
* missing
* confirmed
* unavailable
* warning/error states

Interactive chips must actually behave as interactive elements.

Static guidance chips must not masquerade as buttons.

---

# DO NOT

Do not:

* redesign unrelated routes
* replace the Sugar pAI identity
* alter nutrition calculations
* alter evidence semantics just to simplify the UI
* fabricate glycemic evidence
* convert unavailable values to zero
* remove medical/safety limitations
* expose internal demo estimates as real evidence
* remove diagnostic data from the codebase if engineering still needs it
* introduce a new UI framework
* add a large dependency solely for styling
* overuse badges
* overuse warning yellow
* use giant empty sidebars
* make every card equal height
* make static text look clickable

---

# STATES TO VERIFY

Review stage:

1. Database-only product match
2. Product using uploaded Nutrition Facts image
3. Product using Nutrition + Ingredients images
4. Product using all three captured panels
5. All values untouched
6. One nutrition value edited
7. Multiple values edited
8. Explicit zero value
9. Not-declared value
10. Unavailable value
11. Ingredients untouched
12. Ingredients manually edited
13. No captured images
14. Captured evidence thumbnails present

Context stage:

1. Confirmed database-only evidence
2. Confirmed image-derived evidence
3. Ingredient context available
4. No tested product-specific glycemic evidence
5. Interpretation collapsed
6. Interpretation expanded
7. Sources/limitations collapsed
8. Sources/limitations expanded
9. Debug/development diagnostics if applicable
10. normal production mode without debug diagnostics

Workflow:

* Evidence → Review
* Review → Context
* Context → Log
* Edit evidence → Review
* Back to evidence
* browser back/forward if routing supports it

Verify that progress-step states are always correct.

---

# IMPORTANT WORKFLOW CHECK

Review should not request meal-consumption information.

If `Servings consumed` and `Meal` are currently rendered in Review, move their visible UI to the Log stage or the appropriate post-context logging stage while preserving existing data behavior.

The label-confirmation action should not depend on logging metadata unless there is a genuine business-rule requirement.

If a backend dependency makes this difficult, inspect the architecture carefully and decouple presentation from state storage rather than silently breaking functionality.

---

# FINAL QUALITY BAR

After the changes, the Review stage should feel:

* compact
* focused
* confidence-building
* easy to scan
* easy to correct
* finite

The Context stage should feel:

* useful
* educational
* transparent
* calm
* evidence-aware
* not like a developer console

A normal user should be able to understand the primary Review + Context flow without encountering implementation terms such as model names, taxonomy versions, heuristic fixture identifiers, or rule-engine versions.

Transparency should remain available, but it should be progressively disclosed.

Run the existing relevant:

* formatter
* lint
* typecheck
* tests
* build

and fix regressions caused by your changes.

At completion, report:

1. files changed
2. components refactored
3. Review UX changes
4. Context UX changes
5. workflow/state changes
6. what technical information was moved behind progressive disclosure
7. any remaining issues you noticed but intentionally left unchanged


# Task 3:

Continue working on the existing Sugar pAI application.

Primary route:

`/sugar-pai/scan`

I want to add a new feature to the **Context stage after a packaged food has been scanned/reviewed/confirmed**:

## Evidence-aware companion food recommendations

The purpose is NOT to find a similar food and use its nutrients to fill missing values for the scanned product.

Instead, Sugar pAI should use what is actually known about the scanned food to recommend **other foods that could reasonably be eaten alongside it** to create a more balanced meal/snack context.

Examples:

* scanned crackers → suggest eggs, tuna, beans/monggo, vegetables, unsweetened yogurt, etc. when appropriate
* scanned bread → suggest eggs, peanut butter where appropriate, vegetables, protein-rich fillings
* scanned sweet snack → suggest a separate protein/fiber-rich accompaniment where appropriate

The system must remain conservative, transparent, and evidence-aware.

Do not redesign the route from scratch.

Preserve the existing Sugar pAI design language and previously implemented Review/Context polish.

---

# CORE PRODUCT PRINCIPLE

Maintain a strict separation between:

## A. Facts about the scanned product

These come from:

* confirmed package label
* exact barcode record
* user correction
* verified evidence already supported by Sugar pAI

and:

## B. Companion-food suggestions

These are separate foods that may complement the meal/snack.

A recommended companion food must NEVER be used to:

* fill missing nutrients of the scanned product
* alter the scanned product's nutrient values
* calculate missing fiber/sugar/protein for the scanned product
* imply the scanned food itself contains those nutrients
* silently change glycemic calculations for the scanned product

The scanned product remains exactly as evidenced.

---

# PRODUCT GOAL

The feature should answer:

**“What could I eat with this?”**

rather than:

**“What food is similar to this?”**

or:

**“How can we guess the missing nutrition values?”**

The recommendation should be based on gaps/context observable from the confirmed product.

Examples:

* carbohydrate present + low/unknown fiber → suggest a separate fiber-rich companion
* carbohydrate-forward snack + low protein → suggest a separate protein-containing companion
* ultra-processed packaged food → optionally suggest a minimally processed accompaniment
* sweet food → suggest a neutral protein/fiber-rich side rather than attempting to replace or condemn the food

Do not frame recommendations as food permission.

---

# FIRST: INSPECT THE EXISTING IMPLEMENTATION

Before editing code:

1. Locate the `/sugar-pai/scan` Context stage.
2. Locate the existing `Smart Context` rule engine.
3. Locate existing recommendations such as:

   * `Add a fiber anchor`
   * `Vegetable side`
   * `Beans or monggo`
   * `Chia or ground flax`
4. Locate the current food/catalog/product database used elsewhere in:

   * Estimated Meal
   * Pantry & Groceries
   * Recipes
   * quick-add foods
5. Determine whether there is already a reusable food-search/catalog abstraction.
6. Identify what nutrient information is trusted for generic/reference foods.
7. Identify current source/provenance infrastructure.
8. Reuse existing primitives rather than creating another unrelated recommendation system.

Before coding, summarize the architecture you found and then implement within it.

---

# IMPORTANT: DO NOT USE SIMILAR PRODUCTS TO COMPLETE NUTRITION DATA

Do not implement:

`scanned food missing fiber → similar cracker says 2 g → scanned food fiber becomes 2 g`

Do not store companion/reference nutrients in the scanned product nutrition object.

Do not let downstream calculations treat companion-food data as evidence for the scanned product.

Keep product evidence and recommendation data structurally separate.

Conceptually:

```ts
selectedProduct.confirmedNutrition
```

must remain independent from:

```ts
mealPairingSuggestions
```

If necessary, make the type separation explicit so accidental mixing is difficult.

---

# FEATURE NAME / USER LANGUAGE

Avoid a generic section called:

`Healthy foods`

because this creates simplistic good/bad-food framing.

Preferred user-facing labels include:

`Pair with`

`Meal pairing ideas`

`Build around this food`

or:

`Ways to round out this meal`

Preferred default:

## `Pair with`

Supporting text:

`Suggestions based on the label values you confirmed.`

Keep it concise.

---

# RECOMMENDATION PHILOSOPHY

Recommendations should answer a specific contextual need.

Each recommendation must have:

1. a companion food
2. a short reason
3. the evidence/context that triggered the recommendation
4. provenance for the companion-food information where relevant

Example:

`Boiled egg`

`Adds a separate protein source alongside this carbohydrate-forward snack.`

Not:

`Prevents a glucose spike.`

Example:

`Beans or monggo`

`Adds fiber and protein as a separate meal component.`

Not:

`Lowers the glycemic impact of this product by 38%.`

---

# DO NOT MAKE MEDICAL OUTCOME CLAIMS

Do not claim that a pairing:

* prevents a glucose spike
* lowers blood sugar
* controls diabetes
* guarantees slower absorption
* makes the scanned food safe
* neutralizes carbohydrates
* fixes a poor food
* prevents hyperglycemia

Prefer descriptive language.

Good:

`Adds a separate fiber-rich component.`

`Adds protein to the meal.`

`Provides a minimally processed side.`

`Adds vegetables without changing the values reported for the packaged food.`

Avoid:

`This will keep your glucose stable.`

---

# INPUT SIGNALS FOR RECOMMENDATIONS

Use only evidence already available to Sugar pAI.

Possible signals:

* serving size
* total carbohydrate
* dietary fiber
* protein
* total fat
* sugars
* added sugars
* ingredient context
* NOVA group
* product category
* meal/snack context if explicitly known
* user-confirmed product identity

Do not infer unavailable nutrient values.

If fiber is unknown, treat it as:

`unknown`

not:

`low`

unless other deterministic rules explicitly justify that statement.

Distinguish:

`fiber = 1 g`

from:

`fiber unavailable`

These should generate different explanations.

---

# RECOMMENDATION DIMENSIONS

Build companion recommendations around a small set of transparent dimensions.

Examples:

## Fiber companion

Examples may include:

* vegetables
* beans/monggo
* chia or ground flax
* whole fruit where contextually appropriate

Reason:

`Adds a separate fiber source.`

## Protein companion

Examples may include:

* egg
* fish
* chicken
* tofu
* unsweetened yogurt where applicable
* beans/monggo

Reason:

`Adds a separate protein source.`

## Minimally processed accompaniment

Examples:

* fresh vegetables
* whole fruit where appropriate
* eggs
* legumes

Reason:

`Adds a minimally processed component to the meal.`

## Meal completeness/context

Examples:

* vegetable side
* soup/vegetable dish
* protein filling
* unsweetened beverage

Keep recommendation categories flexible but understandable.

---

# DO NOT AUTOMATICALLY RECOMMEND ALL DIMENSIONS

Avoid turning every scan into:

* add fiber
* add protein
* add fat
* add vegetables
* add fruit
* drink water
* exercise

This creates recommendation spam.

Rank and display only the **1–3 most relevant companion suggestions**.

Preferred default:

2–3 recommendations maximum.

If there is no meaningful recommendation, render nothing or a restrained neutral state.

---

# RANKING MODEL

Use deterministic filtering/rules before any fuzzy or AI ranking.

The system should roughly work as:

1. Determine contextual need from confirmed evidence.
2. Determine eligible companion-food categories.
3. Retrieve candidates from a trusted food catalog.
4. Apply hard exclusions.
5. Rank remaining candidates.
6. Return a small diverse set.
7. Generate constrained explanatory copy from structured reasons.

Do not allow an LLM to freely invent foods or nutrition values.

---

# TRUSTED FOOD CATALOG

Companion foods must come from a known catalog/data source available to the application.

Examples could include:

* existing generic foods catalog
* existing Estimated Meal foods
* verified Open Food Facts entries where appropriate
* a curated Philippine food reference catalog
* other already-approved app data sources

Do not create arbitrary food names from model memory and pretend they are database records.

Every recommended food should either:

A. map to an actual known catalog item

or

B. belong to an intentionally curated generic-food vocabulary supported by the application

Examples of acceptable generic concepts if already curated:

* boiled egg
* plain white rice
* monggo
* vegetables
* tofu
* grilled fish

Do not fabricate precise nutrition numbers unless they come from the trusted underlying record.

---

# PHILIPPINE CONTEXT

Sugar pAI has a Philippine-oriented food experience.

Favor culturally relevant suggestions where appropriate.

Examples may include:

* monggo
* egg
* tofu/tokwa
* grilled fish
* vegetables
* fresh fruit
* plain yogurt if available in the catalog
* appropriate Filipino meal components already supported by the app

Do not force Western food suggestions when a familiar local equivalent exists.

Do not stereotype.

Use actual available catalog entries.

---

# HARD MATCHING / ELIGIBILITY RULES

Before ranking a companion food, apply deterministic safety and compatibility rules.

At minimum consider:

* correct food category
* food is actually a companion, not the same scanned product
* no duplicate variants of the scanned product
* no obviously contradictory recommendation
* serving information available if numeric nutrition will be shown
* allergen/user preference constraints if the application already stores them
* dietary restrictions if the application already supports them
* avoid suggesting foods known to conflict with explicit user constraints

If user-level allergy/preferences are not available, do not invent them.

---

# DO NOT USE “SIMILARITY” AS THE MAIN MATCH SIGNAL

A companion food often should be DIFFERENT from the scanned food.

Example:

crackers should not primarily recommend more crackers.

Bread should not primarily recommend another bread.

A sweetened beverage should not recommend a different sweetened beverage.

Optimize for complementarity rather than similarity.

---

# OPTIONAL MATCHING SCORE

If the architecture benefits from an internal recommendation score, keep it internal.

For example:

```ts
type PairingCandidate = {
  foodId: string
  reasonCodes: PairingReasonCode[]
  relevanceScore: number
  evidenceStrength: "high" | "moderate" | "low"
}
```

Do not show users meaningless numbers such as:

`87% match`

unless there is a validated interpretation of that percentage.

Prefer human explanations.

---

# STRUCTURED REASON CODES

Avoid unconstrained AI-generated rationale.

Prefer deterministic reason codes such as:

```ts
type PairingReasonCode =
  | "ADD_FIBER_SOURCE"
  | "ADD_PROTEIN_SOURCE"
  | "ADD_MINIMALLY_PROCESSED_COMPONENT"
  | "ADD_NON_STARCHY_VEGETABLE"
  | "MEAL_CONTEXT_COMPLEMENT"
```

Map these to controlled user-facing explanations.

This makes the recommendation system auditable and prevents unsupported claims.

---

# EXAMPLE

Suppose the confirmed scanned product is:

`SkyFlakes 25 g`

Confirmed evidence:

* Carbohydrate: 17 g
* Fiber: 1 g
* Protein: 3 g
* Total sugars: 2 g
* NOVA: 3
* ingredients include sugar

A good Context result might be:

## Pair with

`Boiled egg`

`Adds a separate protein source alongside the crackers.`

`Vegetable side`

`Adds a separate fiber-rich, minimally processed component.`

`Monggo`

`Adds fiber and protein as another meal component.`

Do NOT alter SkyFlakes' values.

Do NOT claim:

`SkyFlakes + egg has a low glycemic load`

unless the application actually has validated data and calculation rules supporting that exact statement.

---

# EXPLAIN WHY THE SUGGESTION APPEARED

Each recommendation should have a concise explanation.

Example:

`Vegetable side`

`Suggested because this serving contains 17 g carbohydrate and 1 g fiber.`

If the source value is unknown, do not state that it is low.

Instead:

`Fiber was not reported for this product. A separate vegetable side can add a known fiber-containing component to the meal.`

This is a crucial distinction.

---

# UNKNOWN DATA HANDLING

Unknown values remain unknown.

Examples:

If fiber is missing:

Do not say:

`This food is low in fiber.`

Say:

`Fiber is not reported for this product.`

If protein is missing:

Do not say:

`This food lacks protein.`

Say:

`Protein is not available from the confirmed label.`

Recommendations can still be framed cautiously:

`If you want a separate protein source, consider...`

---

# USER INTENT

Do not assume every user wants to modify their meal.

Present pairings as optional ideas.

Avoid:

`You should add...`

Prefer:

`Pairing idea`

`You could add...`

`If useful, consider...`

`Adds a separate...`

The user must remain in control.

---

# UI PLACEMENT

Place this feature inside the existing Context stage.

Recommended hierarchy:

1. Product Summary
2. Smart Context
3. Processing context / NOVA
4. Ingredient context
5. **Pair with**
6. External metadata / Nutri-Score
7. Sources & limitations

The exact ordering can be adjusted if the current Context design has a better semantic structure.

The pairing feature should be a useful part of Smart Context, not the entire page.

---

# RECOMMENDATION CARD DESIGN

Keep the existing Sugar pAI visual system.

Each recommendation should be compact.

Possible card:

`Boiled egg`

`Protein pairing`

`Adds a separate protein source alongside this snack.`

Optional:

`Add to estimated meal`

if this action can be implemented using existing meal-component functionality.

Do not create giant food photography cards unless the application already has a relevant visual system.

Prefer text/icon/card hierarchy.

---

# OPTIONAL ACTION: ADD TO MEAL

If technically compatible with the existing architecture, allow a recommendation to be added as a separate meal component.

Possible CTA:

`Add to meal`

or:

`Use this pairing`

But it MUST be stored as another food.

It must not modify the scanned food's nutrition facts.

Example state:

```ts
meal.components = [
  {
    type: "scanned_product",
    productId: "skyflakes..."
  },
  {
    type: "generic_food",
    foodId: "boiled-egg"
  }
]
```

not:

```ts
skyflakes.protein += egg.protein
```

The meal calculator may later combine components using existing legitimate meal aggregation logic.

---

# IMPORTANT DISTINCTION: PRODUCT ANALYSIS VS MEAL ANALYSIS

Sugar pAI should maintain two conceptual layers.

## Product Context

`SkyFlakes contains 17 g carbohydrate per confirmed serving.`

## Meal Context

`SkyFlakes + boiled egg + vegetable side`

may be analyzed as multiple separate components if the existing meal engine supports it.

Do not blur these.

If a pairing is added, clearly transition from:

`Product context`

to:

`Meal context`

when combined calculations are shown.

---

# NO FAKE COMBINED GLYCEMIC CLAIMS

Do not calculate or claim an improved glucose response merely because protein/fiber/fat foods were added.

Do not create:

`Estimated spike reduced by 32%`

`New GI: 41`

`Improved glucose score`

unless a validated, existing model explicitly supports such outputs.

Descriptive meal composition is acceptable.

Example:

`Meal now includes a separate protein source and a vegetable component.`

---

# NUTRITION DATA FOR COMPANION FOODS

If actual companion-food nutrition data is available from a trusted source, it may be shown.

Example:

`Boiled egg`

`Approx. 6 g protein per reference serving`

ONLY if:

* a specific source record exists
* serving basis is known
* the value comes from that record
* provenance is retained

Label this as information for the companion food.

Never merge it into the scanned product's evidence.

If reliable data is unavailable, omit the numeric value.

The recommendation can still exist at the food/category level if the catalog explicitly classifies the food appropriately.

---

# PROVENANCE

Maintain source information for recommended foods.

Examples:

`Food reference: Sugar pAI food catalog`

`Source: USDA`

`Source: Philippine food composition table`

`Source: Open Food Facts`

Use whatever sources are actually configured in the application.

Do not claim a source that is not present.

Detailed provenance may be progressively disclosed.

---

# CONFIDENCE / EVIDENCE QUALITY

If useful, maintain an internal confidence level.

Examples:

`high`

* curated food category
* verified nutrient record
* clear recommendation rule

`moderate`

* broad generic food match
* incomplete companion nutrition

`low`

* ambiguous food identity

Do not show low-confidence suggestions by default.

If candidate confidence is below the chosen threshold:

render no recommendation rather than a dubious one.

Quality over coverage.

---

# DIVERSITY

Avoid recommending three near-identical foods.

Bad:

* boiled egg
* scrambled egg
* fried egg

Better:

* boiled egg
* vegetable side
* monggo

Choose recommendations across useful categories when possible.

---

# RANKING EXAMPLE

For a carbohydrate-forward packaged snack with low confirmed fiber:

Preferred candidates might score higher if they:

1. contribute a separate protein or fiber category
2. are minimally processed
3. are common as meal/snack companions
4. fit Philippine eating patterns
5. have reliable catalog data
6. are distinct from one another

Do not simply rank by highest protein/fiber number.

Practical compatibility matters.

---

# NOVA

NOVA may contribute to recommendation context but must not independently determine that a food requires correction.

For example:

NOVA 4 may justify showing:

`Processing context`

but should not automatically trigger:

`You need a healthy food to cancel this out.`

Avoid compensatory or moralizing framing.

A minimally processed companion may be suggested when other context supports it.

---

# NUTRI-SCORE

Do not use Nutri-Score as the primary recommendation engine.

A scanned product's Nutri-Score should not directly determine:

* whether companion recommendations appear
* whether the food is healthy/unhealthy
* whether a specific pairing is required

Nutri-Score remains secondary external metadata.

---

# NO GOOD / BAD FOOD LANGUAGE

Avoid:

* good food
* bad food
* healthy vs unhealthy product
* guilt-free
* cheat food
* diabetes-friendly
* diabetic-safe
* forbidden
* compensate for
* fix this food
* cancel out carbs

Prefer:

* meal balance
* separate fiber source
* separate protein source
* minimally processed component
* meal pairing
* companion food
* meal context

---

# EMPTY STATE

If Sugar pAI cannot confidently identify appropriate companions:

Do not manufacture recommendations.

Show something like:

`No specific pairings suggested`

`Sugar pAI only shows pairings when there is enough confirmed food context.`

Keep this small and neutral.

---

# OPTIONAL “VIEW MORE”

Default to 2–3 recommendations.

If more good candidates exist:

`View more pairings`

may reveal additional options.

Do not create an endless recommendation feed.

---

# TECHNICAL ARCHITECTURE

Prefer an architecture similar to:

```ts
type PairingContext = {
  productId: string
  confirmedNutrition: ConfirmedNutrition
  productCategory?: string
  novaGroup?: number
  ingredientFlags: IngredientFlag[]
}

type PairingSuggestion = {
  foodId: string
  displayName: string
  category: string
  reasonCodes: PairingReasonCode[]
  source?: FoodSource
  evidenceStrength: "high" | "moderate"
}
```

The pairing engine should return structured suggestions.

UI copy should primarily be derived from structured reasons rather than unconstrained generated prose.

Do not copy companion nutrients into:

```ts
confirmedNutrition
```

---

# ALGORITHM ORDER

Preferred sequence:

```text
Confirmed scanned-product evidence
        ↓
Determine recommendation needs/context
        ↓
Generate allowed companion categories
        ↓
Retrieve real catalog candidates
        ↓
Apply hard filters
        ↓
Rank for complementarity + relevance
        ↓
Deduplicate/diversify
        ↓
Return top 2–3
        ↓
Render controlled explanation
```

Do not use:

```text
LLM prompt
   ↓
"Give me healthy foods"
   ↓
Display arbitrary answers
```

---

# AI / LLM ROLE

If an LLM is used at all, constrain it.

Good uses:

* reranking already valid candidates
* selecting concise wording from approved reason codes
* resolving simple food-name synonyms within a safe catalog

Bad uses:

* inventing foods
* inventing nutrient numbers
* inventing medical reasoning
* creating glucose claims
* bypassing deterministic candidate filters

All displayed foods must resolve to approved catalog entities before rendering.

---

# TEST CASES

Test at minimum:

## Packaged crackers

* known carbohydrate
* low confirmed fiber
* known protein

Expected:
reasonable fiber/protein companion suggestions.

## Bread

Expected:
protein/fiber-compatible meal additions rather than another bread.

## Sweet beverage

Expected:
do not recommend another beverage merely because it is similar.

## High-protein packaged food

Expected:
do not automatically recommend additional protein solely because the rule exists.

## Fiber unknown

Expected:
copy says fiber is unknown, not low.

## Added sugars unknown

Expected:
do not assume high or zero.

## NOVA 4 product

Expected:
processing context may appear, but recommendations remain evidence-based and non-moralizing.

## Product with sparse database data

Expected:
conservative suggestions or no suggestions.

## No trusted companion candidates

Expected:
no fabricated recommendation.

## Estimated Meal interaction

If a pairing can be added to an estimated meal:
ensure it becomes a separate component.

---

# UI QUALITY BAR

The feature should feel like:

`Here are a few practical things that could go with this food.`

Not:

`Our AI has judged your food and is telling you how to repair it.`

It should be:

* optional
* concise
* transparent
* culturally relevant
* evidence-aware
* non-moralizing
* visually secondary to confirmed product evidence

---

# EXAMPLE TARGET UI

Possible output:

### Pair with

`Boiled egg`
**Protein pairing**
Adds a separate protein source alongside this snack.

`Vegetable side`
**Fiber pairing**
Adds a separate vegetable and fiber-containing component.

`Monggo`
**Fiber + protein pairing**
Adds legumes as another meal component.

`Why these suggestions?`

Expanded:

`Based on the confirmed serving: 17 g carbohydrate, 1 g fiber, and 3 g protein. These suggestions do not change the nutrition values of the scanned product.`

Keep the actual wording concise and consistent with existing Sugar pAI copy.

---

# CRITICAL DISCLOSURE

Somewhere near the recommendation section, include a short explanation such as:

`Pairings are separate foods suggested from confirmed product context. They do not change or fill in the scanned product's nutrition values.`

Do not make this a giant warning banner.

A small info disclosure is enough.

---

# DO NOT

Do not:

* fill missing scanned-food nutrients using recommended foods
* use similar foods as hidden substitutes
* invent companion foods
* invent nutrition values
* invent serving sizes
* claim a pairing prevents a glucose spike
* calculate fake improved GI/GL
* label scanned foods bad/unhealthy
* label pairings diabetes-safe
* use NOVA as a food-permission score
* use Nutri-Score as the pairing engine
* show low-confidence recommendations to increase coverage
* show arbitrary LLM-generated foods
* alter unrelated routes

---

# IMPLEMENTATION PRIORITY

Prioritize in this order:

1. strict data separation
2. trusted candidate retrieval
3. deterministic recommendation reasons
4. hard filtering
5. ranking/diversity
6. UI implementation
7. optional add-to-meal integration
8. progressive provenance/explanation

Do not start with decorative UI before the recommendation model is safe and structurally correct.

---

# AFTER IMPLEMENTATION

Run the project's existing:

* formatter
* lint
* typecheck
* unit tests
* integration tests
* build

Add tests specifically ensuring:

1. companion nutrients never mutate scanned-product nutrients
2. unknown product nutrients remain unknown
3. recommendation candidates resolve to known catalog entries
4. filtered/invalid candidates do not render
5. low-confidence recommendations are suppressed
6. recommendation explanations derive from actual evidence states
7. `0` and `unknown` remain semantically distinct
8. adding a pairing creates a separate meal component
9. no recommendation produces unsupported glucose-response claims

At completion, report:

* files changed
* recommendation architecture
* candidate data sources used
* hard filters implemented
* ranking strategy
* reason codes
* UI components added/changed
* how product evidence is kept separate from companion-food data
* how unknown nutrients are handled
* how add-to-meal works if implemented
* remaining limitations


# Task 4: NOVA Group and Nutri-Score

Continue working on the existing Sugar pAI web application.

Route:

`/sugar-pai/scan`

This task specifically concerns the **Context stage that appears after Review/label confirmation**.

I want to add two pieces of product metadata:

1. **NOVA processing group**
2. **Nutri-Score**

These metrics have different roles and must NOT be presented as equivalent scores.

The goal is to add them in a way that fits the existing Sugar pAI evidence hierarchy, visual system, and diabetes-focused safety principles without turning the page into a generic food-rating dashboard.

Do not redesign the route from scratch.

Preserve the UI/UX improvements already made to:

* Identify
* Evidence
* Review
* Context
* product summary
* Smart Context
* progressive disclosure
* source provenance
* technical/debug separation

---

# FIRST: INSPECT THE CURRENT IMPLEMENTATION

Before changing code:

1. Locate the Context-stage components in `/sugar-pai/scan`.
2. Locate the product data model populated from the Open Food Facts/local product database.
3. Determine whether NOVA and Nutri-Score already exist in the data model.
4. Look for fields equivalent to:

   * `nova_group`
   * `nova_groups`
   * `nova_groups_tags`
   * `nutriscore_grade`
   * `nutriscore_score`
   * current/legacy Nutri-Score fields
5. Determine how missing/null/unknown values are currently represented.
6. Identify the existing components used for:

   * Product Summary
   * Smart Context
   * ingredient/context flags
   * provenance/source labels
   * information cards
   * collapsible sections
7. Reuse the existing design system and components wherever practical.

Do not duplicate data that is already normalized elsewhere.

If these values are already stored under differently named fields, use the existing canonical representation rather than creating another source of truth.

---

# IMPORTANT PRODUCT PRINCIPLE

NOVA and Nutri-Score are **not interchangeable**.

They must occupy different levels in the interface.

## NOVA

NOVA is processing-level context.

It may be relevant to the way Sugar pAI explains:

* processing level
* food structure
* ingredient formulation
* ingredient context

Therefore NOVA belongs inside or immediately adjacent to:

`Smart Context`

## Nutri-Score

Nutri-Score is a general nutrition-quality classification supplied by an external/community database.

It is NOT:

* Sugar pAI's diabetes score
* Sugar pAI's glycemic score
* a prediction of glucose response
* a food-permission score
* a replacement for carbohydrate evidence

Therefore Nutri-Score belongs in a visibly secondary:

`External metadata`

or:

`Community database metadata`

area.

---

# SAFETY / CLAIMS REQUIREMENTS

Do not write user-facing copy claiming that:

* NOVA directly predicts glucose response
* NOVA 4 necessarily causes a glucose spike
* ultra-processing automatically means high glycemic response
* Nutri-Score predicts diabetes suitability
* Nutri-Score indicates whether a person with diabetes should eat a product
* a favorable Nutri-Score means glycemically favorable
* an unfavorable Nutri-Score means glycemically unfavorable

Sugar pAI should present these classifications as **context**, not medical conclusions.

Prefer language such as:

`Processing level is one piece of food context and does not predict your individual glucose response.`

Avoid language such as:

`Ultra-processed foods digest rapidly and spike glucose.`

The latter is too deterministic for a product-level consumer UI.

---

# DATA INTEGRITY

Never infer NOVA or Nutri-Score from the product's ingredients or macros in the UI layer.

Use only an explicit value supplied by the application's trusted product-data source.

If no NOVA value exists:

* show `Not available`, or
* omit the NOVA block if that produces a cleaner UX

If no Nutri-Score exists:

* show `Not available`, or
* omit the metadata row/card

Do not calculate a replacement score.

Do not silently substitute another classification.

Do not convert unknown into a default group/grade.

---

# NOVA GROUP MAPPING

Support the four standard NOVA groups in the presentation layer.

Map the numeric value to human-readable text:

`1 — Unprocessed or minimally processed foods`

`2 — Processed culinary ingredients`

`3 — Processed foods`

`4 — Ultra-processed foods`

Prefer a concise main presentation:

`NOVA 4`

`Ultra-processed`

rather than displaying a long sentence as the primary value.

The full explanation may appear below or in an info popover/disclosure.

If the backend stores strings/tags rather than a number, normalize them through a reusable helper.

Do not scatter NOVA string mappings across multiple components.

Create/reuse one canonical formatter such as:

`formatNovaGroup(...)`

if appropriate to the existing architecture.

---

# NOVA UI PLACEMENT

Add NOVA to the **Smart Context** hierarchy.

Do not place it in the top-level nutrient summary beside carbohydrate/sugar/fiber values, because it is not a nutrient measurement.

Preferred hierarchy:

Product Summary

↓

Smart Context

* actionable/contextual insight
* NOVA processing context
* ingredient flags/context

↓

External metadata

* Nutri-Score

NOVA should feel meaningful but not dominant.

---

# NOVA CARD / ROW

Use the existing Smart Context card language.

Possible presentation:

`PROCESSING CONTEXT`

`NOVA 4 · Ultra-processed`

Supporting copy:

`NOVA describes the extent and purpose of food processing. Processing level is one piece of food context and does not predict your individual glucose response.`

If ingredient/context flags exist, they may appear nearby.

For example:

`NOVA 4 · Ultra-processed`

`Ingredient context`

`Maltodextrin`
`Glucose syrup`
`Modified starch`

However, do not imply that every NOVA 4 product necessarily contains those ingredients.

Only show ingredient flags that the existing ingredient-analysis system actually detected.

---

# NOVA VISUAL TREATMENT

Do NOT turn NOVA into a red/yellow/green health score.

Avoid:

* traffic-light health judgments
* giant warning badges
* “bad” labels
* thumbs-up/thumbs-down
* danger icons merely because the product is NOVA 4

Prefer a neutral informational presentation.

For example:

small neutral badge:

`NOVA 4`

text:

`Ultra-processed`

optional info icon.

The classification itself is sufficient.

If an amber or accent treatment already exists for contextual information, use it subtly and consistently.

Do not make NOVA 4 look like an application error or medical warning.

---

# NOVA INFO DISCLOSURE

Provide a concise explanation through an info icon, expandable disclosure, tooltip, or helper text depending on existing components.

Suggested user-facing content:

`About NOVA`

`NOVA classifies foods by the extent and purpose of processing, from minimally processed foods (Group 1) to ultra-processed products (Group 4). It provides processing context rather than predicting your glucose response.`

Keep it concise.

Do not place a long academic explanation directly in the main Context flow.

---

# INGREDIENT FLAGS + NOVA

NOVA and ingredient flags can visually belong to the same Smart Context area, but do not conflate them.

Example:

`PROCESSING CONTEXT`

`NOVA 4 · Ultra-processed`

Then:

`INGREDIENT CONTEXT`

`Sugar`
`Maltodextrin`
`Modified starch`

Only show ingredient flags already supported by the existing analysis logic.

Do not invent flags from the NOVA category.

NOVA must not become a trigger that fabricates ingredient conclusions.

---

# NUTRI-SCORE

Add Nutri-Score as **secondary external metadata**.

Do not place it inside Sugar pAI's primary Smart Context recommendation card.

Use a section/card/row labeled something like:

`EXTERNAL FOOD DATABASE`

or:

`COMMUNITY DATABASE METADATA`

Preferred presentation:

`Nutri-Score`

`Grade D`

Supporting source:

`Open Food Facts`

Supporting explanation:

`A general nutrition-quality classification. It is not a diabetes or glucose-response score.`

This separation is important.

---

# NUTRI-SCORE VISUAL HIERARCHY

Nutri-Score must visually rank below:

* confirmed carbohydrate values
* confirmed sugar values
* fiber
* serving basis
* Smart Context
* ingredient evidence
* NOVA processing context

It should not look like Sugar pAI's main verdict.

Do NOT put a giant `A`, `B`, `C`, `D`, or `E` next to the product name.

Do NOT put it in the main top Product Summary metrics row.

Do NOT call it:

`Health score`

`Food score`

`Diabetes score`

`Glycemic score`

Use:

`Nutri-Score`

and preferably:

`Grade D`

rather than simply displaying an unexplained letter.

---

# NUTRI-SCORE COLORS

Be careful with color.

The existing Sugar pAI UI intentionally avoids simplistic “good food / bad food” framing.

Therefore do not make the Nutri-Score grade dominate the page with a large green-to-red traffic-light treatment.

If the application already includes an official Nutri-Score presentation component and its use is appropriate, preserve its official semantics.

Otherwise prefer a restrained neutral badge/card where the grade is readable but does not overpower the evidence hierarchy.

For example:

`Nutri-Score · D`

with a small external-data/source treatment.

The user should not interpret the card as Sugar pAI recommending or rejecting the food.

---

# NUTRI-SCORE EXPLANATION

Add concise contextual copy.

Suggested text:

`Nutri-Score summarizes general nutritional composition. It is not designed to predict glucose response or diabetes suitability.`

Optionally expose more detail through:

`About Nutri-Score`

Do not place a long critique of the Nutri-Score algorithm in the main UI.

The application does not need to argue with Nutri-Score.

It only needs to establish its scope.

---

# SOURCE PROVENANCE

Both metrics should clearly expose their source.

If values originate from Open Food Facts/local mirrored Open Food Facts data, show:

`Source: Open Food Facts`

or equivalent existing provenance UI.

Do not present these values as calculated by Sugar pAI unless they actually are.

The UI should make the distinction clear:

Sugar pAI calculates/interprets its own evidence where applicable.

NOVA/Nutri-Score are imported classification metadata.

---

# EXTERNAL METADATA COMPONENT

If appropriate to the current architecture, create a reusable component such as:

`ExternalProductMetadata`

Possible contents:

* Nutri-Score
* source
* potentially other future external database fields

Do not over-engineer.

If only one simple row is required, reuse an existing metadata component.

The main goal is to keep community/external metadata visually separate from Sugar pAI's own contextual analysis.

---

# SUGGESTED CONTEXT PAGE STRUCTURE

Target approximately:

## Product Summary

`SkyFlakes 25 g`

Carbohydrate
`17 g`

Total sugars
`2 g`

Added sugars
`0 g`

Fiber
`1 g`

`Edit evidence`

---

## Smart Context

Existing useful contextual guidance.

Example:

`Add a fiber anchor`

Existing evidence-aware explanation.

---

### Processing context

`NOVA 3 · Processed`

`NOVA describes processing level and does not predict your individual glucose response.`

Optional:

`Learn about NOVA`

---

### Ingredient context

Existing detected ingredient flags/context.

Example:

`Sugar detected`

`Sugar appears 6th in the ingredient list. Ingredient order confirms presence but does not reveal grams.`

---

## External metadata

`Nutri-Score`

`Grade C`

`Source: Open Food Facts`

`A general nutrition-quality classification. It is not a diabetes or glucose-response score.`

---

## Sources & limitations

Existing progressive disclosure.

---

# AVOID THIS STRUCTURE

Do NOT create:

`GLYCEMIC SCORE`

`NOVA SCORE`

`NUTRI-SCORE`

as three equivalent side-by-side scores.

That falsely implies they measure comparable things.

Do not create a “score dashboard.”

Sugar pAI should remain evidence-first.

---

# DO NOT REINTRODUCE DEMO GLYCEMIC DATA

A previous UI version exposed internal/demo information such as:

* heuristic demo GI
* experimental GL estimates
* taxonomy versions
* rule versions
* model identifiers

Do not reintroduce those items simply because NOVA and Nutri-Score are being added.

If Sugar pAI has a legitimate production glycemic-load calculation based on confirmed user/product data, preserve its existing implementation.

But do not invent or expose demo/fallback glycemic estimates in order to visually accompany NOVA or Nutri-Score.

NOVA and Nutri-Score should work independently from any unavailable product-specific glycemic evidence.

---

# MISSING DATA STATES

Test these cases:

### NOVA available / Nutri-Score available

Show both in their proper hierarchy.

### NOVA available / Nutri-Score missing

Show NOVA normally.

Omit Nutri-Score or display a subtle:

`Nutri-Score not available`

Do not leave a large empty card.

### NOVA missing / Nutri-Score available

Do not infer NOVA.

Show Nutri-Score only in external metadata.

### Both missing

Do not create a large empty metadata section.

The page should collapse cleanly.

---

# DATA NORMALIZATION

Create reusable presentation helpers where necessary.

Examples:

`getNovaPresentation(value)`

returns something like:

```ts
{
  group: 4,
  label: "Ultra-processed"
}
```

`formatNutriScoreGrade(value)`

should normalize:

* uppercase/lowercase
* missing values
* unexpected values

Only accept expected Nutri-Score grades:

`A`
`B`
`C`
`D`
`E`

Handle unknown/missing safely.

Do not render malformed database values directly into the UI.

---

# ACCESSIBILITY

For NOVA and Nutri-Score:

* do not rely on color alone
* include textual grade/group labels
* provide adequate contrast
* ensure info/disclosure controls are keyboard accessible
* give icons accessible labels where required
* use semantic buttons for expandable explanations
* do not make static badges focusable/clickable unless they perform an action

---

# RESPONSIVENESS

Desktop is the current visual priority, but preserve existing responsive behavior.

On desktop:

* NOVA may live inside the Smart Context stack
* external metadata may appear as a compact secondary card/row
* avoid creating a new tall right sidebar solely for metadata

On narrow widths:

* cards should stack naturally
* labels should not truncate important grade/group text
* source text may wrap cleanly

Do not use fixed heights.

---

# VISUAL POLISH

Match existing Sugar pAI styling.

Use:

* existing cream surfaces
* mint/green accents
* subtle neutral borders
* existing serif/sans typography hierarchy
* restrained card radius
* existing spacing scale

Avoid:

* giant badges
* gradients
* excessive colored pills
* traffic-light dashboards
* prominent red for NOVA 4 or Nutri-Score E
* excessive warning yellow
* score gauges
* progress circles
* star ratings

This should feel like evidence metadata, not gamification.

---

# USER-FACING COPY

Prefer concise language.

### NOVA

Primary:

`NOVA 4 · Ultra-processed`

Secondary:

`NOVA describes the extent and purpose of food processing. It does not predict your individual glucose response.`

### Nutri-Score

Primary:

`Nutri-Score · Grade D`

Secondary:

`A general nutrition-quality classification from Open Food Facts. It is not a diabetes or glucose-response score.`

Avoid stronger medical claims.

---

# OPTIONAL INFO DISCLOSURES

If the current UI has an existing accordion/info component, provide:

`About NOVA`

and optionally:

`About Nutri-Score`

Do not create large explanatory sections unless expanded by the user.

Keep the default Context screen compact.

---

# TEST WITH THE EXISTING SKYFLAKES PRODUCT

Use the existing SkyFlakes/database-match workflow as one test case.

Verify:

* product confirmation
* Review
* Context
* NOVA rendering if present
* Nutri-Score rendering if present
* source provenance
* missing-data handling

Do not hard-code SkyFlakes values into UI components.

Use actual data returned by the existing product model.

---

# ALSO TEST

Test at least:

1. NOVA 1
2. NOVA 2
3. NOVA 3
4. NOVA 4
5. missing NOVA
6. Nutri-Score A
7. Nutri-Score B
8. Nutri-Score C
9. Nutri-Score D
10. Nutri-Score E
11. missing Nutri-Score
12. invalid/unexpected Nutri-Score value
13. both classifications present
14. neither classification present
15. product with ingredient flags
16. product without ingredient flags

Make sure no missing state causes:

* empty giant cards
* `undefined`
* `null`
* malformed tags
* raw API values
* broken layout

---

# IMPORTANT INFORMATION HIERARCHY

Maintain this ranking:

### Level 1 — Confirmed product evidence

Serving size

Carbohydrate

Sugars

Fiber

Ingredients

### Level 2 — Sugar pAI Smart Context

Contextual interpretation based on confirmed evidence

Ingredient context

NOVA processing context

### Level 3 — External/community metadata

Nutri-Score

Open Food Facts provenance

### Level 4 — Technical details

Debug/provenance information behind progressive disclosure or developer-only UI

Do not flatten these levels into one collection of equal-looking scores.

---

# DO NOT

Do not:

* make NOVA a glycemic score
* make Nutri-Score a glycemic score
* infer NOVA from ingredients
* calculate Nutri-Score in the frontend unless the application explicitly already does so
* fabricate missing values
* expose raw database tags
* show `undefined`
* make NOVA 4 automatically red/dangerous
* call Nutri-Score a health recommendation
* use either classification as food permission
* add prescriptive “eat / avoid” language
* claim either metric predicts an individual's glucose response
* reintroduce heuristic/demo GI estimates
* clutter the Product Summary with external metadata
* create another long right sidebar
* alter unrelated routes

---

# QUALITY BAR

When finished, the Context stage should communicate:

1. **What the package says**
2. **What Sugar pAI can contextualize from that evidence**
3. **How processed the product is according to NOVA**
4. **What ingredient-level context was detected**
5. **What external general-nutrition metadata exists**
6. **What cannot be concluded from these classifications**

A user should immediately understand that:

`NOVA 4`

does not mean:

`Sugar pAI says this food is bad`

and:

`Nutri-Score A`

does not mean:

`Sugar pAI says this food is good for diabetes`

The visual hierarchy and copy should make that distinction obvious without requiring the user to read a long disclaimer.

---

# AFTER IMPLEMENTATION

Run the existing relevant:

* formatter
* lint
* typecheck
* unit tests
* integration tests
* build

Fix regressions introduced by the changes.

Then report:

1. files changed
2. data fields used for NOVA
3. data fields used for Nutri-Score
4. normalization helpers added
5. Context components changed
6. missing-data behavior
7. accessibility changes
8. responsive changes
9. whether either value was unavailable in the existing test products
10. any data-quality issues discovered in the current product dataset

Do not claim the task is complete until both the UI and the missing-data states have been manually checked.



# Task 5: Snak Pairing UI

Continue working on the existing Sugar pAI web application.

Route:

`/sugar-pai/scan`

This is a deliberately **small, focused feature**.

I do NOT want to add a chatbot interface.

I want to take the type of answer Sugar pAI can currently produce conversationally for:

`What could go well with this snack?`

and render that information directly inside the **Context UI** after the user has scanned and confirmed a packaged food.

For example, with the currently selected product:

`SkyFlakes 25 g`

Sugar pAI currently has confirmed evidence such as:

* carbohydrate: 17 g
* fiber: 1 g
* total sugars: 2 g
* added sugars: 0 g
* sugar alcohols: not declared / unavailable
* protein: 3 g
* fat: 5 g
* ingredients available from the confirmed product record

The existing evidence may not contain product-specific research saying exactly what should be paired with SkyFlakes.

However, supporting nutrition/snack literature may support general companion-food ideas such as:

* peanut butter
* yogurt
* cheese
* whole fruit

I want that translated into a polished **UI feature**, not a chat response.

---

# FIRST: INSPECT THE EXISTING APP

Before editing code:

1. Locate the Context stage of `/sugar-pai/scan`.
2. Locate the existing `Smart Context` section.
3. Locate the confirmed product object/state used after Review.
4. Locate existing source/evidence/provenance components.
5. Locate any current web/research evidence retrieval functionality used by Sugar pAI.
6. Determine whether the application already stores structured citations or evidence records for contextual claims.
7. Reuse the existing design system and evidence architecture.

Do not build a second parallel research system if one already exists.

Do not redesign unrelated parts of the route.

---

# FEATURE TO IMPLEMENT

Add a new Context UI section named:

## `Pair with this snack`

For a confirmed snack/product, this section should present approximately **3–4 evidence-supported companion food ideas**.

Example for SkyFlakes:

### Peanut butter

`Adds a separate protein- and fat-containing component to the snack.`

### Plain yogurt

`Adds a separate protein-rich component.`

### Cheese

`Adds a separate protein-containing accompaniment.`

### Whole fruit

`Adds a separate whole-food and fiber-containing component.`

These are examples.

Do not hard-code SkyFlakes-specific pairings directly into the component unless they come from a reusable recommendation/evidence configuration.

---

# IMPORTANT PRODUCT BOUNDARY

The pairing section must remain completely separate from the scanned product's confirmed nutrition values.

Do NOT:

* add peanut butter nutrients to SkyFlakes
* fill missing SkyFlakes nutrients using another food
* change SkyFlakes carbohydrate/fiber/protein values
* imply that SkyFlakes itself contains nutrients from the pairing
* silently recalculate the product's nutrition facts

The product remains:

`SkyFlakes 25 g`

with only its own confirmed evidence.

The new section simply answers:

`What could I eat alongside this?`

---

# THIS IS NOT A CHATBOT

Do not create:

* chat bubbles
* conversation history
* user/assistant message UI
* text prompt input
* AI typing indicators
* conversational response cards

This feature belongs directly in the normal Context page.

It should feel like part of the existing Sugar pAI analysis.

---

# RECOMMENDED PLACEMENT

Place the new section after the most important Smart Context explanation and before lower-priority external metadata / Sources & Limitations.

Preferred Context hierarchy:

1. Product Summary
2. Smart Context
3. Processing / ingredient context
4. **Pair with this snack**
5. External metadata such as Nutri-Score
6. Sources & limitations

Do not create another tall right-hand sidebar.

Keep the section in the main content flow.

---

# UI DESIGN

Use a compact card consistent with the existing Sugar pAI design.

Suggested structure:

`PAIR WITH THIS SNACK`

# `A few ideas to have alongside it`

Supporting text:

`These are general pairing ideas based on the confirmed product context and supporting nutrition evidence.`

Then 3–4 compact recommendation items.

Example:

---

`Peanut butter`

**Protein + fat**

`Adds a separate protein- and fat-containing component alongside the crackers.`

---

`Plain yogurt`

**Protein**

`Adds a separate protein-containing snack component.`

---

`Whole fruit`

**Whole-food side**

`Adds a separate whole-food and fiber-containing component.`

---

Do not make these huge cards.

Prefer a compact grid or stack.

Desktop:

2-column grid if it fits cleanly.

Narrow/mobile:

single-column stack.

---

# COPY STYLE

Do not use chat-style wording such as:

`The provided evidence does not specify what items pair well with SkyFlakes. However...`

That is technically cautious but poor product UX.

Instead use concise UI language.

Preferred:

`Pair with this snack`

`A few general pairing ideas supported by snack and satiety research.`

Then show the foods.

Include a small qualification:

`These suggestions are general food pairings, not product-specific clinical recommendations.`

Do not turn this into a giant warning banner.

---

# DO NOT CALL THEM “HEALTHY FOODS”

Avoid labels such as:

`Healthy recommendations`

`Healthier foods`

`Good choices`

`Better foods`

`Diabetes-friendly foods`

`Safe for diabetes`

Keep the language neutral.

Use:

`Pair with`

`Companion ideas`

`Snack pairing`

`Add alongside`

This avoids good-food/bad-food framing.

---

# DO NOT CLAIM GLUCOSE OUTCOMES

Do not say:

* prevents glucose spikes
* lowers blood sugar
* stabilizes glucose
* reduces the glycemic impact of SkyFlakes
* makes this snack safe
* offsets the carbohydrates
* neutralizes the snack

Unless Sugar pAI has direct validated evidence for a specific claim, do not make it.

Use descriptive statements instead:

`Adds a separate protein source.`

`Adds a whole-food component.`

`Adds fiber from another food.`

`May support satiety as part of a snack.`

If using a satiety claim, ensure it is supported by the evidence source used.

---

# EVIDENCE MODEL

The UI should distinguish between:

## Product evidence

Example:

`SkyFlakes 25 g`

`17 g carbohydrate`

`1 g fiber`

This comes from the confirmed product record.

and:

## Supporting pairing evidence

Example:

research discussing:

* protein-containing snacks
* yogurt
* cheese
* fruit
* peanut butter
* satiety/snack composition

Do not pretend the supporting research studied SkyFlakes specifically unless it actually did.

---

# SOURCE PROVENANCE

Each pairing does not need a large academic citation immediately underneath it.

Instead, add a subtle control:

`Why these suggestions?`

or:

`Evidence for these pairings`

When expanded, show the supporting sources in a compact evidence list.

For example:

`Supporting evidence`

* Research discussing protein-containing snack options including peanut butter, yogurt, and cheese
* Research discussing fruit and yogurt as common snack components
* Research on higher-protein snacks and satiety

Use the existing source/citation UI if one exists.

Do not expose long raw article excerpts.

Do not dump an academic abstract into the page.

---

# SOURCE STRENGTH

If the existing Sugar pAI evidence system has evidence-strength labels, reuse them.

For example:

`Product evidence · Strong`

for the confirmed label.

and:

`Supporting evidence · Moderate`

for general snack literature.

Do not label a general study as strong evidence for the exact scanned product.

The evidence UI should make clear:

`general supporting evidence`

rather than:

`validated pairing for SkyFlakes`

---

# INITIAL RECOMMENDATION SET

For the current snack use case, the implementation should be capable of showing categories such as:

* peanut butter
* plain yogurt
* cheese
* whole fruit

Potentially other appropriate items may be added later.

For the first version, keep the recommendation set intentionally small.

Do not create a giant food recommendation catalog as part of this task.

---

# IMPORTANT: ONLY SHOW RELEVANT PAIRINGS

Do not show every option for every product.

Use simple deterministic rules based on the selected product/context.

For example, a snack-like carbohydrate product may be eligible for:

* protein-containing companion
* whole-food/fiber companion

If the selected product already strongly represents one category, avoid redundant recommendations.

Example:

If the scanned product itself is yogurt, do not recommend yogurt.

If it is peanut butter, do not recommend peanut butter.

If it is cheese, do not recommend cheese.

Keep the first implementation simple and deterministic.

---

# PRODUCT TYPE / CONTEXT

Determine whether the existing product record provides useful category information.

If the product is reasonably identifiable as:

* cracker
* biscuit
* snack
* bread
* cereal-type snack

then the pairing section may appear.

If the product category is completely unknown and no safe pairing rules apply:

do not fabricate recommendations.

Either omit the section or show:

`No specific pairing ideas available for this product yet.`

Keep this state subtle.

---

# NO FREEFORM LLM INVENTION

Do not ask an LLM:

`What healthy foods go with this?`

and render its freeform answer directly.

The feature should use a controlled set of allowed pairings and evidence-backed reason text.

A simple structure is preferred.

For example:

```ts
type PairingOption = {
  id: string
  label: string
  category: "protein" | "whole_food" | "fiber" | "mixed"
  eligibleProductCategories: string[]
  rationale: string
  evidenceIds: string[]
}
```

The implementation does not need to use exactly this type.

Fit it into the existing architecture.

The important requirement is:

**Displayed pairing foods and claims must be controlled and traceable.**

---

# EXAMPLE RULE

Conceptually:

```ts
if (
  product.category === "cracker" ||
  product.category === "snack_cracker"
) {
  candidates = [
    "peanut-butter",
    "plain-yogurt",
    "cheese",
    "whole-fruit"
  ]
}
```

Then remove:

* duplicates
* the selected product itself
* unsupported candidates
* candidates lacking evidence configuration

Do not hard-code logic directly into UI JSX if a reusable rule/config layer is appropriate.

---

# EVIDENCE CONFIGURATION

Pairing recommendations should link to structured supporting evidence.

Example conceptual configuration:

```ts
{
  id: "plain-yogurt",
  label: "Plain yogurt",
  rationale: "Adds a separate protein-containing component.",
  evidenceIds: [
    "snack-protein-options-study",
    "healthy-snack-education-study"
  ]
}
```

This allows Sugar pAI to explain why the suggestion exists without inventing a new claim on every render.

---

# CURRENT SUPPORTING EVIDENCE

The existing conversational response referenced general evidence along these lines:

1. Research discussing snack options including:

   * peanut butter
   * protein items
   * yogurt
   * cheese
   * fruit

2. Research discussing adequate snack examples including:

   * fruit
   * yogurt
   * dried fruit

3. Research on higher-protein snacks and satiety.

If these sources already exist in Sugar pAI's research/evidence layer, reuse them.

If they do not, inspect the application's existing method for storing/citing web evidence before adding them.

Do not hard-code article text into the component.

Store/reuse only the source metadata and concise supported proposition needed by the UI.

---

# UI EXAMPLE

For SkyFlakes, target something visually similar to:

---

`PAIR WITH THIS SNACK`

## A few ideas to have alongside it

`Peanut butter`
`Protein + fat`
Adds a separate protein- and fat-containing component.

`Plain yogurt`
`Protein`
Adds a separate protein-containing snack component.

`Cheese`
`Protein`
Adds a separate protein-containing accompaniment.

`Whole fruit`
`Whole-food side`
Adds a separate whole-food and fiber-containing component.

`Why these suggestions?`

Small note:

`General pairing ideas based on the confirmed product context and supporting nutrition evidence. They do not change the nutrition values of SkyFlakes.`

---

Do not literally use ASCII borders.

Use the existing Sugar pAI card system.

---

# VISUAL HIERARCHY

Do not make the pairing section more visually important than:

* confirmed product values
* Smart Context
* major evidence limitations

It is useful guidance, not the core evidence record.

Avoid:

* giant green CTA panels
* red/green rating systems
* food photography carousels
* large illustration cards
* “AI recommends” banners
* sparkles everywhere
* excessive badges

Keep it calm and editorial.

---

# OPTIONAL INTERACTION

If easy to implement with the existing architecture, each food card may have:

`Add to meal`

BUT ONLY if this already integrates naturally with Estimated Meal.

If implementing `Add to meal` creates significant scope or state complexity, do not implement it in this task.

The pairing suggestions themselves are the priority.

---

# DO NOT MODIFY SCANNED PRODUCT VALUES

Add explicit regression protection.

The pairing feature must never mutate:

* serving size
* carbohydrate
* total sugars
* added sugars
* fiber
* protein
* fat
* sugar alcohols
* ingredients
* NOVA
* Nutri-Score

of the confirmed scanned product.

Recommendation state must be independent.

---

# MISSING PRODUCT DATA

The feature should tolerate incomplete product evidence.

Do not say:

`This product is low in fiber`

when fiber is unknown.

Do not say:

`This product needs more protein`

when protein is unknown.

The initial version does not need to generate nutrient-gap claims at all.

It can simply provide general snack companion ideas based on product category/context.

This is intentionally safer and simpler.

---

# V1 SCOPE

Keep version 1 deliberately small.

Implement:

1. `Pair with this snack` section
2. 3–4 controlled recommendation options
3. concise rationale for each
4. general supporting evidence/provenance
5. deterministic eligibility rules
6. graceful empty state
7. no mutation of scanned-product evidence

Do NOT implement in this task:

* personalized nutrition
* allergy personalization unless already available
* dynamic web search on every page load
* AI-generated food recommendations
* meal optimization
* glucose-spike predictions
* missing-nutrient imputation
* complex ranking models
* hundreds of foods
* recommendation percentages
* recommendation scoring UI

This should be a polished, trustworthy V1.

---

# RESPONSIVE DESIGN

Desktop is the current visual priority.

Use approximately:

2 columns of pairing cards on desktop

1 column on narrow/mobile layouts

Allow content height to size naturally.

Do not create fixed-height cards just to make all recommendations equal.

Do not create a new sidebar.

---

# ACCESSIBILITY

Ensure:

* food names are normal text headings
* expandable evidence control uses a semantic button
* expanded/collapsed state uses correct ARIA attributes
* cards do not pretend to be clickable if they are not
* evidence links have understandable labels
* focus states use existing application conventions
* color is not required to understand pairing type

---

# TEST CASES

Test at minimum:

### SkyFlakes / cracker snack

Expected pairing candidates may include:

* peanut butter
* plain yogurt
* cheese
* whole fruit

### Yogurt product

Do not recommend yogurt itself.

### Peanut butter product

Do not recommend peanut butter itself.

### Cheese product

Do not recommend cheese itself.

### Unknown product category

Do not fabricate pairings.

Gracefully omit the section or display a restrained empty state.

### Missing nutrient fields

Pairings should still render if category/context is sufficient.

Do not infer missing nutrients.

### Context navigation

Verify:

Review → Context

Context → Edit evidence → Context

Pairing section should update if the selected product changes.

---

# QUALITY BAR

The finished experience should feel as if Sugar pAI has answered:

`What could go well with this snack?`

without requiring the user to open a chat.

It should communicate:

**Here are a few reasonable things you could have alongside this food, and here is the general evidence supporting those ideas.**

It should NOT communicate:

**Our AI has medically optimized your meal.**

The feature should feel:

* helpful
* concise
* evidence-aware
* optional
* calm
* trustworthy
* integrated with Sugar pAI

---

# AFTER IMPLEMENTATION

Run the project's existing:

* formatter
* lint
* typecheck
* tests
* build

Add/update tests covering:

1. SkyFlakes shows eligible pairings
2. selected food is never recommended as its own pairing
3. unknown category does not generate invented suggestions
4. recommendation evidence IDs resolve correctly
5. scanned-product nutrition remains unchanged
6. expanded evidence UI works
7. responsive layout does not break
8. no recommendation makes unsupported glucose-response claims

Then report:

* files changed
* where the pairing rules live
* pairings included in V1
* evidence sources/configuration used
* Context UI component added/modified
* empty-state behavior
* tests added
* any limitations intentionally left for a later version
