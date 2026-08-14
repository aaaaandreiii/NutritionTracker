import { BookOpen, Database, ExternalLink, FlaskConical, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { deleteAllChatThreads, deleteAllLogs } from '../../lib/db'

const sources = [
  ['ADA: Making Sense of Food Labels', 'https://diabetes.org/food-nutrition/reading-food-labels/making-sense-food-labels'],
  ['FDA: Added Sugars on the Nutrition Facts Label', 'https://www.fda.gov/food/nutrition-facts-label/added-sugars-nutrition-facts-label'],
  ['University of Sydney: About GI', 'https://glycemicindex.com/about-gi/'],
  ['Open Food Facts data export', 'https://world.openfoodfacts.org/data'],
  ['USDA FoodData Central API guide', 'https://fdc.nal.usda.gov/api-guide/'],
]

export default function AboutPage() {
  const [localNotice, setLocalNotice] = useState('')

  return (
    <div className="page about-page">
      <header className="page-heading"><span className="eyebrow"><BookOpen size={14} /> About Sugar pAI V2</span><h1>Trust comes from showing the boundary.</h1><p>Sugar pAI is a packaged-food decision-support and Smart Context research prototype. Daily Dozen tracking remains available as supporting local logging, but the V2 story starts with evidence validation.</p></header>

      <section className="principles-grid">
        <article className="principle-card"><ShieldCheck /><span>01</span><h2>Evidence before confidence</h2><p>Every accepted number must point to the photographed label, an identified database record, or a user confirmation. Model self-confidence is never enough.</p></article>
        <article className="principle-card"><Database /><span>02</span><h2>Unknown stays unknown</h2><p>A missing added-sugar declaration is not zero. Database disagreements remain visible and never silently replace the current label.</p></article>
        <article className="principle-card"><FlaskConical /><span>03</span><h2>GI labels stay explicit</h2><p>Sourced GI is separate from the alias-based heuristic_demo GL. Curated unlabeled demo records do not display GI or GL.</p></article>
        <article className="principle-card"><LockKeyhole /><span>04</span><h2>Local by default</h2><p>No accounts, cloud history, analytics, or advertising. Confirmed records use IndexedDB on this device; source images are retained only by explicit opt-in.</p></article>
      </section>

      <div className="about-layout">
        <section className="card about-section">
          <span className="section-kicker">Processing disclosure</span><h2>Where a scan can go</h2>
          <ol className="processing-list">
            <li><strong>This device</strong><p>Image previews, basic quality checks, and UPC/EAN barcode decoding.</p></li>
            <li><strong>Temporary Sugar pAI service</strong><p>MIME/dimension validation, EXIF stripping, orchestration, validation, and short-lived job state. Temporary files expire after 15 minutes.</p></li>
            <li><strong>Configured processors</strong><p>A generated local Open Food Facts database is checked for enabled barcode lookup. A hosted Ollama VLM is used for constrained JSON label extraction when label photos are needed. The result’s provenance lists processors actually used.</p></li>
          </ol>
          <div className="notice neutral">Provider integrations are optional in development. When extraction fails, the app asks for manual confirmation and does not substitute sample nutrition values.</div>
        </section>
        <section className="card about-section">
          <span className="section-kicker">Scientific boundary</span><h2>What the tool can and cannot say</h2>
          <div className="boundary-list"><div><strong>Can support</strong><p>Transcription of printed nutrient values, product database cross-checks, detection of named sugar-related ingredients, deterministic Smart Context, and a curated Filipino-food demo with qualitative tags.</p></div><div><strong>Cannot infer</strong><p>Grams of each named sweetener, a true sourced GI from the label, individual glucose response, medication or insulin decisions, or permission-style food claims.</p></div></div>
        </section>
      </div>

      <section className="card local-data-card">
        <div><span className="section-kicker">Privacy & local data</span><h2>What this browser remembers</h2><p>Validated products and evidence-chat threads live in IndexedDB on this device. The backend stores no conversation history. Clearing either collection cannot be undone.</p></div>
        <div className="local-data-actions">
          <button className="secondary-button" onClick={() => {
            if (!window.confirm('Delete all locally saved validated product records?')) return
            void deleteAllLogs().then(() => setLocalNotice('Validated product history cleared.'))
          }}>Clear product history</button>
          <button className="secondary-button" onClick={() => {
            if (!window.confirm('Delete all locally saved evidence-chat threads?')) return
            void deleteAllChatThreads().then(() => setLocalNotice('Evidence-chat history cleared.'))
          }}>Clear chat history</button>
        </div>
        {localNotice && <div className="notice neutral">{localNotice}</div>}
      </section>

      <section className="card source-card"><span className="section-kicker">Primary references</span><h2>Read the underlying guidance</h2><div className="source-list">{sources.map(([title, url]) => <a key={url} href={url} target="_blank" rel="noreferrer"><span>{title}</span><ExternalLink size={15} /></a>)}</div></section>
      <footer className="research-footer">Internal, noncommercial research prototype · English UI · English/Filipino label-text research · Educational copy requires registered-dietitian review before external testing.</footer>
    </div>
  )
}
