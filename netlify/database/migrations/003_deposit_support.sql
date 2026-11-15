-- Held/unsupported deposits: customers can ask for help once per deposit,
-- and admins can credit a held deposit (recorded on the row and in audit_log).
ALTER TABLE deposits
  ADD COLUMN support_requested_at timestamptz,
  ADD COLUMN support_message      text CHECK (length(support_message) <= 1000),
  ADD COLUMN credited_by          text;
CREATE INDEX deposits_needing_review ON deposits (created_at) WHERE status IN ('held', 'ignored');
