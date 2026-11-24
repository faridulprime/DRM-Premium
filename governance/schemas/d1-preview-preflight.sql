-- DUGA Preview D1 preflight diagnostics
-- READ ONLY: SELECT statements only. No schema or data changes.
-- Run against the PREVIEW D1 database only.
-- IMPORTANT: paste and execute ONE numbered query at a time.
-- Do not run against Production.

-- Query 1: list all existing tables and views.
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE type IN ('table','view')
ORDER BY type, name;

-- Query 2: inspect existing indexes and triggers.
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE type IN ('index','trigger')
ORDER BY type, tbl_name, name;

-- Query 3: discover the actual migration-history table, if present.
SELECT name, sql
FROM sqlite_master
WHERE type='table'
  AND (lower(name) LIKE '%migration%' OR lower(name) LIKE '%meta%')
ORDER BY name;

-- Query 4: inspect the application users table definition, if present.
SELECT name, sql
FROM sqlite_master
WHERE type='table' AND name='users';

-- Query 5: check for any existing DUGA objects.
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE name LIKE 'duga_%'
ORDER BY type, name;
