// Generates the PWA icons in public/icons from the logo. Run: node scripts/icons.js
import sharp from 'sharp'

const ORANGE = '#FF5B22'
// The logo glyph (coin ring + fork) on a 64-unit grid.
const glyph = (stroke = '#fff') =>
  `<circle cx="32" cy="32" r="18" fill="none" stroke="${stroke}" stroke-width="5"/><path d="M27 23v8a5 5 0 0 0 10 0v-8M32 23v18" stroke="${stroke}" stroke-width="4" stroke-linecap="round" fill="none"/>`

// Rounded tile (browsers/desktop), full-bleed (iOS + maskable), badge (mono).
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${ORANGE}"/>${glyph()}</svg>`
const fullBleed = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${ORANGE}"/><g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${glyph()}</g></svg>`
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${glyph('#fff')}</svg>`

const out = [
  ['icon-192.png', rounded, 192],
  ['icon-512.png', rounded, 512],
  ['maskable-512.png', fullBleed(0.8), 512], // glyph inside the 80% safe zone
  ['apple-touch-icon.png', fullBleed(1), 180],
  ['badge-96.png', badge, 96],
]
for (const [name, svg, size] of out) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toFile(`public/icons/${name}`)
  console.log('wrote', name)
}
