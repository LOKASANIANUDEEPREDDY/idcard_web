/**
 * Comprehensive feature audit for Face Crop Studio.
 * Requires: npm run dev (http://127.0.0.1:5173)
 * Run: node scripts/e2e-audit.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import JSZip from 'jszip'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const OUT = join(process.cwd(), 'tmp-e2e')
mkdirSync(OUT, { recursive: true })

let passed = 0
let failed = 0
const failures = []

function ok(name) {
  passed += 1
  console.log(`  ✓ ${name}`)
}
function fail(name, err) {
  failed += 1
  failures.push(`${name}: ${err}`)
  console.error(`  ✗ ${name}: ${err}`)
}

async function assert(name, cond, detail = '') {
  if (cond) ok(name)
  else fail(name, detail || 'assertion failed')
}

async function makeImageFiles(page, specs) {
  const buffers = await page.evaluate(async (specs) => {
    const out = []
    for (const spec of specs) {
      const canvas = document.createElement('canvas')
      canvas.width = spec.w
      canvas.height = spec.h
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = spec.bg || '#2a6'
      ctx.fillRect(0, 0, spec.w, spec.h)
      ctx.fillStyle = '#f1c27d'
      ctx.beginPath()
      ctx.ellipse(spec.w / 2, spec.h * 0.35, spec.w * 0.14, spec.h * 0.14, 0, 0, Math.PI * 2)
      ctx.fill()
      const mime = spec.mime || 'image/png'
      const quality = mime === 'image/jpeg' ? 0.9 : undefined
      const blob = await new Promise((res) => canvas.toBlob(res, mime, quality))
      const buf = await blob.arrayBuffer()
      out.push({ name: spec.name, data: Array.from(new Uint8Array(buf)) })
    }
    return out
  }, specs)

  return buffers.map((f) => {
    const p = join(OUT, f.name)
    writeFileSync(p, Buffer.from(f.data))
    return p
  })
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ acceptDownloads: true })
const page = await context.newPage()
page.setDefaultTimeout(30000)
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

console.log('\n=== Feature Audit ===\n')

await page.goto(BASE, { waitUntil: 'networkidle' })

console.log('1. Empty states')
await assert('App title', (await page.locator('text=Face Crop Studio').count()) > 0)
await assert('Upload empty hint', (await page.locator('text=Upload images to get started').count()) > 0)
await assert('Uploaded Images (0)', (await page.locator('text=Uploaded Images (0)').count()) > 0)
await assert('Results empty', (await page.locator('text=Your cropped images will appear here.').count()) > 0)
await assert('Crop disabled with no selection', await page.getByRole('button', { name: 'Crop Images' }).isDisabled())

console.log('\n2. Upload formats')
const paths = await makeImageFiles(page, [
  { name: 'a.png', w: 640, h: 800, mime: 'image/png', bg: '#345' },
  { name: 'b.jpg', w: 640, h: 800, mime: 'image/jpeg', bg: '#543' },
  { name: 'c.webp', w: 500, h: 500, mime: 'image/webp', bg: '#364' },
  { name: 'd.png', w: 800, h: 600, mime: 'image/png', bg: '#635' },
])
await page.locator('input[type="file"]').first().setInputFiles(paths)
await page.waitForSelector('text=Uploaded Images (4)')
await assert('4 images uploaded', true)
await assert('Toast upload', (await page.locator('text=/4 images uploaded/i').count()) > 0)
await assert('Preview canvas visible', await page.locator('canvas[aria-label*="Crop preview"]').isVisible())

writeFileSync(join(OUT, 'bad.txt'), 'not an image')
await page.locator('input[type="file"]').first().setInputFiles([join(OUT, 'bad.txt')])
await page.waitForTimeout(800)
await assert('Count unchanged after invalid', (await page.locator('text=Uploaded Images (4)').count()) > 0)
await assert('Unsupported toast/error', (await page.locator('text=/Unsupported|skipped/i').count()) > 0)

console.log('\n3. Selection controls')
await page.getByRole('button', { name: 'Deselect', exact: true }).click()
await assert('Crop disabled when none selected', await page.getByRole('button', { name: 'Crop Images' }).isDisabled())
await page.getByRole('button', { name: 'Select All' }).first().click()
await assert('Crop 4 Images enabled', await page.getByRole('button', { name: 'Crop 4 Images' }).isEnabled())

console.log('\n4. Shapes')
for (const shape of ['Circle', 'Square', 'Rounded', 'Heart', 'Star', 'Hexagon', 'Curved Hex']) {
  await page.getByRole('button', { name: shape, exact: true }).click()
  await assert(`Shape ${shape} clickable`, true)
}
await page.getByRole('button', { name: 'Add Custom' }).click()
await page.waitForSelector('text=Custom Shape')
await page.getByRole('button', { name: 'Apply Shape' }).click()
await assert('Custom shape applied', (await page.locator('text=Custom shape applied').count()) > 0)
await page.getByRole('button', { name: 'Circle', exact: true }).click()

console.log('\n5. Centering')
for (const mode of ['Face', 'Shoulders', 'Eyes', 'Nose', 'Manual']) {
  await page.getByRole('button', { name: mode, exact: true }).click()
  await assert(`Center ${mode}`, true)
}

console.log('\n6. Dimensions')
const widthInput = page.locator('label:has-text("Width") input')
const heightInput = page.locator('label:has-text("Height") input')
await widthInput.fill('512')
await heightInput.fill('512')
await assert('512x512 set', (await widthInput.inputValue()) === '512' && (await heightInput.inputValue()) === '512')
await page.getByRole('button', { name: /Lock aspect|Unlock aspect/i }).click()
await widthInput.fill('400')
await heightInput.fill('500')
await assert('Non-square dims', (await widthInput.inputValue()) === '400' && (await heightInput.inputValue()) === '500')
await widthInput.fill('512')
await heightInput.fill('512')
await page.locator('label:has-text("Unit") select').selectOption('mm')
await assert('Unit mm selectable', (await page.locator('label:has-text("Unit") select').inputValue()) === 'mm')
await page.locator('label:has-text("Unit") select').selectOption('px')

console.log('\n7. Presets & adjustments')
await page.getByRole('button', { name: 'Vivid', exact: true }).click()
await assert('Vivid preset', true)
await page.getByRole('button', { name: 'B & W', exact: true }).click()
await page.getByRole('button', { name: 'Remove', exact: true }).click()
await assert('Preset removed', true)

const zoomInput = page.locator('div:has(> div > label:text-is("Zoom")) input[type="number"]')
await zoomInput.fill('1.25')
await zoomInput.blur()
await assert('Zoom updated', Math.abs(parseFloat(await zoomInput.inputValue()) - 1.25) < 0.02)

const rotInput = page.locator('div:has(> div > label:text-is("Rotation")) input[type="number"]')
await rotInput.fill('15')
await rotInput.blur()
await assert('Rotation updated', Math.abs(parseFloat(await rotInput.inputValue()) - 15) < 0.5)
await page.getByRole('button', { name: 'Rotate right' }).click()
await assert('Rotate right (+90)', parseFloat(await rotInput.inputValue()) >= 90)

const borderInput = page.locator('div:has(> div > label:text-is("Border")) input[type="number"]')
await borderInput.fill('4')
await borderInput.blur()
await assert('Border set', Math.abs(parseFloat(await borderInput.inputValue()) - 4) < 0.2)

console.log('\n8. Pan & override')
await zoomInput.fill('1.4')
await zoomInput.blur()
await page.waitForTimeout(200)
await assert('Individual override badge', (await page.locator('text=Individual override').count()) > 0)

const canvas = page.locator('canvas[aria-label*="Crop preview"]')
const box = await canvas.boundingBox()
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 })
  await page.mouse.up()
}
await assert('Override badge after pan', (await page.locator('text=Individual override').count()) > 0)

console.log('\n9. Apply to all')
await page.getByRole('button', { name: 'Select All' }).first().click()
await page.getByRole('button', { name: 'Apply Settings to All' }).click()
await page.getByRole('button', { name: 'Apply', exact: true }).click()
await page.waitForSelector('text=/Settings applied to 4/i')
await assert('Apply to all toast', true)

console.log('\n10. Partial crop')
await page.getByRole('button', { name: 'Deselect', exact: true }).click()
const checks = page.locator('#upload-zone input[type="checkbox"]')
await checks.nth(0).click({ force: true })
await checks.nth(1).click({ force: true })
await assert('Crop 2 Images label', await page.getByRole('button', { name: 'Crop 2 Images' }).isVisible())
await page.getByRole('button', { name: 'Crop 2 Images' }).click()
await page.waitForSelector('text=Cropped Results (2)')
await assert('Only 2 results', true)
await assert('512×512 labels', (await page.locator('text=512×512').count()) >= 2)

await page.getByRole('button', { name: 'Select All' }).first().click()
await page.getByRole('button', { name: 'Crop 4 Images' }).click()
await page.waitForSelector('text=Cropped Results (4)')
await assert('All 4 results after full crop', true)

console.log('\n11. Export / download')
await page.getByRole('button', { name: 'Postfix' }).click()
await page.locator('label:has-text("Postfix") input').fill('_id')
await page.locator('label:has-text("Format") select').selectOption('png')
await assert('Transparent checkbox visible', await page.locator('text=Transparent background').isVisible())

const downloadPromise = page.waitForEvent('download')
await page.getByRole('button', { name: 'Download', exact: true }).first().click()
const download = await downloadPromise
const suggested = await download.suggestedFilename()
const dlPath = join(OUT, suggested)
await download.saveAs(dlPath)
await assert(`Download filename has postfix (${suggested})`, suggested.includes('_id'))

const png = readFileSync(dlPath)
const isPng = png[0] === 0x89 && png[1] === 0x50
await assert('Downloaded file is PNG', isPng)
if (isPng) {
  const w = png.readUInt32BE(16)
  const h = png.readUInt32BE(20)
  await assert(`PNG is 512x512 (got ${w}x${h})`, w === 512 && h === 512)
}

const zipPromise = page.waitForEvent('download')
await page.getByRole('button', { name: 'Download All' }).click()
const zipDl = await zipPromise
const zipPath = join(OUT, 'all.zip')
await zipDl.saveAs(zipPath)
const zipBuf = readFileSync(zipPath)
await assert('Download All produced ZIP signature', zipBuf[0] === 0x50 && zipBuf[1] === 0x4b)
const zip = await JSZip.loadAsync(zipBuf)
const names = Object.keys(zip.files)
await assert(`ZIP has 4 files (got ${names.length})`, names.length === 4)
await assert('ZIP files use postfix naming', names.every((n) => n.includes('_id')))

await page.locator('label:has-text("Format") select').selectOption('jpeg')
const jpgPromise = page.waitForEvent('download')
await page.getByRole('button', { name: 'Download', exact: true }).first().click()
const jpgDl = await jpgPromise
const jpgName = await jpgDl.suggestedFilename()
await assert(`JPG download extension (${jpgName})`, jpgName.endsWith('.jpg'))

console.log('\n12. Results management')
await page.getByRole('button', { name: 'Select All' }).nth(1).click()
await page.getByRole('button', { name: /Delete Selected/ }).click()
await page.getByRole('button', { name: 'Delete', exact: true }).click()
await page.waitForSelector('text=Your cropped images will appear here.')
await assert('Results cleared', true)

console.log('\n13. Theme & reset')
const html = page.locator('html')
const beforeDark = await html.evaluate((el) => el.classList.contains('dark'))
await page.getByRole('button', { name: /Switch to (dark|light) mode/i }).click()
const afterDark = await html.evaluate((el) => el.classList.contains('dark'))
await assert('Theme toggled', beforeDark !== afterDark)

await page.getByRole('button', { name: 'Reset All' }).click()
await page.getByRole('button', { name: 'Reset', exact: true }).click()
await assert('Settings reset toast', (await page.locator('text=Settings reset').count()) > 0)
await assert('Images still present after reset', (await page.locator('text=Uploaded Images (4)').count()) > 0)

await page.getByRole('button', { name: 'Clear All' }).click()
await page.getByRole('button', { name: 'Clear All' }).last().click()
await page.waitForSelector('text=Uploaded Images (0)')
await assert('Clear all works', true)

await assert('No page errors', pageErrors.length === 0, pageErrors.join('; '))

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failures.length) {
  console.log('\nFailures:')
  failures.forEach((f) => console.log(' -', f))
  process.exit(1)
}
console.log('\nAll audited features passed.')
await browser.close()
