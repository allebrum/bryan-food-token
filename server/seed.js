// Demo seed data. Brand names are used only to show the concept —
// no logos, no affiliation implied.

const BRANDS = [
  { name: 'Starbucks', category: 'Coffee', color: '#00704A', tagline: 'Coffee, tea & breakfast' },
  { name: 'Smashburger', category: 'Burgers', color: '#D6222A', tagline: 'Smashed burgers & fries' },
  { name: 'Chipotle', category: 'Mexican', color: '#441500', tagline: 'Burritos, bowls & tacos' },
  { name: 'Panera Bread', category: 'Bakery & Café', color: '#5F7A2E', tagline: 'Soups, salads & sandwiches' },
  { name: 'Shake Shack', category: 'Burgers', color: '#1F1F1F', tagline: 'Burgers, shakes & crinkle fries' },
  { name: "Dunkin'", category: 'Coffee', color: '#E8590C', tagline: 'Coffee & donuts' },
  { name: 'Sweetgreen', category: 'Salads', color: '#2F5D3A', tagline: 'Seasonal salads & bowls' },
  { name: "Domino's", category: 'Pizza', color: '#0B5CA8', tagline: 'Pizza, delivered or carry-out' },
  { name: 'Whole Foods Market', category: 'Groceries', color: '#00674B', tagline: 'Groceries & prepared foods' },
  { name: 'Subway', category: 'Sandwiches', color: '#008C15', tagline: 'Subs, wraps & salads' },
  { name: 'Taco Bell', category: 'Mexican', color: '#682A8D', tagline: 'Tacos, burritos & late-night' },
  { name: 'Chick-fil-A', category: 'Chicken', color: '#C8102E', tagline: 'Chicken sandwiches & nuggets' },
]

const STREETS = ['Market St', 'Colfax Ave', 'Broadway', 'Larimer St', 'Pearl St', 'Speer Blvd', 'Lincoln St', '17th St', 'Federal Blvd', 'Tennyson St']

const rand = (min, max) => Math.random() * (max - min) + min
const digits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function makeCardNumber() {
  return digits(16)
}
export function makePin() {
  return digits(4)
}

// Brand rows for an empty database (all environments).
export function seedBrands() {
  const margins = { 'whole-foods-market': [0.12, 0.08], 'chick-fil-a': [0.16, 0.12] }
  return BRANDS.map((b) => {
    const id = slug(b.name)
    const [buy, sell] = margins[id] ?? [0.2, 0.15]
    return {
      id,
      ...b,
      buyDiscount: buy,
      sellDiscount: sell,
      // Demo-only "nearby" offsets (degrees) around the viewer.
      locations: Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({
        address: `${100 + Math.floor(Math.random() * 3800)} ${STREETS[Math.floor(Math.random() * STREETS.length)]}`,
        dLat: rand(-0.09, 0.09),
        dLng: rand(-0.11, 0.11),
      })),
    }
  })
}

// Fake inventory for DEMO_MODE: [{ brandId, face, number, pin }]
export function demoInventory(brands) {
  const out = []
  for (const b of brands) {
    for (const face of [10, 25, 50, 100]) {
      const count = face === 100 ? 2 : 3 + Math.floor(Math.random() * 3)
      for (let i = 0; i < count; i++) out.push({ brand: b, face: face * 100, number: makeCardNumber(), pin: makePin() })
    }
  }
  return out
}
