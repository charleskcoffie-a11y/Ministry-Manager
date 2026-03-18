param(
  [ValidateRange(1, 44)]
  [int]$ChunkSize = 1
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$jsonPath = Join-Path $repoRoot 'public\wesley\sermons.json'
$sqlDir = Join-Path $repoRoot 'sql'
$sqlPath = Join-Path $sqlDir 'john_wesley_sermons.sql'
$chunkDir = Join-Path $sqlDir 'john_wesley_sermons_chunks'

if (-not (Test-Path $jsonPath)) {
  throw "Missing sermon corpus JSON at: $jsonPath"
}

if (-not (Test-Path $sqlDir)) {
  New-Item -Path $sqlDir -ItemType Directory | Out-Null
}

if (-not (Test-Path $chunkDir)) {
  New-Item -Path $chunkDir -ItemType Directory | Out-Null
}

$jsonRaw = Get-Content $jsonPath -Raw -Encoding UTF8
$sermons = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Use a unique dollar-quote tag unlikely to appear in sermon text.
$tag = '$WESLEY_SERMONS$'
if ($jsonRaw.Contains($tag)) {
  throw "JSON contains dollar-quote tag $tag. Please change tag in script."
}

$sqlTemplate = @'
-- ============================================================
--  JOHN WESLEY 44 SERMONS - Database Setup + Seed Data
--  Run this in: Supabase -> SQL Editor -> New query -> Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.john_wesley_sermons (
  sermon_number  INTEGER PRIMARY KEY,
  title          TEXT NOT NULL,
  scripture      TEXT NOT NULL,
  source_url     TEXT NOT NULL,
  sermon_text    TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wesley_title
  ON public.john_wesley_sermons (title);

-- Enable Row Level Security
ALTER TABLE public.john_wesley_sermons ENABLE ROW LEVEL SECURITY;

-- Option A: Open access (no Supabase Auth / anonymous use)
DROP POLICY IF EXISTS "Allow all" ON public.john_wesley_sermons;
CREATE POLICY "Allow all"
  ON public.john_wesley_sermons
  FOR ALL USING (true)
  WITH CHECK (true);

-- Seed: replace all existing rows with current corpus
TRUNCATE TABLE public.john_wesley_sermons;

INSERT INTO public.john_wesley_sermons (
  sermon_number,
  title,
  scripture,
  source_url,
  sermon_text
)
SELECT
  x.number,
  x.title,
  x.scripture,
  x.source,
  x.text
FROM jsonb_to_recordset(
$WESLEY_SERMONS$
__WESLEY_JSON_PAYLOAD__
$WESLEY_SERMONS$
::jsonb) AS x(
  number INTEGER,
  title TEXT,
  scripture TEXT,
  source TEXT,
  text TEXT
);
'@

$sql = $sqlTemplate.Replace('__WESLEY_JSON_PAYLOAD__', $jsonRaw)

Set-Content -Path $sqlPath -Value $sql -Encoding UTF8
Write-Host "Generated: $sqlPath"

$schemaSql = @'
-- ============================================================
--  JOHN WESLEY 44 SERMONS - Schema + RLS
--  Run this first in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.john_wesley_sermons (
  sermon_number  INTEGER PRIMARY KEY,
  title          TEXT NOT NULL,
  scripture      TEXT NOT NULL,
  source_url     TEXT NOT NULL,
  sermon_text    TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wesley_title
  ON public.john_wesley_sermons (title);

ALTER TABLE public.john_wesley_sermons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON public.john_wesley_sermons;
CREATE POLICY "Allow all"
  ON public.john_wesley_sermons
  FOR ALL USING (true)
  WITH CHECK (true);
'@

$resetSql = @'
-- ============================================================
--  JOHN WESLEY 44 SERMONS - Clear Existing Rows
--  Run this after schema, before seed chunks
-- ============================================================

TRUNCATE TABLE public.john_wesley_sermons;
'@

Set-Content -Path (Join-Path $chunkDir '00_schema.sql') -Value $schemaSql -Encoding UTF8
Set-Content -Path (Join-Path $chunkDir '01_reset.sql') -Value $resetSql -Encoding UTF8

$chunkSize = $ChunkSize
$total = $sermons.Count
$part = 1

for ($start = 0; $start -lt $total; $start += $chunkSize) {
  $end = [Math]::Min($start + $chunkSize - 1, $total - 1)
  $chunk = @($sermons[$start..$end])
  $chunkJson = $chunk | ConvertTo-Json -Depth 10 -Compress

  $chunkTemplate = @'
INSERT INTO public.john_wesley_sermons (
  sermon_number,
  title,
  scripture,
  source_url,
  sermon_text
)
SELECT
  x.number,
  x.title,
  x.scripture,
  x.source,
  x.text
FROM jsonb_to_recordset(
$WESLEY_SERMONS$
__WESLEY_JSON_PAYLOAD__
$WESLEY_SERMONS$
::jsonb) AS x(
  number INTEGER,
  title TEXT,
  scripture TEXT,
  source TEXT,
  text TEXT
)
ON CONFLICT (sermon_number) DO UPDATE
SET
  title = EXCLUDED.title,
  scripture = EXCLUDED.scripture,
  source_url = EXCLUDED.source_url,
  sermon_text = EXCLUDED.sermon_text;
'@

  $chunkSql = $chunkTemplate.Replace('__WESLEY_JSON_PAYLOAD__', $chunkJson)
  $partName = $part.ToString('00')
  $chunkPath = Join-Path $chunkDir ("seed_part_$partName.sql")
  Set-Content -Path $chunkPath -Value $chunkSql -Encoding UTF8
  $part++
}

$readme = @'
Run these files in order inside Supabase SQL Editor:

1. 00_schema.sql
2. 01_reset.sql
3. seed_part_01.sql ... seed_part_NN.sql

This split avoids SQL Editor payload-size limits.
'@

Set-Content -Path (Join-Path $chunkDir 'README.txt') -Value $readme -Encoding UTF8
Write-Host "Generated chunked SQL files in: $chunkDir"
