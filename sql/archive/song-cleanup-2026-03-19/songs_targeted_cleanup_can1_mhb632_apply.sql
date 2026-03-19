-- Targeted conflict cleanup for two hymns only (APPLY VERSION).
-- Source: reports/song-conflicts-review.csv (recommendedKeepId)
--   CAN|CAN1|1      -> keep 985, delete 3786, 6001
--   MHB|MHB632|632  -> keep 632, delete 4761
--
-- Safety design:
-- 1) Verify the keep rows exist with expected collection/code/number.
-- 2) Verify expected delete-row counts before deleting.
-- 3) Touch only explicit ids scoped by collection/code/number.

BEGIN;

-- Preview rows before change
SELECT id, collection, code, number, title, created_at
FROM songs
WHERE id IN (985, 3786, 6001, 632, 4761)
ORDER BY collection, code, number, id;

DO $$
DECLARE
  can_keep_exists BOOLEAN;
  mhb_keep_exists BOOLEAN;
  can_delete_count INTEGER;
  mhb_delete_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM songs
    WHERE id = 985 AND collection = 'CAN' AND code = 'CAN1' AND number = 1
  ) INTO can_keep_exists;

  IF NOT can_keep_exists THEN
    RAISE EXCEPTION 'Guard failed: keep row id 985 for CAN1 was not found as expected.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM songs
    WHERE id = 632 AND collection = 'MHB' AND code = 'MHB632' AND number = 632
  ) INTO mhb_keep_exists;

  IF NOT mhb_keep_exists THEN
    RAISE EXCEPTION 'Guard failed: keep row id 632 for MHB632 was not found as expected.';
  END IF;

  SELECT COUNT(*)
  FROM songs
  WHERE id IN (3786, 6001)
    AND collection = 'CAN'
    AND code = 'CAN1'
    AND number = 1
  INTO can_delete_count;

  IF can_delete_count <> 2 THEN
    RAISE EXCEPTION 'Guard failed: expected 2 CAN1 delete rows (3786, 6001), found %.', can_delete_count;
  END IF;

  SELECT COUNT(*)
  FROM songs
  WHERE id = 4761
    AND collection = 'MHB'
    AND code = 'MHB632'
    AND number = 632
  INTO mhb_delete_count;

  IF mhb_delete_count <> 1 THEN
    RAISE EXCEPTION 'Guard failed: expected 1 MHB632 delete row (4761), found %.', mhb_delete_count;
  END IF;
END $$;

DELETE FROM songs
WHERE (
    id IN (3786, 6001)
    AND collection = 'CAN'
    AND code = 'CAN1'
    AND number = 1
  )
  OR (
    id = 4761
    AND collection = 'MHB'
    AND code = 'MHB632'
    AND number = 632
  );

-- Verify survivors after delete (inside transaction)
SELECT collection, code, number, COUNT(*) AS remaining_rows, ARRAY_AGG(id ORDER BY id) AS remaining_ids
FROM songs
WHERE (collection = 'CAN' AND code = 'CAN1' AND number = 1)
   OR (collection = 'MHB' AND code = 'MHB632' AND number = 632)
GROUP BY collection, code, number
ORDER BY collection, code, number;

COMMIT;
