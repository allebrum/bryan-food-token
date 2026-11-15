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
| `NETLIFY_DB_URL` / `DATABASE_URL` | yes | Postgres. Adding a Netlify Database (Data & storage → Database) sets the first automatically. |
| `APP_URL` | yes | Public site URL, used in sign-in emails (e.g. `https://bryans-food-token.netlify.app`). |
| `ADMIN_EMAILS` | yes | Comma-separated emails allowed into `/admin`. |
| `RESEND_API_KEY` | prod | Resend API key. |
| `EMAIL_FROM` | prod | Sender on a domain verified in Resend, e.g. `Food Token <signin@yourdomain.com>`. |
| `CARD_ENCRYPTION_KEY` | yes | 32 random bytes, base64. Encrypts card numbers, PINs and e-gift links. **Back it up** — losing it makes stored cards unreadable. |
| `DEMO_MODE` | no | `true` = simulated deposits, fake addresses, demo inventory, demo banner. |
| `EVM_XPUB` | for deposits | Extended public key from `npm run wallet:keygen`. |
| `ALCHEMY_API_KEY` | for deposits | RPC and token prices. |
| `ALCHEMY_AUTH_TOKEN` | for deposits | Notify API token; registers new addresses on the webhooks. |
| `ALCHEMY_<NET>_WEBHOOK_ID`, `ALCHEMY_<NET>_SIGNING_KEY` | per network | `<NET>` = `ETHEREUM`, `BASE`, `BSC`. A network goes live when both are set. |
| `MIN_DEPOSIT_USD_<NET>` | no | Defaults: Ethereum 20, Base 2, BSC 2. Smaller deposits are held. |
| `TREASURY_ADDRESSES` | no | Company wallets; transfers from them are never credited. |

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

## Deposits (EVM)

- **Addresses**: each user gets one HD-derived address (`m/44'/60'/0'/0/<n>`,
  the MetaMask path) that works on Ethereum, Base and BNB Smart Chain. The
  server holds only the xpub, so it can create addresses but can't move funds.
- **Detection**: one Alchemy Address Activity webhook per network posts to
  `/api/webhooks/alchemy`. Calls are verified with HMAC-SHA256 over the raw
  body; unknown tokens are recorded but never credited.
- **Crediting**: after the network's confirmation count (Ethereum 12, Base 10,
  BSC 15) the receipt is re-checked, the coin is priced (stablecoins at $1,
  ETH/BNB via Alchemy Prices), and the balance, ledger and deposit update in
  one statement. A scheduled function (`deposits-sync`, every 10 min) does
  this; users watching a deposit trigger it sooner.
- **Accepted**: USDC (Ethereum, Base, BSC), USDT (Ethereum, BSC), ETH
  (Ethereum, Base), BNB (BSC).

## Not built yet

Solana, Tron, Bitcoin, Dogecoin and XRP deposits; the scheduled sweep to
the company treasury wallet; a daily balance reconciliation that catches
missed webhooks; and a way for an admin to credit held deposits.
