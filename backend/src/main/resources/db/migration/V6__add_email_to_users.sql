-- =====================================================================
--  V6: add 'email' column to users
-- ---------------------------------------------------------------------
--  Phase 6 (Features) introduces email notifications. Reporters provide
--  an email address at registration so they can receive "status changed"
--  notifications when an admin resolves or updates their incident.
--
--  Notes:
--   * NULL is allowed because existing accounts (including the seeded
--     admin and any accounts created before this migration) did not
--     capture an email. EmailService skips sending when the column is
--     NULL, so legacy accounts work without backfilling.
--   * UNIQUE: one email per account — prevents duplicate notification
--     targets and double-registration with the same address.
--   * The NOT NULL constraint is intentionally omitted here; it can be
--     added in a later migration once all active accounts have emails.
-- =====================================================================
ALTER TABLE users
    ADD COLUMN email VARCHAR(255) NULL UNIQUE;
