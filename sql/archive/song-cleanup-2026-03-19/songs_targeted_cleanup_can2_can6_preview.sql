-- Targeted conflict cleanup for CAN2 through CAN6 (PREVIEW VERSION).
-- Source: reports/song-conflicts-review.csv (recommendedKeepId)
--   CAN|CAN2|2 -> keep 986, delete 3787
--   CAN|CAN3|3 -> keep 987, delete 3788
--   CAN|CAN4|4 -> keep 988, delete 3789
--   CAN|CAN5|5 -> keep 989, delete 3790
--   CAN|CAN6|6 -> keep 990, delete 3791
--
-- Safety design:
-- 1) Verify all keep rows exist with expected collection/code/number.
-- 2) Verify all delete rows exist with expected collection/code/number.
-- 3) Touch only explicit ids scoped by collection/code/number.
-- 4) ROLLBACK by default. Change final line to COMMIT to persist.

BEGIN;

-- Preview rows before change
SELECT id, collection, code, number, title, created_at
FROM songs
WHERE id IN (986, 987, 988, 989, 990, 3787, 3788, 3789, 3790, 3791)
ORDER BY code, id;

DO $$
DECLARE
  keep_count INTEGER;
  delete_count INTEGER;
  scoped_total_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO keep_count
  FROM songs
  WHERE (id, collection, code, number) IN (
    (986, 'CAN', 'CAN2', 2),
    (987, 'CAN', 'CAN3', 3),
    (988, 'CAN', 'CAN4', 4),
    (989, 'CAN', 'CAN5', 5),
    (990, 'CAN', 'CAN6', 6)
  );

  IF keep_count <> 5 THEN
    RAISE EXCEPTION 'Guard failed: expected 5 keep rows for CAN2-CAN6, found %.', keep_count;
  END IF;

  SELECT COUNT(*)
  INTO delete_count
  FROM songs
  WHERE (id, collection, code, number) IN (
    (3787, 'CAN', 'CAN2', 2),
    (3788, 'CAN', 'CAN3', 3),
    (3789, 'CAN', 'CAN4', 4),
    (3790, 'CAN', 'CAN5', 5),
    (3791, 'CAN', 'CAN6', 6)
  );

  IF delete_count <> 5 THEN
    RAISE EXCEPTION 'Guard failed: expected 5 delete rows for CAN2-CAN6, found %.', delete_count;
  END IF;

  SELECT COUNT(*)
  INTO scoped_total_count
  FROM songs
  WHERE (collection, code, number) IN (
    ('CAN', 'CAN2', 2),
    ('CAN', 'CAN3', 3),
    ('CAN', 'CAN4', 4),
    ('CAN', 'CAN5', 5),
    ('CAN', 'CAN6', 6)
  );

  IF scoped_total_count <> 10 THEN
    RAISE EXCEPTION 'Guard failed: expected 10 total scoped rows across CAN2-CAN6 before delete, found %.', scoped_total_count;
  END IF;
END $$;

DELETE FROM songs
WHERE (id, collection, code, number) IN (
  (3787, 'CAN', 'CAN2', 2),
  (3788, 'CAN', 'CAN3', 3),
  (3789, 'CAN', 'CAN4', 4),
  (3790, 'CAN', 'CAN5', 5),
  (3791, 'CAN', 'CAN6', 6)
);

-- Verify survivors after delete (inside transaction)
SELECT collection, code, number, COUNT(*) AS remaining_rows, ARRAY_AGG(id ORDER BY id) AS remaining_ids
FROM songs
WHERE (collection, code, number) IN (
  ('CAN', 'CAN2', 2),
  ('CAN', 'CAN3', 3),
  ('CAN', 'CAN4', 4),
  ('CAN', 'CAN5', 5),
  ('CAN', 'CAN6', 6)
)
GROUP BY collection, code, number
ORDER BY number;

-- Keep this as ROLLBACK until you confirm output above.
-- Then replace ROLLBACK with COMMIT and run again to persist.
ROLLBACK;
