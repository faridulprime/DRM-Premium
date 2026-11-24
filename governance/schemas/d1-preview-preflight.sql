-- DUGA Preview D1 preflight diagnostics
-- READ ONLY: SELECT statements only. No schema or data changes.
-- Run against the PREVIEW D1 database only.
-- Execute each SELECT separately in the Cloudflare D1 Console.
-- Do not run against Production.

-- 1) Confirm database engine/runtime and inspect all tables/views.
SELECT sqlite_version() AS sqlite_version;
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE type IN ('table','view')
ORDER BY type, name;

-- 2) Inspect indexes and triggers already present.
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE type IN ('index','trigger')
ORDER BY type, tbl_name, name;

-- 3) Locate any migration-history table by its actual name.
-- Do not assume a migration table exists or infer applied migrations from filenames.
SELECT name, sql
FROM sqlite_master
WHERE type='table'
  AND (lower(name) LIKE '%migration%' OR lower(name) LIKE '%meta%')
ORDER BY name;

-- 4) Inspect the current application users table shape if it exists.
SELECT name, sql
FROM sqlite_master
WHERE type='table' AND name='users';

-- 5) Inspect columns for users. An empty result means the table is absent.
PRAGMA table_info('users');

-- 6) Check whether any DUGA objects already exist (expected to return zero rows before first install).
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE name LIKE 'duga_%'
ORDER BY type, name;
