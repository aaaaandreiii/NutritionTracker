Feedback 1:

That said, for **Sugar pAI specifically**, these are the improvements I would prioritize for the mobile and desktop experience.

### Mobile: this should be your highest priority

Sugar pAI should feel almost like a native mobile app rather than a desktop interface squeezed onto a phone.

The biggest thing I would focus on is the **question/input area**. Keep it sticky near the bottom when the user is reading an answer, but make sure it moves correctly when the phone keyboard opens. A common problem with AI interfaces is the composer getting hidden behind the iOS/Android keyboard or taking up too much vertical space. Use `100dvh` rather than relying only on `100vh`, and account for `env(safe-area-inset-bottom)`.

I would also avoid trying to show **answer + sources/evidence + contextual controls simultaneously** on a phone. Let the AI response own most of the screen. Evidence can become something like:

**Sources · 4** / **View evidence**

which opens a bottom sheet or expandable section. This will make Sugar pAI substantially less visually busy.

Your evidence/source cards should also become simpler on mobile. Think:

**[favicon] Website name**
Article title
Short supporting excerpt
↗

rather than several metadata fields squeezed into a narrow card.

For Sugar pAI's primary controls, make the *tap area* generous even if the icon itself stays small. Apple recommends roughly 44×44 pt hit areas, while Material recommends 48×48 dp for touch targets. ([Apple Developer][2]) This particularly matters for source buttons, copy, regenerate, thumbs up/down, expand, close, history, and send.

Another thing I would test carefully is **very long AI responses**. Don't let the user lose the input box completely after scrolling for several screens. Consider a compact floating “Ask follow-up” control that returns them to the composer.

### Desktop: use the additional space rather than simply making everything wider

For desktop, I would strongly recommend a **two-column Sugar pAI layout** once there is an answer:

```text
┌───────────────────────────────────────────────────────────────┐
│ Sugar pAI                                                     │
├──────────────────────────────────────┬────────────────────────┤
│                                      │                        │
│ AI response                          │ Evidence / Sources     │
│                                      │                        │
│ readable width ~680–800px            │ ~300–380px             │
│                                      │                        │
│                                      │                        │
├──────────────────────────────────────┴────────────────────────┤
│ Ask a follow-up…                                      Send   │
└───────────────────────────────────────────────────────────────┘
```

This is much better than stretching paragraphs across the entire screen. Even on a 1440px or 1920px display, the answer itself should retain a comfortable reading width.

The right evidence panel could be **sticky**, so selecting citations in the answer updates/highlights the relevant source without forcing users to scroll back and forth.

If a citation in Sugar pAI looks like `[1]`, tapping/clicking it should ideally **highlight its matching evidence card**. Conversely, hovering over a source on desktop could softly highlight where it is referenced in the answer. That would make the “evidence” part of Sugar pAI feel like an actual product feature rather than simply links appended to an AI answer.

### The empty state deserves more attention

Before someone asks their first question, don't leave Sugar pAI looking like a mostly empty chatbot.

Make the initial state communicate three things very quickly:

**What it is:**
“Ask Sugar pAI”

**Why it's different:**
“Get answers backed by evidence and relevant context.”

**What I can ask:**
Give 3–4 useful suggestion chips.

For example, suggestion prompts should be **actual actions/questions**, not category labels:

> Summarize the strongest evidence about…
> Compare the evidence for…
> Explain this topic in simple terms…
> What sources support this claim?

On mobile, those chips can horizontally scroll rather than being compressed into tiny buttons.

### Make “Evidence” visually different from the AI's own explanation

This is particularly important for your product because **evidence appears to be part of Sugar pAI's identity**.

I'd create three clear visual levels:

**AI answer** → normal content
**Citation** → subtle inline numbered indicator
**Original evidence** → separate, unmistakably source-derived card

Don't let quoted evidence look like something Sugar pAI itself wrote. The source name/domain, article/document title, and evidence excerpt should have distinct hierarchy.

You could also add a tiny label such as:

**Supporting evidence**
**Contradicting evidence**
**Background source**

if your system understands those relationships. That would differentiate Sugar pAI from a standard “AI + links” interface.

### The response controls can probably be quieter

AI apps often accumulate too many icons beneath every answer: copy, regenerate, like, dislike, share, source, retry, etc.

For Sugar pAI, I would keep perhaps:

**Copy · Sources · More**

and put secondary actions into the `More` menu.

On desktop, they can appear on hover/focus. On mobile, keep the important ones visible because hover doesn't exist.

Also make icon-only controls accessible with proper labels. Material specifically recommends accessible labels for icon buttons as well as adequate target size. ([Material Design][3])

### Loading should show what Sugar pAI is doing

Rather than only showing a generic spinner such as:

> Thinking…

you have an opportunity to communicate the product's value:

> Understanding your question…
> Finding relevant context…
> Checking supporting evidence…
> Preparing your answer…

I wouldn't animate dozens of steps, though. A subtle 2–3 stage status is enough.

This is especially useful if responses take several seconds because the delay then feels connected to the evidence-generation process rather than feeling like the site has frozen.

### Handle awkward states explicitly

Sugar pAI should have designed states for:

**No evidence found** — don't show an empty sources container.

**Only one weak source** — communicate the limitation rather than making one source look equivalent to strong evidence.

**Very long URLs/titles** — truncate gracefully.

**Very long questions** — let the input grow to perhaps 4–6 lines before becoming internally scrollable.

**Network/API error** — keep the user's question and provide a clear Retry button.

**Regeneration** — don't suddenly jump the entire page to another vertical position.

**Streaming response** — don't constantly resize side panels while tokens appear.

These small behaviours often matter more to perceived quality than another visual effect.

### Responsive breakpoints: don't think only “mobile” and “desktop”

I would design Sugar pAI around approximately four layout modes rather than one breakpoint:

**< 600px:** single-column mobile; evidence opens underneath/in a sheet.
**600–900px:** tablet/small laptop; single column or collapsible evidence drawer.
**900–1200px:** two-column layout, moderately narrow evidence panel.
**> 1200px:** centered app shell with capped width rather than endlessly expanding.

The transition around **tablet / small laptop sizes** is especially important. 768–1024px tends to reveal layouts that look fine on phones and desktops but awkward in between.

### One thing I'd strongly consider adding: “focus mode”

For longer Sugar pAI answers, give users a way to temporarily collapse navigation/evidence and just read:

**☰  Sugar pAI                      Sources (6)**

Then the content fills the central reading area.

On mobile this can happen automatically; on desktop it could be optional.

### Visual polish

Try to keep the number of borders low. AI interfaces can quickly turn into “a card inside a card inside another card.”

I would use **spacing and background tone before borders** to communicate hierarchy. Keep stronger borders for interactive/focused elements and important evidence distinctions.

Similarly, reserve your strongest brand/accent treatment for **Send / primary actions / active selections / citation interaction**. If everything has the same strong accent, nothing feels primary.

### If I were prioritizing your next changes

My order would be:

1. **Mobile answer + composer + keyboard behaviour**
2. **Mobile evidence as a drawer/bottom sheet rather than competing with the answer**
3. **Desktop answer/evidence two-column layout**
4. **Cap response line length on large monitors**
5. **Make citations interact with evidence cards**
6. **Improve the first-use/empty state**
7. **Simplify answer action buttons**
8. **Design loading, error, no-evidence and long-content states**
9. **Audit 44–48px touch targets on mobile** ([Apple Developer][2])
10. **Test 375px, 430px, 768px, 1024px, 1440px and ~1920px widths**

The **biggest opportunity for Sugar pAI**, in my view, is making the *evidence interaction* feel genuinely integrated. If clicking a statement immediately shows **why Sugar pAI said it, which source supports it, and the exact relevant passage**, that becomes much more memorable than simply having a polished AI chat window.

Feedback 2:
Yes — seeing the actual desktop screens changes the feedback quite a bit. The overall visual direction is cohesive and the flow is understandable, but there are several places where the desktop experience can become **denser, clearer, and more task-oriented** without losing the editorial Sugar pAI aesthetic.

The biggest desktop issue is that the interface sometimes feels like **a narrow application floating inside a very large webpage**, rather than a purpose-built scanning/review workspace.

## 1. Compress the top of the page substantially

This is probably the first thing I would change.

You currently have:

* global SugarpAI branding/navigation
* tagline underneath
* a large gap
* another Sugar pAI feature header
* Scan / Today / History / About
* then finally the task itself

On a laptop, that is consuming a lot of vertical space before the user gets to the actual work.

In the first screenshot, roughly the upper quarter of the viewport is essentially application chrome.

I would reduce this:

```text
SugarpAI V2      Sugar pAI | Dashboard | Pantry | Recipes        Profile

────────────────────────────────────────────────────────────────

[Scan]  Today  History  About
```

And remove/reduce the second repeated:

> Sugar pAI
> Label evidence and Smart Context
> RESEARCH MVP

The user already knows they're inside Sugar pAI from the selected global navigation item.

Alternatively, retain the secondary header but make it compact and sticky.

**Desktop target:** I would try to get the actual Scan content starting around 120–160px from the top of the browser instead of ~250px.

---

# 2. The initial barcode screen is visually attractive, but the right half is too large

This is the strongest example of unnecessary desktop space.

The giant dark barcode area looks good as a composition, but functionally it is mostly showing:

> barcode graphic
> database match
> number

It takes almost half of your primary card.

That space would be more useful for information about the identified product.

For example:

```text
┌──────────────────────────┬──────────────────────────┐
│ Scan the barcode         │ Match found              │
│                          │                          │
│ [Open scanner] [Upload]  │ SkyFlakes 25g            │
│                          │ Philippines              │
│ Market                   │ 17g carbohydrates        │
│ [Philippines ▾]          │ 2g sugars                │
│                          │ NOVA 3                   │
│ Barcode                  │                          │
│ [0750515018402]          │ [Use this product →]     │
└──────────────────────────┴──────────────────────────┘
```

The barcode illustration could still appear, but at perhaps **25–35% of the panel**, rather than ~45–50%.

Right now the *least useful piece of information* is receiving the most visual weight.

---

# 3. Your hierarchy after a match could be much clearer

At present, the result appears underneath the barcode field:

> sky flakes 25g
> complete local Open Food Facts record...
> nutritional values...
> Use database match

It's easy to miss that something important has happened.

I would give the match a distinct state:

### ✓ Product found

**SkyFlakes 25g**
Monde / Philippines, if known

`17g carbs` `2g sugars` `1g fibre` `NOVA 3`

Then:

**Use database information →**

And perhaps a quieter secondary choice:

`Not this product`

This would make the scanning sequence feel much more explicit:

**Scan → Match → Confirm → Evidence**

rather than making the user infer the state from a card appearing.

---

# 4. Introduce a visible overall progress model

This is probably the biggest UX improvement you can make to the feature.

The workflow actually contains several meaningful stages:

```text
1  Identify product
2  Gather label evidence
3  Confirm extracted values
4  Review Smart Context
5  Log portion
```

But the current interface doesn't expose that structure.

The user sees:

> Scan
> Packaged label
> Nutrition Facts
> Ingredients
> Front label
> Analyse
> Confirm what the label actually says
> Smart Context
> Consumed portion

That's logically coherent once you understand the product, but initially it's a lot.

I'd add a very restrained progress indicator:

```text
Identify  ──  Evidence  ──  Review  ──  Context  ──  Log
   ✓              ✓           ●
```

It could sit immediately below the Scan / Today / History / About navigation.

That would also solve a future mobile UX problem.

---

# 5. The camera error modal needs more work

This stood out.

Currently the modal shows a very large black camera area containing:

> Camera access was denied or no camera is available.

Then it repeats almost exactly the same message in the red box below.

That is redundant.

More importantly, the user isn't given a useful recovery path.

Instead I would show:

### Camera unavailable

Camera permission was blocked in your browser.

**[Try camera again]**

or

**[Upload a barcode photo instead]**

Then perhaps:

> Safari: Settings → Websites → Camera → Allow

And keep a relatively small placeholder instead of the huge empty black rectangle when no stream is available.

Something closer to:

```text
┌───────────────────────────────────┐
│ Barcode scanner                × │
│                                   │
│        Camera unavailable         │
│                                   │
│  Allow camera access to scan      │
│  barcodes directly.               │
│                                   │
│  [Try camera again]               │
│  [Upload photo instead]           │
│                                   │
│  Having trouble? Camera settings  │
└───────────────────────────────────┘
```

The current modal visually looks like the scanner is still active even though it has failed.

---

# 6. The evidence-upload step is good, but desktop space is underused

I actually like the three-step structure:

1. Nutrition Facts
2. Ingredients
3. Front label

It's easy to understand.

However, each card is extremely wide relative to the amount of content inside it.

You have a lot of:

```text
Nutrition Facts panel


Description

[Use camera] [Choose image]



```

On desktop I would either reduce the width or introduce clearer image/status areas.

For example:

```text
┌─────────────────────────────────────────────────┐
│ ① Nutrition Facts                         REQUIRED
│ Capture the serving line and nutrient rows.
│
│ [Use camera] [Choose image]     No image yet
└─────────────────────────────────────────────────┘
```

After upload:

```text
│ [thumbnail] nutrition.jpg       ✓ Readable
│                                 [Replace]
```

That makes the card evolve visibly instead of remaining mostly empty.

---

# 7. Make the Analysis Setup panel sticky

Your right-hand:

> ANALYSIS SETUP
> Before upload
> blocking issues
> review notes
> Analysis service
> Analyze label

is exactly the kind of thing that benefits from `position: sticky`.

On desktop, I'd keep it visible while the user moves through Nutrition / Ingredients / Front Label.

Something like:

```css
position: sticky;
top: 24px;
```

adjusted for your persistent header.

Once analysis is available, this panel could turn into:

> **Ready to analyze**
> 3 / 3 evidence sources
> ✓ Nutrition
> ✓ Ingredients
> ✓ Front package
>
> **Analyze label →**

That would make it a real workflow controller rather than simply another card.

---

# 8. Don't make optional evidence look equally important

You already use:

> REQUIRED
> RECOMMENDED

which is good.

But visually, the three upload cards are nearly identical.

I'd increase the distinction:

**Nutrition Facts**
Required to continue

**Ingredients**
Required for ingredient/sweetener analysis

**Front label**
Optional — improves identification

The third card could be slightly quieter or collapsed by default:

> * Add front-of-package photo (optional)

This reduces apparent workload.

---

# 9. The review screen has too much introductory vertical space

This screenshot:

> REVIEW EVIDENCE
> Confirm what the label actually says.

looks elegant, but it behaves more like a marketing/editorial page than a productivity screen.

That heading is enormous relative to the form immediately underneath it.

Once someone is in this stage, they are completing a task.

I'd reduce:

> Confirm what the label actually says.

by roughly **25–35%**.

For example:

### Confirm the label

Review the extracted values before Sugar pAI uses them.

Much faster to scan.

The current line break:

> Confirm what the label
> actually says.

is visually beautiful, but consumes a lot of precious viewport space.

---

# 10. “READY” is disconnected from what it means

There is a little READY badge floating on the right side of the review intro.

I didn't immediately know:

* ready for what?
* is it clickable?
* is validation complete?
* is analysis complete?

I'd either remove it or make the state explicit:

**✓ Evidence ready**

or:

**Review status · Ready**

Preferably put it closer to the thing it describes.

---

# 11. The review form needs stronger distinction between “source” and “editable value”

This is especially important.

You currently show small pills such as:

> DATABASE MATCH

beneath/around fields.

That's useful provenance, but because it's very small and pale, it's easy to overlook.

I'd consider putting source information directly into the field:

```text
Serving size
┌──────────────────────┐
│ 25                g  │
└──────────────────────┘
Source: Database match
```

or:

```text
Serving size                    DATABASE
[ 25 ] [ g ]
```

Then when OCR was used:

`LABEL PHOTO`

and when edited:

`USER CONFIRMED`

This provenance model is one of the interesting things about Sugar pAI, so it should be more prominent.

---

# 12. The nutrient section is information-dense in the wrong places

The carbohydrate-first section is logically good.

However, individual nutrients currently have:

* label
* numeric field
* DATABASE MATCH
* explanatory sentence

repeated many times.

That generates a lot of visual noise.

You can reduce it considerably:

```text
Total carbohydrate                 17 g
Printed total carbohydrate             DATABASE

Dietary fibre        1 g    Total sugars       2 g
Added sugars         0 g    Sugar alcohols   Unknown
Protein              3 g    Total fat          5 g
```

Then make provenance inspectable or shown in smaller secondary text.

Right now almost every item demands similar visual attention.

---

# 13. “Unknown” is good product logic, but needs a better control

I noticed the Sugar alcohols field showing something like:

> Unknown

inside what visually resembles a number input.

That's semantically awkward.

If the value has three possible states:

* known numeric value
* not printed
* unknown/unavailable

I'd model that explicitly.

For example:

```text
Sugar alcohols
[ Not declared ▾ ]
```

Selecting “Declared on label” reveals the grams field.

That reduces the possibility of users accidentally interpreting unknown as zero, which is clearly something the rest of your interface is trying hard to avoid.

---

# 14. The right sidebar becomes too narrow for the amount of information you put in it

On the review screens, the content ratio is approximately:

**~68% main / ~32% side panel**

The ratio itself is fine.

The problem is how much detailed copy ends up in the sidebar:

* Vision details
* Glycemic evidence
* Interpretation
* Limitations

The text gets very small.

I would not make people read important evidence in ~11px text inside a narrow column.

One approach:

Keep only summary cards in the rail:

```text
Evidence
Database match
Nutrition photo
Ingredients photo

Interpretation
3 observations

Limitations
5 notes
```

Clicking/expanding reveals the fuller text in a drawer or the main column.

---

# 15. “Limitations” is currently visually overwhelming and simultaneously easy to ignore

Interesting contradiction here.

The Limitations card contains a lot of tiny text.

Because it's so dense, users are likely to skip it completely.

I would convert it into 3–5 readable statements.

For example:

### Limitations

* Open Food Facts data is community supplied.
* Ingredient rank does not provide ingredient quantity.
* Glycemic Load is an educational estimate, not a prediction.
* This analysis does not provide medical advice.

`View methodology & full limitations →`

That is more usable and arguably communicates the safety boundaries better.

---

# 16. Your Smart Context screen is visually one of the strongest parts

This is the section I would change the least.

The hierarchy is clear:

> Validated context rules

followed by several differentiated recommendations.

The pastel categorisation works well.

I particularly like that you are not just showing generic AI prose; each rule has:

* a type
* evidence/context
* suggested actions
* source

That is much closer to a useful research interface.

However, I would slightly increase the vertical hierarchy.

For example, currently:

> Add a fiber anchor

doesn't stand out dramatically more than the explanatory text.

I'd make the recommendation title perhaps 15–16px semibold and keep the body quieter.

---

# 17. Watch your use of tiny uppercase typography

You use this treatment everywhere:

> BARCODE LOOKUP
> ANALYSIS SETUP
> REVIEW EVIDENCE
> PRODUCT & SERVING
> PER LABELED SERVING
> INGREDIENT ORDER
> SMART CONTEXT
> CONSUMED PORTION

I like it stylistically.

But some of it is **very small and low contrast**, especially on the cream background.

I'd keep the style but increase either:

* font size by 1px,
* weight,
* contrast,

or some combination.

Same issue with helper copy and sidebar descriptions.

Your display typography is extremely readable; your microcopy isn't always.

---

# 18. There are too many visual “card boundaries”

You're using:

* page container
* section container
* card
* inner highlighted card
* pill
* field
* status pill

This occasionally leads to UI nesting like:

> card inside card inside bordered region inside large beige container

For example, the nutrient section's large green-highlighted carbohydrate card inside the overall nutrition card.

I'd remove roughly **20–30% of your borders** and use spacing/background shifts instead.

The interface will feel lighter and more premium.

---

# 19. Your primary action changes location too often

Across the flow the main thing the user needs to do appears in different places:

* scan buttons left
* Use database match at bottom of result
* Analyze Label in right sidebar
* presumably review/continue lower down
* consumed portion controls later

This creates some hunting.

I would establish a desktop convention:

> **Primary progression action always appears bottom-right / in sticky right rail.**

For example:

```text
Evidence
2 required items complete

[Analyze label →]
```

Then:

```text
Review
No blocking issues

[Continue to Smart Context →]
```

Then:

```text
Smart Context reviewed

[Log portion →]
```

Consistency makes a multi-step research workflow feel much easier.

---

# 20. Consider a sticky task rail rather than a traditional sidebar

I think this could suit Sugar pAI especially well.

Something like:

```text
                    ┌─────────────────────┐
                    │ PRODUCT             │
                    │ SkyFlakes 25g       │
                    │                     │
                    │ EVIDENCE            │
                    │ ✓ Database          │
                    │ ✓ Nutrition         │
                    │ – Ingredients       │
                    │                     │
                    │ STATUS              │
                    │ Ready               │
                    │                     │
                    │ [Continue →]        │
                    └─────────────────────┘
```

It gives the user persistent orientation.

The existing right-hand area is already very close to this concept.

---

# What I'd keep

There are several things I **wouldn't redesign just for the sake of redesigning them**.

The serif + utilitarian sans/monospace combination works very well for this product. The cream/green visual language feels deliberate rather than like a generic SaaS template. The information architecture around **evidence → confirmation → interpretation → Smart Context** is also much more interesting than a typical “scan a food and receive a score” interface.

I'd also keep the two-column desktop structure. The issue isn't the two columns; it's deciding **what deserves permanent presence in the narrower column**.

## My desktop priorities, in order

If you were implementing changes now, I'd do these first:

1. **Reduce the global + Sugar pAI header height significantly.**
2. **Add the overall Identify → Evidence → Review → Context → Log progression.**
3. **Reduce the huge barcode visual and use that space for useful matched-product information.**
4. **Make the right workflow/status panel sticky.**
5. **Improve the camera-denied recovery flow.**
6. **Reduce the giant review heading/intro spacing.**
7. **Simplify repetitive field provenance/helper text.**
8. **Make sidebar information readable rather than cramming long text into it.**
9. **Condense Limitations into readable bullets + details.**
10. **Increase contrast/size of the very small microcopy.**

If I had to choose only **three**, I'd pick **#1, #2 and #4**. Those changes would make the entire desktop application feel noticeably more mature without changing the overall aesthetic.

And now that I've seen the desktop flow, **send the mobile screenshots exactly as it currently behaves** — including any awkward overflow or wrapping. For mobile, I wouldn't simply recommend stacking these desktop cards; there are several parts of this workflow I'd restructure differently rather than just make narrower.


Feedback 3:
Yes. Seeing the full mobile flow, I think your instinct to simplify it toward a **Facebook/Instagram-style feed model is the right direction**.

The underlying Sugar pAI workflow is good. The problem is that mobile currently feels like **the desktop interface stacked vertically**, so the user spends a lot of time scrolling through structure, labels, status panels, and navigation before getting to the next meaningful action.

I would **not** literally copy Instagram visually. I would borrow its mobile interaction principles: one dominant content column, minimal persistent chrome, predictable cards, progressive disclosure, and one obvious action at a time.

## The biggest issue: almost half the first viewport is navigation

This is the most important thing to fix.

At the top you currently have:

* SugarpAI logo
* `V2`
* tagline
* Sugar pAI / Dashboard / Pantry & Groceries / Recipes
* Standard Daily Dozen selector
* sometimes another Sugar pAI feature header
* then the actual content
* plus Scan / Today / History / About permanently at the bottom

That is **a huge amount of persistent navigation for a phone**.

In some screenshots, the useful Sugar pAI content starts around halfway down the screen.

Instagram/Facebook work because after their compact top bar, **content begins almost immediately**.

### I would reduce the mobile header to something closer to:

```text
┌─────────────────────────────┐
│ Sugar pAI              ○  ⋯ │
└─────────────────────────────┘

[ Standard Daily Dozen ▾ ]

content begins
```

You don't need the full:

> SugarpAI V2
> Packaged-food evidence and Smart Context research

on every single screen.

That branding is useful on desktop/home, but once a user is actively scanning a product, it is expensive mobile real estate.

I'd make the logo/header perhaps **56–64px high maximum** after the first screen.

---

# I would remove the horizontal global navigation from the Sugar pAI mobile workflow

This row:

> Sugar pAI | Dashboard | Pantry & Groceries | Recipes

works reasonably on desktop.

On mobile, it is doing too much.

`Pantry & Groceries` already wraps to two lines, while Sugar pAI itself wraps. It visually resembles a desktop tab bar compressed into a phone.

I'd move those global destinations behind either:

* a profile/menu button, or
* an app-level bottom navigation if those four sections really are your four primary destinations.

Then keep Sugar pAI's own Scan / Today / History navigation inside the feature.

The important principle is:

> **Don't have two navigation systems visible simultaneously on mobile.**

Right now you effectively do.

---

# Your existing bottom navigation is much closer to the right mobile pattern

This:

```text
Scan       Today       History       About
```

is familiar and easy to understand.

I would probably keep this rather than the big navigation row at the top.

But I'd question whether **About** deserves one of four permanent bottom-nav slots.

For a utility users repeatedly use, something like:

```text
Scan       Today       History       More
```

may be more useful.

`About`, methodology, settings, research information, etc. can live under More.

---

# The bottom navigation is also too persistent during task completion

This is subtle.

Instagram's bottom navigation works because moving between tabs is usually harmless.

During your **multi-step label-review workflow**, however, Scan/Today/History/About remains visible while the person is halfway through editing nutrition evidence.

That invites accidental navigation away.

You could instead change its behavior while a scan session is active.

For example:

```text
‹ Back                     Step 3 of 5
```

or:

```text
Reviewing SkyFlakes                  ⋯
```

Then restore the normal bottom navigation when the workflow is complete.

At minimum, protect unsaved changes if the user leaves.

---

# The Scan screen should be dramatically simpler

The first mobile screen is currently attractive, but still feels like a large desktop hero converted to one column.

You have:

> BARCODE LOOKUP
> Scan the barcode
> explanatory paragraph
> Open live scanner
> Upload barcode photo
> giant barcode illustration
> market
> barcode input
> match card...

That's a long sequence.

For mobile, I'd make the first screen almost brutally simple:

```text
Scan a product

[      Open camera      ]

────────── or ──────────

[ Upload barcode photo ]

Enter barcode manually
[___________________]

Market: Philippines ▾
```

Then once a barcode is detected, **replace** that state with the product result rather than retaining the full introductory UI above it.

That's very Facebook/Instagram-like in the sense that the interface changes state rather than accumulating screens vertically.

---

# Don't keep the huge barcode visualization after a successful match

The mobile screenshot with:

> DATABASE MATCH
> 0750515018402

inside the large dark area is using a lot of scarce vertical space.

Once the barcode has done its job, you don't need to keep celebrating the barcode.

I'd transition immediately to:

```text
✓ Product found

SkyFlakes 25g
Philippines

17g carbs · 2g sugars · 1g fibre
NOVA 3

[ Use this product ]
Not the right product?
```

The barcode itself can be a small secondary detail.

---

# The scanner should become genuinely full-screen on mobile

Your scanner screenshot revealed another important issue.

When the scanner opens, the large page header remains visible and the scanning interface appears underneath/behind it.

On mobile, camera scanning should feel like a separate mode:

```text
┌─────────────────────────────┐
│ ×        Scan barcode       │
│                             │
│                             │
│         camera feed         │
│                             │
│        ┌───────────┐        │
│        │ barcode   │        │
│        └───────────┘        │
│                             │
│ Align UPC/EAN inside frame  │
│                             │
│      Upload instead         │
└─────────────────────────────┘
```

No site header. No global navigation. No bottom tab bar.

Just the camera.

Also use the full dynamic viewport and safe areas on iOS:

```css
min-height: 100dvh;
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

and lock background scrolling while it is active.

---

# Your photo collection screen is actually quite good on mobile

The Nutrition Facts / Ingredients cards translate better than several other sections.

But I'd simplify them further.

At the moment each one takes a large amount of vertical space:

> Nutrition Facts panel
> description
> Use camera
> Choose image

Then another almost identical block.

You could condense this into something much more feed-like:

```text
1  Nutrition Facts                         REQUIRED
   Serving size and nutrient rows
   [ Camera ]   [ Upload ]

2  Ingredients                             REQUIRED
   Ingredient list and sweeteners
   [ Camera ]   [ Upload ]

3  Front of package                        OPTIONAL
   Helps identify the product
   [ Add photo ]
```

After a successful photo:

```text
1  Nutrition Facts
   ✓ nutrition.jpg — readable
                     Replace
```

The entire card can shrink once completed.

That is important: **completed steps should consume less space, not the same space.**

---

# The Analysis Setup card shouldn't be a separate giant screen on mobile

This is one of the clearest places where the desktop sidebar was simply moved into the mobile content flow.

You currently get a full card containing:

> ANALYSIS SETUP
> Before upload
> 0 blocking issues
> 0 review notes
> Analysis service
> backend reachable
> ingredients warning
> Analyze label
> helper text

Most users do not need to see:

> Backend reachable at https://...

during the normal product workflow.

That's developer/status information.

I'd reduce the whole thing to:

```text
Ready to analyse

✓ Nutrition Facts
– Ingredients not provided
– Front image optional

Ingredient-specific insights will be limited.

[ Analyse label → ]
```

Then perhaps:

`Technical details`

as an expandable row.

The existing service-status card belongs much more naturally in a debugging/admin mode.

---

# The review experience is where mobile most needs redesign

This section is currently **far too long vertically**.

You have individual full-width fields for:

* product name
* serving size
* serving unit
* total carbohydrate
* fibre
* sugars
* added sugars
* sugar alcohols
* protein
* fat
* ingredients
* etc.

Each field includes significant spacing, explanation, and provenance.

So a user has to scroll through what feels like several screens of form fields before they reach the action.

This is where I'd abandon the desktop representation entirely.

### Think iOS Settings / Instagram edit screen rather than desktop form.

For example:

```text
Serving
────────────────────────
Product             SkyFlakes 25g  >
Serving               25 g         >

Nutrition
────────────────────────
Carbohydrate           17 g         >
Fibre                    1 g         >
Total sugars             2 g         >
Added sugars             0 g         >
Sugar alcohols       Unknown        >
Protein                  3 g         >
Fat                      5 g         >
```

Tap a row to edit it.

Then provenance can be secondary:

```text
Carbohydrate    17 g
Database match
```

This could reduce **multiple phone screens into approximately one to two screens**.

---

# Especially remove giant native inputs when users aren't actively editing

This:

```text
Dietary fiber
[                 1                 ]

As printed for the same serving.
DATABASE MATCH
```

is using perhaps 130–150px to communicate one number.

For an evidence review screen, you don't need the entire page to look permanently editable.

Display:

```text
Dietary fibre                         1 g
Database match
```

and make the row tappable.

When tapped:

```text
Dietary fibre

[ 1 ] g

Source: Database match

[Save]
```

That is much more mobile-native.

---

# The ingredient textarea is another desktop control that doesn't work well mobile

Your ingredients area becomes a huge textarea containing:

> *WHEAT* FLOUR, COCONUT OIL, VEGETABLE SHORTENING...

This occupies almost an entire viewport.

Most users probably aren't going to manually edit the whole string character by character.

I would show it as content:

```text
Ingredients

Wheat flour, coconut oil, vegetable
shortening (coconut oil, palm oil and
vitamin E...), iodized salt, sugar...

[View full ingredients]
[Edit]
```

Then open a full-screen editor only if they choose Edit.

---

# Your “feed” idea becomes especially powerful AFTER validation

This is where the Facebook/Instagram analogy makes the most sense.

You clarified that **Validated Context Rules only appears after pressing Validate corrections**.

That's good. I would actually lean into that much more.

Right now, after validation, the user continues down a massive document and eventually encounters:

> Glycemic Evidence
> Interpretation
> Smart Context
> Validated context rules

Instead, pressing:

**Validate corrections**

should create a clear state transition.

Something like:

```text
✓ Label validated

SkyFlakes 25g
1 serving · Snack

17g carbs
2g sugars
1g fibre

View reviewed evidence
```

Then immediately:

## Smart Context

followed by the cards.

In other words, **the post-validation screen should become the feed**.

---

# I'd separate “review mode” and “results mode”

This is probably my strongest recommendation for your mobile architecture.

Right now everything exists in one enormous vertical document:

```text
Scan
↓
Photos
↓
Review
↓
Evidence
↓
Interpretation
↓
Limitations
↓
Log
↓
Smart Context
```

Instead:

### Phase 1 — Capture

```text
Scan product
↓
Provide evidence
↓
Analyse
```

### Phase 2 — Review

```text
Confirm important extracted values
↓
Choose serving
↓
Validate
```

### Phase 3 — Results / feed

```text
Product summary

Glycemic evidence card

Smart Context card
Smart Context card
Smart Context card

Interpretation

Sources & limitations
```

Now mobile feels like an app, not a research report.

---

# The “Validated Context Rules” should probably become the main result

Your current terminology:

> SMART CONTEXT
> Validated context rules

is technically precise but doesn't quite sound like the thing the user has been waiting for.

Since this only appears after validation, give that moment more prominence.

Maybe:

### Smart Context

**Based on your validated label**

Then the feed:

```text
🌿 Add a fibre anchor
Your meal has 1g fibre with 17g carbohydrate.

[Vegetables] [Beans] [Chia or flax]

Source: University of Sydney
```

Next card:

```text
↕ Order the meal deliberately
Try vegetables, beans, or protein before
the higher-carb item.

[Vegetables first] [Protein first] [Carb later]

View evidence
```

etc.

That's already basically what your content contains — you mostly need to **remove the surrounding dashboard-like framing**.

---

# The Smart Context cards themselves are strong

These actually work pretty well on the phone.

The different cards for:

* Add a fibre anchor
* Order the meal deliberately
* Sugar names are present
* Optional post-meal movement

feel much more naturally mobile than the review forms.

I would mainly simplify the density inside each.

For instance, this part:

```text
Carbs 17g   Fiber 1g   GL 10.4 (yellow)
```

plus multiple action chips plus source plus category label can get busy.

I'd prioritize:

1. recommendation
2. why
3. suggested action
4. evidence link

And hide the technical metadata behind:

`Why am I seeing this?`

---

# Be careful with the GL card

The card showing:

> 10.4 Demo GL
> YELLOW DEMO BAND

gets a **very strong visual prominence**, despite your surrounding text saying that it is heuristic/demo information and not tested-product clinical evidence.

From a UX perspective, large numbers automatically look authoritative.

If this remains demo/heuristic data, I'd visually de-emphasize the number.

Instead of:

# 10.4

perhaps:

> **Estimated demo context: Yellow**

then:

`Demo GL estimate · 10.4`

with the limitations immediately accessible.

Once you have stronger validated evidence, then a big metric might make more sense.

---

# Interpretation is good content, but it shouldn't be a large feed card by default

I like your:

* What is printed
* What may influence response
* What cannot be determined

structure.

That's a very clear way of separating evidence from inference.

But on mobile I'd make it an accordion:

```text
About this interpretation

› What the label tells us
› What may influence response
› What cannot be determined
```

rather than taking another full viewport.

---

# Same for Vision Details

Your:

> CAPTURED PANELS
> VISION DETAILS
> Barcode
> Label extraction
> Ingredient read
> Vision model
> VLM
> Nutrition
> Ingredients
> Front

is useful for transparency, but it is **advanced evidence/debug information**.

For most mobile users:

```text
Evidence used
Database product record                    ✓

[View extraction details]
```

is enough.

Expand it only if requested.

This is an ideal application of progressive disclosure.

---

# Limitations should absolutely be collapsed on mobile

The current Limitations card becomes a wall of small text.

Users are unlikely to read it precisely because you're showing all of it.

Instead:

```text
ⓘ Important limitations

This analysis uses community food data and
educational estimates. It does not predict
individual glucose response.

[Read all limitations]
```

Then a bottom sheet with the full methodology/limitations.

This is **more responsible**, not less, because the critical limitation becomes readable.

---

# Your “Validate corrections” screen is almost exactly where I want the UI to go

This screenshot is actually one of the cleanest in the sequence:

> CONSUMED PORTION
> Validate, view Smart Context, then log locally
> Servings consumed
> Meal
> Validate corrections

It's focused.

I'd simplify the headline to:

### Ready to validate

**SkyFlakes 25g · 1 serving**

Meal
`Snack ▾`

Then:

**Validate & view Smart Context →**

That button copy is especially important because it answers the user's clarification:

> What happens after I validate?

Currently `Validate corrections` sounds like a technical operation.

If validation is the thing that generates/reveals the valuable Smart Context result, say so.

---

# Make the post-validation transition feel rewarding

When the button is tapped, don't just silently extend the existing page.

A small transition could say:

```text
✓ Label validated

Generating Smart Context…
```

then:

```text
Your Smart Context
SkyFlakes · 1 serving · Snack
```

followed by the recommendation cards.

That gives the workflow a satisfying **input → validation → result** structure.

Right now that payoff is somewhat hidden because the user is still inside one continuous page.

---

# A feed-style Sugar pAI mobile screen could look like this

I'd aim for something conceptually like:

```text
┌─────────────────────────────┐
│ Sugar pAI              ⋯    │
├─────────────────────────────┤
│ Standard Daily Dozen ▾      │
├─────────────────────────────┤

  SkyFlakes 25g
  1 serving · Snack
  ✓ Label validated

  17g carbs   2g sugar   1g fibre
  [View evidence]

┌─────────────────────────────┐
│ 🌿 Add a fibre anchor        │
│                             │
│ This meal has 1g fibre with │
│ 17g carbohydrate.           │
│                             │
│ Vegetables · Beans · Berries│
│                             │
│ University of Sydney    ↗   │
└─────────────────────────────┘

┌─────────────────────────────┐
│ ↕ Order the meal deliberately│
│ ...                         │
└─────────────────────────────┘

┌─────────────────────────────┐
│ 🏷 Sugar appears in ingredients│
│ ...                         │
└─────────────────────────────┘

   About this analysis       ›
   Evidence used             ›
   Limitations               ›

───────────────────────────────
 Scan       Today      History
```

That's the direction I would take.

---

# One more significant issue: browser chrome + your fixed bottom nav

Your screenshots are from iPhone Safari, and you can see how much vertical space is occupied by:

* Safari's bottom toolbar
* your own bottom navigation

That means the bottom ~150px of the screen can effectively become navigation.

It's not necessarily wrong, but it makes your oversized header at the top even more costly.

You should also test:

* Safari toolbar expanded
* Safari toolbar collapsed
* keyboard open
* standalone/PWA
* landscape

I'd hide or intelligently reposition the custom bottom bar while an input field is focused. Otherwise the numeric keyboard + browser chrome + app nav can leave very little usable space.

---

# What I would change first

If you're about to start simplifying this mobile version, I'd do it in this order:

1. **Collapse the enormous top navigation/header.**
2. **Remove the four-item desktop navigation row from the active Sugar pAI mobile workflow.**
3. **Keep one compact mobile nav system, not two.**
4. **Make barcode scanning full-screen.**
5. **Turn the Scan → Evidence → Review → Smart Context process into distinct states instead of one giant document.**
6. **Compress review fields into tappable list rows instead of giant always-visible inputs.**
7. **Make `Validate` explicitly lead to Smart Context.**
8. **After validation, switch to the feed-like results experience.**
9. **Collapse Vision Details, Interpretation, and Limitations.**
10. **Make Smart Context recommendations the star of the post-validation experience.**

So, yes: **I would absolutely move toward the feed idea — but specifically after validation.** Before validation, Sugar pAI should behave more like a compact step-by-step capture/review tool. After validation, it can transform into a clean evidence-backed feed of useful context cards.

That gives you the best of both models: **wizard-like when the user has work to do, feed-like when the user has results to consume.**