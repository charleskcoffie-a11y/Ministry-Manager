-- Full conflict cleanup (PREVIEW VERSION).
-- Keeps the lowest id per normalized (collection, code, number) key.
-- Deletes all other rows in each conflicting key bucket.
--
-- Guard expectations are based on the latest generated report:
--   conflictingGroups = 1398
--   rowsToDelete      = 1398

BEGIN;

-- Current summary snapshot before any delete
WITH grouped AS (
  SELECT
    UPPER(TRIM(COALESCE(collection, ''))) AS collection_key,
    UPPER(TRIM(COALESCE(code, ''))) AS code_key,
    number,
    COUNT(*) AS row_count
  FROM songs
  GROUP BY 1, 2, 3
  HAVING COUNT(*) > 1
)
SELECT
  COUNT(*) AS conflicting_groups,
  COALESCE(SUM(row_count - 1), 0) AS rows_to_delete
FROM grouped;

DO $$
DECLARE
  expected_conflicting_groups INTEGER := 1398;
  expected_rows_to_delete INTEGER := 1398;
  actual_conflicting_groups INTEGER;
  actual_rows_to_delete INTEGER;
BEGIN
  WITH grouped AS (
    SELECT
      UPPER(TRIM(COALESCE(collection, ''))) AS collection_key,
      UPPER(TRIM(COALESCE(code, ''))) AS code_key,
      number,
      COUNT(*) AS row_count
    FROM songs
    GROUP BY 1, 2, 3
    HAVING COUNT(*) > 1
  )
  SELECT
    COUNT(*),
    COALESCE(SUM(row_count - 1), 0)
  INTO actual_conflicting_groups, actual_rows_to_delete
  FROM grouped;

  IF actual_conflicting_groups <> expected_conflicting_groups THEN
    RAISE EXCEPTION
      'Guard failed: expected % conflicting groups, found %.',
      expected_conflicting_groups,
      actual_conflicting_groups;
  END IF;

  IF actual_rows_to_delete <> expected_rows_to_delete THEN
    RAISE EXCEPTION
      'Guard failed: expected % rows to delete, found %.',
      expected_rows_to_delete,
      actual_rows_to_delete;
  END IF;
END $$;

-- Sample of rows that would be deleted
WITH ranked AS (
  SELECT
    id,
    collection,
    code,
    number,
    title,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY UPPER(TRIM(COALESCE(collection, ''))), UPPER(TRIM(COALESCE(code, ''))), number
      ORDER BY id ASC
    ) AS row_rank
  FROM songs
)
SELECT id, collection, code, number, title, created_at
FROM ranked
WHERE row_rank > 1
ORDER BY collection, code, number, id
LIMIT 50;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY UPPER(TRIM(COALESCE(collection, ''))), UPPER(TRIM(COALESCE(code, ''))), number
      ORDER BY id ASC
    ) AS row_rank
  FROM songs
)
DELETE FROM songs AS target
USING ranked
WHERE target.id = ranked.id
  AND ranked.row_rank > 1;

-- Verification after delete inside transaction
WITH grouped AS (
  SELECT
    UPPER(TRIM(COALESCE(collection, ''))) AS collection_key,
    UPPER(TRIM(COALESCE(code, ''))) AS code_key,
    number,
    COUNT(*) AS row_count
  FROM songs
  GROUP BY 1, 2, 3
  HAVING COUNT(*) > 1
)
SELECT
  COUNT(*) AS remaining_conflicting_groups,
  COALESCE(SUM(row_count - 1), 0) AS remaining_rows_to_delete
FROM grouped;

-- Keep this as ROLLBACK until you verify outputs.
-- Then run the APPLY version to persist.
ROLLBACK;
