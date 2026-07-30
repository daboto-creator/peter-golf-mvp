-- Technical foundation only: no business tables, authentication, or data.
-- pgcrypto provides standard PostgreSQL cryptographic and UUID helpers for
-- future reviewed migrations.
create extension if not exists pgcrypto with schema extensions;

-- Manual rollback, only when no database object depends on the extension:
-- drop extension if exists pgcrypto;
