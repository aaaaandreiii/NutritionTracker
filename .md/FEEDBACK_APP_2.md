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

