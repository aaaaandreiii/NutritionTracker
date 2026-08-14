import { expect, test } from '@playwright/test'

const viewports = [
  { width: 375, height: 812 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

const value = <T,>(entry: T | null, status = 'Database match') => ({
  value: entry,
  unit: typeof entry === 'number' ? 'g' : null,
  servingBasis: typeof entry === 'number' ? 'per database serving' : null,
  sourceKind: entry == null ? 'unavailable' : 'database',
  status: entry == null ? 'Unavailable' : status,
  evidence: null,
  confidence: entry == null ? null : 1,
  conflict: false,
  confirmed: status === 'User confirmed',
})

function analysisResult(status: 'ready' | 'confirmed') {
  const fieldStatus = status === 'confirmed' ? 'User confirmed' : 'Database match'
  return {
    analysisId: 'analysis-e2e', status, market: 'PH',
    product: { name: value('Nescafe Original', fieldStatus), brand: value('Nestlé'), barcode: value('4800361403764') },
    serving: { size: value(20, fieldStatus), unit: 'g', householdMeasure: null, servingsPerContainer: value<number>(null) },
    nutrients: {
      totalCarbohydrate: value(14, fieldStatus), fiber: value(0.34, fieldStatus), totalSugars: value(9.7, fieldStatus),
      addedSugars: value<number>(null), sugarAlcohols: value<number>(null), protein: value(0.27, fieldStatus), fat: value(3.4, fieldStatus),
    },
    rawIngredients: value('Sugar, coffee creamer', fieldStatus),
    sugarVariants: [{ rawSpan: 'Sugar', canonicalName: 'Sucrose', category: 'added sugar', ingredientRank: 1, evidence: null }],
    glycemic: { status: 'unavailable', testedFoodMatchDescription: null, matchLevel: null, gi: null, availableCarbohydrateGrams: null, gl: null, glBand: null, citation: null, licensing: null, reason: 'No sourced tested-product evidence is available.' },
    qualityChecks: [], validationChecks: [{ code: 'sugars', status: 'pass', message: 'Sugar arithmetic is plausible.' }], limitations: ['This tool does not predict individual glucose response.'], diagnostics: { visionModel: null, extractionStatus: 'skipped', fallbackReason: null, panels: {}, vlm: null }, retakeRecommended: false, retakeReasons: [],
    provenance: { pipelineVersion: 'e2e', completedAt: '2026-08-14T00:00:00Z', externalProcessors: ['Open Food Facts local database'] },
  }
}

const lookupPayload = {
  barcode: '4800361403764', market: 'PH', status: 'found', complete: true, missingFields: [],
  product: { barcode: '4800361403764', productName: 'Nescafe Original', brand: 'Nestlé', servingSize: 20, servingUnit: 'g', servingBasis: 'per database serving', nutrients: { totalCarbohydrate: 14, fiber: 0.34, totalSugars: 9.7, addedSugars: null, sugarAlcohols: null, protein: 0.27, fat: 3.4 } },
  ingredients: 'Sugar, coffee creamer', qualitativeMarkers: { novaGroup: '4 - Ultra processed food and drink products', novaGroupsTags: 'en:4-ultra-processed-food-and-drink-products', nutriscoreGrade: null, nutriscoreScore: null, allergens: 'Milk', allergensTags: 'en:milk', traces: null, tracesTags: null, categories: null, labels: null },
  sourceUrl: 'https://world.openfoodfacts.org/product/4800361403764', sourceKind: 'local_open_food_facts', message: 'A complete local Open Food Facts record is available for review.',
}

for (const viewport of viewports) {
  test(`Ask has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/#/sugar-pai/ask')
    await expect(page.getByRole('heading', { name: 'Ask the evidence.' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    if (viewport.width <= 768) {
      const navTargets = await page.locator('.mobile-nav button:visible').evaluateAll((buttons) => buttons.map((button) => {
        const rect = button.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }))
      expect(navTargets.every((target) => target.width >= 44 && target.height >= 44)).toBe(true)
    }
    await page.screenshot({ path: `test-results/screenshots/ask-${viewport.width}.png`, fullPage: true })
  })
}

test('streams an evidence answer, activates citations, opens the mobile sheet, and toggles focus mode', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  await page.route('**/api/v1/chat/stream', async (route) => {
    const request = route.request().postDataJSON()
    expect(request.question).toBe('What are added sugars?')
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"stage","stage":"retrieval","label":"Finding curated evidence"}\n\n',
        'data: {"type":"sources","sources":[{"id":"fda-added-sugars","index":1,"type":"curated","relationship":"supporting","strength":"strong","title":"Added Sugars on the Nutrition Facts Label","publisher":"U.S. Food and Drug Administration","domain":"fda.gov","url":"https://www.fda.gov/food/nutrition-facts-label/added-sugars-nutrition-facts-label","excerpt":"Added sugars are included within total sugars."}],"warnings":[]}\n\n',
        'data: {"type":"delta","text":"Added sugars are included within total sugars [1](#source-1)."}\n\n',
        'data: {"type":"done","finishReason":"complete"}\n\n',
      ].join(''),
    })
  })

  await page.goto('/#/sugar-pai/ask')
  const composer = page.getByPlaceholder('Ask an evidence question…')
  await composer.fill('What are added sugars?')
  await page.getByRole('button', { name: 'Send question' }).click()
  await expect(page.locator('.markdown-answer')).toContainText('Added sugars are included within total sugars')
  const citation = page.locator('.citation-link').first()
  await citation.click()
  await expect(page.locator('#source-1')).toHaveClass(/active/)
  await expect(page.locator('.evidence-rail')).toHaveClass(/open/)
  await page.screenshot({ path: 'test-results/screenshots/chat-evidence-sheet-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Close evidence' }).first().click()
  const fixedUi = await page.evaluate(() => {
    const composer = document.querySelector('.composer-dock')?.getBoundingClientRect()
    const nav = document.querySelector('.mobile-nav')?.getBoundingClientRect()
    return composer && nav ? { composerBottom: composer.bottom, navTop: nav.top } : null
  })
  expect(fixedUi && fixedUi.composerBottom <= fixedUi.navTop + 1).toBeTruthy()
  await page.getByRole('button', { name: 'Toggle focus mode' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/shell-focus-mode/)
  await page.screenshot({ path: 'test-results/screenshots/chat-stream-mobile.png', fullPage: true })
})

test('shows a complete barcode product summary and camera recovery', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
    })
  })
  await page.route('**/health', (route) => route.fulfill({ json: { status: 'ok' } }))
  await page.route('**/api/v1/off-products/**', (route) => route.fulfill({ json: lookupPayload }))

  await page.goto('/#/sugar-pai/scan')
  await page.getByPlaceholder('UPC / EAN digits').fill('4800361403764')
  await expect(page.getByRole('heading', { name: 'Nescafe Original' })).toBeVisible()
  await expect(page.getByText('NOVA context')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use this product' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Use camera' }).first().click()
  await expect(page.getByRole('button', { name: 'Retry camera' })).toBeVisible()
  await expect(page.getByLabel('Capture Nutrition panel').getByRole('button', { name: 'Choose image' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await page.screenshot({ path: 'test-results/screenshots/camera-recovery-mobile.png', fullPage: true })
})

test('moves from barcode match through dense review into validated results mode', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.route('**/health', (route) => route.fulfill({ json: { status: 'ok' } }))
  await page.route('**/api/v1/off-products/**', (route) => route.fulfill({ json: lookupPayload }))
  await page.route('**/api/v1/analyses/barcode', (route) => route.fulfill({ json: { analysisId: 'analysis-e2e', expiresInSeconds: 900, result: analysisResult('ready') } }))
  await page.route('**/api/v1/analyses/analysis-e2e/finalize', (route) => route.fulfill({ json: analysisResult('confirmed') }))

  await page.goto('/#/sugar-pai/scan')
  await page.getByPlaceholder('UPC / EAN digits').fill('4800361403764')
  await page.getByRole('button', { name: 'Use this product' }).first().click()
  await expect(page.getByRole('heading', { name: 'Confirm what the label actually says.' })).toBeVisible()
  await expect(page.getByPlaceholder('Not declared / unavailable').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/screenshots/review-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Validate corrections' }).click()
  await expect(page.getByRole('heading', { name: 'Your evidence, in context.' })).toBeVisible()
  await expect(page.locator('.results-product-summary')).toContainText('Not declared / unavailable')
  await expect(page.getByRole('button', { name: 'Save to Today' })).toBeVisible()
  await page.screenshot({ path: 'test-results/screenshots/results-desktop.png', fullPage: true })
})
