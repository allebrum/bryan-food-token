-- Food Token: initial schema.
-- Money is integer cents. Every change to a user's balance has a ledger row
-- written in the same transaction, so balances can always be re-derived.

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 254),
  name           text CHECK (length(name) <= 40),
  balance_cents  bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  demo_wallets   jsonb,               -- fake addresses, DEMO_MODE only
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Magic-link tokens. Only a SHA-256 of the token is stored; used_at makes
-- each link single-use (claimed atomically on verify).
CREATE TABLE login_tokens (
  token_hash  text PRIMARY KEY,
  email       text NOT NULL,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE INDEX login_tokens_email_created ON login_tokens (email, created_at);
CREATE INDEX login_tokens_ip_created ON login_tokens (ip, created_at);

CREATE TABLE sessions (
  id_hash     text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE brands (
  id             text PRIMARY KEY,
  name           text NOT NULL CHECK (length(name) <= 60),
  category       text NOT NULL DEFAULT 'Restaurants' CHECK (length(category) <= 40),
  color          text NOT NULL DEFAULT '#111111' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  tagline        text NOT NULL DEFAULT '' CHECK (length(tagline) <= 80),
  buy_discount   numeric(5,4) NOT NULL DEFAULT 0.20 CHECK (buy_discount >= 0 AND buy_discount < 0.9),
  sell_discount  numeric(5,4) NOT NULL DEFAULT 0.15 CHECK (sell_discount >= 0 AND sell_discount < 0.9),
  active         boolean NOT NULL DEFAULT true,
  locations      jsonb NOT NULL DEFAULT '[]',   -- demo offsets only
  CHECK (sell_discount <= buy_discount)
);

-- Gift card numbers, PINs and e-gift links are AES-256-GCM encrypted.
-- number_hash (HMAC) lets us reject duplicates without decrypting.
CREATE TABLE gift_cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        text NOT NULL REFERENCES brands(id),
  face_cents      integer NOT NULL CHECK (face_cents BETWEEN 100 AND 100000),
  cost_cents      integer NOT NULL CHECK (cost_cents > 0 AND cost_cents <= face_cents),
  number_enc      text NOT NULL,
  number_hash     text NOT NULL,
  last4           text NOT NULL,
  pin_enc         text,
  egift_url_enc   text,
  barcode_format  text NOT NULL DEFAULT 'CODE128'
                  CHECK (barcode_format IN ('CODE128', 'CODE39', 'EAN13', 'UPC', 'QR', 'NONE')),
  expires_on      date,
  status          text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'void')),
  added_at        timestamptz NOT NULL DEFAULT now(),
  added_by        text,
  sold_to         uuid REFERENCES users(id),
  sold_at         timestamptz,
  sale_cents      integer,
  balance_cents   integer,
  UNIQUE (brand_id, number_hash),
  CHECK ((status = 'sold') = (sold_to IS NOT NULL))
);
CREATE INDEX gift_cards_stock ON gift_cards (brand_id, face_cents, added_at) WHERE status = 'available';
CREATE INDEX gift_cards_owner ON gift_cards (sold_to, sold_at);

CREATE TABLE card_balance_events (
  id             bigserial PRIMARY KEY,
  card_id        uuid NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  balance_cents  integer NOT NULL CHECK (balance_cents >= 0),
  note           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_balance_events_card ON card_balance_events (card_id, created_at);

CREATE TABLE deposits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  coin         text NOT NULL,
  network      text NOT NULL,
  amount       numeric(38,18) NOT NULL CHECK (amount > 0),
  rate_usd     numeric(20,8) NOT NULL,
  usd_cents    bigint NOT NULL CHECK (usd_cents >= 0),
  tx_ref       text NOT NULL,            -- tx hash (+ log index); 'demo-…' for simulated
  status       text NOT NULL DEFAULT 'confirming' CHECK (status IN ('confirming', 'complete')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (network, tx_ref)
);
CREATE INDEX deposits_user ON deposits (user_id, created_at);

-- Append-only money ledger. (kind, ref) is unique so a deposit or purchase
-- can never be applied twice.
CREATE TABLE ledger (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id),
  amount_cents  bigint NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('deposit', 'purchase', 'adjustment')),
  ref           text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ref)
);
CREATE INDEX ledger_user ON ledger (user_id, created_at);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor       text NOT NULL,
  action      text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
