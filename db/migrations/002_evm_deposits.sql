-- Phase 2: real EVM deposit addresses and on-chain deposits.

-- One HD-derived address per user per chain family. derivation_index is the
-- child index under the xpub (m/44'/60'/0'/0/<index> for EVM).
CREATE SEQUENCE evm_derivation_index MINVALUE 0 START 0;

CREATE TABLE deposit_addresses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  family            text NOT NULL CHECK (family IN ('evm')),
  derivation_index  integer NOT NULL CHECK (derivation_index >= 0),
  address           text NOT NULL,             -- lowercase
  created_at        timestamptz NOT NULL DEFAULT now(),
  registered_at     timestamptz,               -- added to every Alchemy webhook
  UNIQUE (user_id, family),
  UNIQUE (family, derivation_index),
  UNIQUE (family, address)
);
CREATE INDEX deposit_addresses_unregistered ON deposit_addresses (created_at) WHERE registered_at IS NULL;

-- Deposits now come from chains: price and USD value are filled in when
-- the deposit is credited, and a deposit can be held or reverted.
ALTER TABLE deposits ALTER COLUMN rate_usd DROP NOT NULL;
ALTER TABLE deposits ALTER COLUMN usd_cents DROP NOT NULL;
ALTER TABLE deposits DROP CONSTRAINT deposits_status_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_status_check
  CHECK (status IN ('confirming', 'complete', 'held', 'reverted', 'ignored'));
ALTER TABLE deposits
  ADD COLUMN address                text,
  ADD COLUMN from_address           text,
  ADD COLUMN asset                  text,      -- 'native' or token contract (lowercase)
  ADD COLUMN block_number           bigint,
  ADD COLUMN block_hash             text,
  ADD COLUMN confirmations          integer NOT NULL DEFAULT 0,
  ADD COLUMN required_confirmations integer,
  ADD COLUMN note                   text;
CREATE INDEX deposits_confirming ON deposits (network, created_at) WHERE status = 'confirming';
