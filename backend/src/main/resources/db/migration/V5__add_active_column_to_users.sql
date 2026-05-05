-- =====================================================================
--  V5: add 'active' column to users
-- ---------------------------------------------------------------------
--  Phase 5 (User Management) introduces account de-/re-activation.
--
--  active = TRUE   : login allowed (the default for every existing row
--                    and any newly registered reporter)
--  active = FALSE  : login blocked (Spring throws DisabledException,
--                    the global handler maps it to HTTP 401)
--
--  Notes:
--   * NOT NULL with DEFAULT TRUE means we don't need to backfill — every
--     row already in the table gets TRUE in the same statement.
--   * We keep the DEFAULT on the column even though the JPA entity sets
--     it explicitly. Defaults at the DB level guard against future code
--     paths that insert through native SQL.
-- =====================================================================
ALTER TABLE users
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
