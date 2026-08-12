/**
 * Batch stress smoke: upload N images, crop all, verify counts.
 * Usage: COUNT=50 node scripts/e2e-batch.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const COUNT = Number(process.env.COUNT || 50)
const OUT = join(process.cwd(), 'tmp-e2e')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.setDefaultTimeout(120000)

await page.goto(BASE, { waitUntil: 'networkidle' })

const buffers = await page.evaluate(async (count) => {
  const out = []
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 640
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = `hsl(${(i * 17) % 360} 50% 40%)`
    ctx.fillRect(0, 0, 480, 640)
    ctx.fillStyle = '#e8b896'
    ctx.beginPath()
    ctx.ellipse(240, 220, 70, 90, 0, 0, Math.PI * 2)
    ctx.fill()
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    const buf = await blob.arrayBuffer()
    out.push({
      name: `batch_${String(i + 1).padStart(3, '0')}.jpg`,
      data: Array.from(new Uint8Array(buf)),
    })
  }
  return out
}, COUNT)

const paths = buffers.map((f) => {
  const p = join(OUT, f.name)
  writeFileSync(p, Buffer.from(f.data))
  return p
})

const t0 = Date.now()
await page.locator('input[type="file"]').first().setInputFiles(paths)
await page.waitForSelector(`text=Uploaded Images (${COUNT})`)
console.log(`✓ Uploaded ${COUNT} in ${Date.now() - t0}ms`)

const t1 = Date.now()
await page.getByRole('button', { name: `Crop ${COUNT} Images` }).click()
await page.waitForSelector(`text=Cropped Results (${COUNT})`)
console.log(`✓ Cropped ${COUNT} in ${Date.now() - t1}ms`)

const dims = await page.locator('text=512×512').count()
if (dims < COUNT) {
  throw new Error(`Expected ${COUNT} 512×512 labels, got ${dims}`)
}
console.log(`✓ All ${COUNT} results report 512×512`)
console.log('Batch stress test passed')
await browser.close()
