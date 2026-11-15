# Food Token — interface demo

Spend crypto on food. Customers send crypto to their own deposit address, it's
converted to dollars on arrival, and they buy discounted restaurant gift cards
that live in an Apple Wallet–style card stack.

```bash
npm install
npm run dev        # web on http://localhost:5180, API on :5181
```

| URL | What |
| --- | --- |
| `/` | Marketing page |
| `/app` | Customer app: onboarding → wallet → add crypto → stores → buy → show barcode → update balance |
| `/admin` | Inventory (add cards in batches), brand margins, customers, overview |

## How the money works (demo defaults)

Each brand has two numbers, editable in **Admin → Brands & margins**:

- **We buy at** 20% off face value (our cost)
- **Customer saves** 15% off face value (their price)

The gap (5% of face) is the margin. A $50 card costs us $40, sells for $42.50.

## What's simulated

- **Deposit addresses** are fake and deliberately invalid (they contain
  `DEMO` plus characters each format forbids), so no wallet will send to them.
  A real build needs a custody provider or HD wallet plus a chain watcher.
- **Deposits** are triggered from the "Demo: pretend you sent" buttons and
  confirm after ~6 seconds. Crypto rates are fixed in `server/app.js`.
- **No auth.** The customer is identified by an id in localStorage; the admin
  is open. Card numbers and PINs are stored in plain JSON.
- **Store locations** are offsets around wherever the viewer is.
- Data lives in `server/data/db.json` locally and in a Netlify Blob when
  deployed. **Admin → Reset demo data** reseeds it.

## Layout

| Path | What |
| --- | --- |
| `server/app.js` | The API (Express) |
| `server/store.js` | Storage: JSON file locally, Netlify Blobs in production |
| `server/dev.js` | Local API entry (port 5181) |
| `netlify/functions/api.mjs` | Netlify entry: the same app via `serverless-http` |
| `src/` | React app: `marketing/`, `app/` (customer), `admin/` |

## Deploying (Netlify)

`netlify.toml` builds the site to `dist/`, sends `/api/*` to the function,
and falls back to `index.html` for client routes.

```bash
netlify deploy --build --prod
```

The whole database is one blob, so two testers writing at the same instant
can overwrite each other. That's fine for a demo; a real build needs a
database.
