// Simulates a real finger drag (touch events via CDP) to verify touch drag-to-attack works.
import { chromium, devices } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['Pixel 7'] })
const p = await ctx.newPage()
await p.goto((process.argv[2] || 'http://localhost:4173/') + '#battle'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500)
const cdp = await ctx.newCDPSession(p)
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
async function drag(fromSel, toName, longPress) {
  const a = await p.locator(fromSel).first().boundingBox()
  const t = await p.locator('.ccard', { hasText: toName }).first().boundingBox()
  const [x0, y0] = [a.x + a.width / 2, a.y + a.height / 2]
  await touch('touchStart', x0, y0)
  if (longPress) await p.waitForTimeout(400)
  for (let i = 1; i <= 12; i++) { await touch('touchMove', x0 + (t.x + t.width / 2 - x0) * i / 12, y0 + (t.y + t.height / 2 - y0) * i / 12); await p.waitForTimeout(16) }
  await touch('touchEnd'); await p.waitForTimeout(500)
  const title = await p.locator('.sheet-title').innerText().catch(() => 'NO SHEET')
  await p.locator('.sheet-head .icon-btn').click().catch(() => {})
  await p.waitForTimeout(200)
  return title
}
console.log('handle drag:', await drag('.ccard:has-text("Goblin 2") .drag-handle', 'Lyra', false))
console.log('long-press card drag:', await drag('.ccard:has-text("Skeleton") .ccard-name', 'Thorin', true))
await b.close()
