// Demo seed data. Brand names are used only to show the concept —
// no logos, no affiliation implied.
import { randomUUID } from 'node:crypto'

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

export function seed() {
  const brands = BRANDS.map((b) => ({
    id: slug(b.name),
    ...b,
    buyDiscount: 0.2, // what we pay below face value
    sellDiscount: 0.15, // what the customer saves
    active: true,
    // Store locations are kept as offsets (degrees) from the viewer's centre so the
    // "near you" demo works wherever it is opened.
    locations: Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({
      address: `${100 + Math.floor(Math.random() * 3800)} ${STREETS[Math.floor(Math.random() * STREETS.length)]}`,
      dLat: rand(-0.09, 0.09),
      dLng: rand(-0.11, 0.11),
    })),
  }))

  // Slightly different margins on a couple of brands so the admin view is interesting.
  brands.find((b) => b.id === 'whole-foods-market').buyDiscount = 0.12
  brands.find((b) => b.id === 'whole-foods-market').sellDiscount = 0.08
  brands.find((b) => b.id === 'chick-fil-a').buyDiscount = 0.16
  brands.find((b) => b.id === 'chick-fil-a').sellDiscount = 0.12

  const inventory = []
  const now = Date.now()
  for (const b of brands) {
    for (const face of [10, 25, 50, 100]) {
      const count = face === 100 ? 2 : 3 + Math.floor(Math.random() * 3)
      for (let i = 0; i < count; i++) {
        inventory.push({
          id: randomUUID(),
          brandId: b.id,
          faceValue: face * 100,
          cost: Math.round(face * 100 * (1 - b.buyDiscount)),
          cardNumber: makeCardNumber(),
          pin: makePin(),
          status: 'available',
          addedAt: new Date(now - Math.floor(rand(1, 20)) * 86400000).toISOString(),
        })
      }
    }
  }

  return { brands, inventory, users: [], deposits: [], sales: [] }
}
