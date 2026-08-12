/**
 * End-to-end smoke test for Face Crop Studio.
 * Run: node scripts/e2e-smoke.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const OUT = join(process.cwd(), 'tmp-e2e')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Face Crop Studio')

const empty = await page.locator('text=Upload images to get started').count()
if (!empty) throw new Error('Missing empty state')
console.log('✓ Empty state')

const buffers = await page.evaluate(async (count) => {
  const out = []
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = `hsl(${(i * 40) % 360} 55% 45%)`
    ctx.fillRect(0, 0, 640, 800)
    ctx.fillStyle = '#f1c27d'
    ctx.beginPath()
    ctx.ellipse(320, 280, 90, 110, 0, 0, Math.PI * 2)
    ctx.fill()
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
    const buf = await blob.arrayBuffer()
    out.push({
      name: `student${String(i + 1).padStart(2, '0')}.png`,
      data: Array.from(new Uint8Array(buf)),
    })
  }
  return out
}, 8)

const paths = []
for (const f of buffers) {
  const p = join(OUT, f.name)
  writeFileSync(p, Buffer.from(f.data))
  paths.push(p)
}

await page.locator('input[type="file"]').first().setInputFiles(paths)
await page.waitForSelector('text=Uploaded Images (8)', { timeout: 20000 })
console.log('✓ Uploaded 8 images')

await page.getByRole('button', { name: 'Circle' }).click()
await page.locator('label:has-text("Width") input').fill('512')
await page.locator('label:has-text("Height") input').fill('512')

await page.getByRole('button', { name: 'Apply Settings to All' }).click()
await page.getByRole('button', { name: 'Apply', exact: true }).click()
await page.waitForSelector('text=Settings applied to 8 images', { timeout: 10000 })
console.log('✓ Applied settings to all')

await page.getByRole('button', { name: 'Crop 8 Images' }).click()
await page.waitForSelector('text=Cropped Results (8)', { timeout: 60000 })
console.log('✓ Cropped 8 images')

const dimCount = await page.locator('text=512×512').count()
if (dimCount < 1) throw new Error('Expected 512×512 output labels')
console.log('✓ Output dimensions labeled 512×512')

// Reject invalid file without changing count
await page.evaluate(() => {
  const dt = new DataTransfer()
  dt.items.add(new File(['not-an-image'], 'bad.txt', { type: 'text/plain' }))
  const input = document.querySelector('input[type="file"]')
  Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForTimeout(1000)
await page.waitForSelector('text=Uploaded Images (8)')
console.log('✓ Invalid file skipped; count stays 8')

if (errors.length) {
  console.error('Page errors:', errors)
  process.exit(1)
}

console.log('\nE2E smoke test passed')
await browser.close()
