import { BookOpen, Database, ExternalLink, FlaskConical, LockKeyhole, ShieldCheck } from 'lucide-react'

const sources = [
  ['ADA: Making Sense of Food Labels', 'https://diabetes.org/food-nutrition/reading-food-labels/making-sense-food-labels'],
  ['FDA: Added Sugars on the Nutrition Facts Label', 'https://www.fda.gov/food/nutrition-facts-label/added-sugars-nutrition-facts-label'],
  ['University of Sydney: About GI', 'https://glycemicindex.com/about-gi/'],
  ['Open Food Facts API documentation', 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/'],
  ['USDA FoodData Central API guide', 'https://fdc.nal.usda.gov/api-guide/'],
]

export default function AboutPage() {
  return (
    <div className="page about-page">
      <header className="page-heading"><span className="eyebrow"><BookOpen size={14} /> About the research MVP</span><h1>Trust comes from showing the boundary.</h1><p>Sugar pAI is a packaged-food label interpretation study for adults with type 2 diabetes or prediabetes. It is not a diagnostic, treatment, or glucose-prediction system.</p></header>

      <section className="principles-grid">
        <article className="principle-card"><ShieldCheck /><span>01</span><h2>Evidence before confidence</h2><p>Every accepted number must point to the photographed label, an identified database record, or a user confirmation. Model self-confidence is never enough.</p></article>
        <article className="principle-card"><Database /><span>02</span><h2>Unknown stays unknown</h2><p>A missing added-sugar declaration is not zero. Database disagreements remain visible and never silently replace the current label.</p></article>
        <article className="principle-card"><FlaskConical /><span>03</span><h2>GI labels stay explicit</h2><p>Sourced GI is separate from the alias-based demo GL. Ingredient aliases are not treated as tested product evidence.</p></article>
        <article className="principle-card"><LockKeyhole /><span>04</span><h2>Local by default</h2><p>No accounts, cloud history, analytics, or advertising. Confirmed records use IndexedDB on this device; source images are retained only by explicit opt-in.</p></article>
      </section>

      <div className="about-layout">
        <section className="card about-section">
          <span className="section-kicker">Processing disclosure</span><h2>Where a scan can go</h2>
          <ol className="processing-list">
            <li><strong>This device</strong><p>Image previews, basic quality checks, and UPC/EAN barcode decoding.</p></li>
            <li><strong>Temporary Sugar pAI service</strong><p>MIME/dimension validation, EXIF stripping, orchestration, validation, and short-lived job state. Temporary files expire after 15 minutes.</p></li>
            <li><strong>Configured external processors</strong><p>Tesseract OCR by default or optional PaddleOCR for label text; DeepSeek through an Ollama-compatible API for constrained JSON extraction; and Open Food Facts for barcode lookup when enabled. The result’s provenance lists processors actually used. Do not upload if you do not consent.</p></li>
          </ol>
          <div className="notice neutral">Provider integrations are optional in development. When extraction fails, the app asks for manual confirmation and does not substitute sample nutrition values.</div>
        </section>
        <section className="card about-section">
          <span className="section-kicker">Scientific boundary</span><h2>What the tool can and cannot say</h2>
          <div className="boundary-list"><div><strong>Can support</strong><p>Transcription of printed nutrient values, product database cross-checks, detection of named sugar-related ingredients, and a clearly labeled heuristic GL demo when required fields are present.</p></div><div><strong>Cannot infer</strong><p>Grams of each named sweetener, a true sourced GI from the label, individual glucose response, medication or insulin decisions, or whether a food is “safe.”</p></div></div>
        </section>
      </div>

      <section className="card source-card"><span className="section-kicker">Primary references</span><h2>Read the underlying guidance</h2><div className="source-list">{sources.map(([title, url]) => <a key={url} href={url} target="_blank" rel="noreferrer"><span>{title}</span><ExternalLink size={15} /></a>)}</div></section>
      <footer className="research-footer">Internal, noncommercial research prototype · English UI · English/Filipino label-text research · Educational copy requires registered-dietitian review before external testing.</footer>
    </div>
  )
}
