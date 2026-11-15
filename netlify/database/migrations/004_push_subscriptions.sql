-- Web Push: one row per device/browser a user turned notifications on for.
CREATE TABLE push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE CHECK (length(endpoint) <= 1000),
  p256dh        text NOT NULL CHECK (length(p256dh) <= 200),
  auth          text NOT NULL CHECK (length(auth) <= 100),
  user_agent    text CHECK (length(user_agent) <= 300),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_sent_at  timestamptz
);
CREATE INDEX push_subscriptions_user ON push_subscriptions (user_id);
