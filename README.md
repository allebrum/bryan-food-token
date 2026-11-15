# Food Token

Spend crypto on food. Customers send crypto to their own deposit address,
it's converted to dollars on arrival, and they buy discounted restaurant gift
cards that live in an Apple Wallet–style card stack.

## Run it locally

```bash
npm install
npm run db:up        # Postgres in Docker on :5440
cp .env.example .env # then fill in CARD_ENCRYPTION_KEY (openssl rand -base64 32)
npm run migrate
npm run dev          # web on http://localhost:5180, API on :5181
```

Without `RESEND_API_KEY`, sign-in links are printed in the API console.

| URL | What |
| --- | --- |
| `/` | Marketing page |
| `/app` | Customer app: email sign-in → wallet → add crypto → stores → buy → barcode → update balance |
| `/admin` | Inventory, brand margins, customers, overview — only for `ADMIN_EMAILS` |

## Environment variables

| Variable | Required | What |
| --- | --- | --- |
| `NETLIFY_DATABASE_URL` / `DATABASE_URL` | yes | Postgres. Netlify DB sets the first automatically. |
| `APP_URL` | yes | Public site URL, used in sign-in emails (e.g. `https://bryans-food-token.netlify.app`). |
| `ADMIN_EMAILS` | yes | Comma-separated emails allowed into `/admin`. |
| `RESEND_API_KEY` | prod | Resend API key. |
| `EMAIL_FROM` | prod | Sender on a domain verified in Resend, e.g. `Food Token <signin@yourdomain.com>`. |
| `CARD_ENCRYPTION_KEY` | yes | 32 random bytes, base64. Encrypts card numbers, PINs and e-gift links. **Back it up** — losing it makes stored cards unreadable. |
| `DEMO_MODE` | no | `true` = simulated deposits, fake addresses, demo inventory, demo banner. |

## How it's built

- **API**: Express (`server/app.js`) on Postgres (`server/db.js`). Locally via
  `server/dev.js`; on Netlify as a Functions v2 function on `/api/*`
  (`netlify/functions/api.mjs`).
- **Migrations**: `db/migrations/*.sql`, applied by `npm run migrate`, which
  the Netlify build runs before building.
- **Money**: integer cents. Every balance change writes a `ledger` row in the
  same transaction; `(kind, ref)` is unique so nothing applies twice.
  Purchases claim a card with `FOR UPDATE SKIP LOCKED` and debit with a
  guarded `UPDATE … WHERE balance_cents >= price`.
- **Sign-in**: magic links via Resend. Tokens are stored hashed, expire in
  15 minutes and are claimed once. Sessions are an HttpOnly cookie (30 days).
  Max 3 emails per address and 10 per IP per 15 minutes.
- **Admin**: every `/api/admin/*` route checks the signed-in email against
  `ADMIN_EMAILS`; the UI only shows the Admin link to those accounts.
- **Gift cards**: number, PIN and e-gift link are AES-256-GCM encrypted.
  Admin lists show only the last 4 digits; the full card is fetched one at a
  time, only by its owner, when they open it. Admin actions go to `audit_log`.

## Not built yet

Real deposit addresses and deposit detection, and the scheduled sweep to the
company treasury wallet. Until then, run with `DEMO_MODE=true`; without it the
"Add crypto" sheet says deposits open soon.
