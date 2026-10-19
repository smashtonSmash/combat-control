import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const svg = readFileSync('public/favicon.svg', 'utf8')
const b = await chromium.launch()
for (const s of [192, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } })
  await p.setContent(`<style>html,body{margin:0;background:#16130f}</style><div style="width:${s}px;height:${s}px">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div>`)
  await p.screenshot({ path: `public/icon-${s}.png` })
}
await b.close()
