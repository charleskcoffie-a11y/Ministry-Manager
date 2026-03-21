
# Ministry Manager Web App

This is a React application built with TypeScript and Tailwind CSS, using Supabase for the backend.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your environment:**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
  - If you want AI to work from a shared GitHub Pages link, also set your own Supabase project URL and anon key.
  - Get your Gemini API key from: https://aistudio.google.com/app/apikey
  - Open `.env` and add your values:
     ```
    VITE_SUPABASE_URL=https://your-project-ref.supabase.co
    VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
    GEMINI_API_KEY=your-actual-api-key-here
     ```

3. **Choose an AI backend:**
  - Local only: run `npm run dev:secure` and keep Gemini on the local secure proxy.
  - Shared/public link: deploy the Supabase Edge Function in [supabase/functions/gemini-proxy/index.ts](supabase/functions/gemini-proxy/index.ts) and build the frontend with your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values.

4. **Build and preview locally:**
   ```bash
   npm run build
   npm run preview:secure
   ```
   - Open `http://localhost:4173/Ministry-Manager/` in your browser

## Build and preview

1. Install dependencies: `npm install`
2. Run a production build to ensure the bundle compiles: `npm run build`
3. Preview the built site locally with the secure Gemini proxy:
  `npm run preview:secure`
4. Open `http://localhost:4173/Ministry-Manager/` in your browser to verify the app renders instead of a blank screen.

If you only run `npm run dev` or `npm run preview`, the app still loads, but Gemini-powered features will not work unless you have also configured and deployed the Supabase Edge Function.

The `vite.config.ts` `base` value is already set to `/Ministry-Manager/` so the preview and GitHub Pages deployment load assets correctly from the subdirectory.

## Song Canvas Favorites Schema Script

- Run `npm run songs:canvas:favorites:schema` to ensure `song_canvas_favorites` exists.
- In Supabase projects without a `public.exec_sql` RPC, the script now probes `song_canvas_favorites` directly.
- If the table is already accessible, the script logs a skip message and exits successfully.
- If the RPC is unavailable and the table is missing/inaccessible, the script still fails with a clear error.

## Supabase AI Hosting

Use Supabase if you want the GitHub Pages version of the app to keep AI working without exposing your Gemini key in the browser.

1. Create or use your own Supabase project.
2. Put these values in `.env` before building the frontend:
  ```env
  VITE_SUPABASE_URL=https://your-project-ref.supabase.co
  VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
  ```
3. Install and log in to the Supabase CLI on the machine where you deploy.
4. Set the Gemini secret on Supabase:
  ```bash
  supabase secrets set GEMINI_API_KEY=your-new-gemini-key
  ```
5. Deploy the Edge Function from this repo:
  ```bash
  supabase functions deploy gemini-proxy --project-ref your-project-ref
  ```
6. Build and deploy the frontend as usual.

Once `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present at build time, the frontend will call the Supabase Edge Function automatically instead of the local proxy.

## 1. Supabase Setup (Required)

1.  Create a new project at [supabase.com](https://supabase.com).
2.  Go to the **SQL Editor** in your Supabase dashboard.
3.  Run the following SQL script to create the database schema:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Church Programs Table
create table church_programs (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  activity_description text not null,
  venue text,
  lead text,
  created_at timestamp with time zone default now()
);

-- 2. Standing Orders Table
create table standing_orders (
  id uuid primary key default uuid_generate_v4(),
  code text not null, -- e.g. "SO117"
  title text not null,
  content text not null,
  tags text[],
  is_favorite boolean default false,
  created_at timestamp with time zone default now()
);

-- 3. Tasks Table (Updated for Pastoral Tracker)
-- Drop table if it already exists
DROP TABLE IF EXISTS tasks CASCADE;

-- Recreate table
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text, -- The main task name
  category text DEFAULT 'Other', -- Preaching, Visitation, Counseling, etc.
  description text,
  task_date date NOT NULL, -- Due Date
  priority text DEFAULT 'Medium', -- Low, Medium, High, Critical
  status text DEFAULT 'Pending', -- Pending, In Progress, Completed
  
  -- Legacy fields for backward compatibility
  message text, 
  is_completed boolean DEFAULT false, 
  
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 4. Reminders Table (New)
create table reminders (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text not null, -- Sermon Prep, Visitation, etc.
  frequency text not null, -- One-time, Daily, Weekly, Monthly, Yearly
  start_date timestamp with time zone not null,
  notes text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- 5. Counseling Sessions Table (New - Confidential)
create table counseling_sessions (
  id uuid primary key default uuid_generate_v4(),
  initials text not null,
  case_type text not null, -- Marriage, Family, etc.
  summary text,
  key_issues text,
  scriptures_used text,
  action_steps text,
  prayer_points text,
  follow_up_date timestamp with time zone,
  status text default 'Open',
  created_at timestamp with time zone default now()
);

-- 6. Ideas Table (Updated with Title)
create table ideas (
  id uuid primary key default uuid_generate_v4(),
  idea_date date not null,
  title text, -- New Title Column
  place text,
  note text not null,
  created_at timestamp with time zone default now()
);

-- 7. Sermons Table
create table sermons (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  theme text,
  main_scripture text,
  
  -- New 12-Point Structure Fields
  introduction text,
  background_context text,
  main_point_1 text,
  main_point_2 text,
  main_point_3 text,
  gospel_connection text,
  conclusion text,
  altar_call text,
  
  -- JSON Arrays
  application_points jsonb default '[]'::jsonb,
  prayer_points jsonb default '[]'::jsonb,
  
  -- Legacy
  proposition text,
  outline_points jsonb default '[]'::jsonb,
  supporting_scriptures jsonb default '[]'::jsonb,
  
  date_to_preach date,
  created_at timestamp with time zone default now()
);

-- 8. Uploaded Documents (For persisting parsed Standing Orders)
create table if not exists uploaded_documents (
  id text primary key, -- We will use a fixed ID like 'standing_orders' to ensure singleton storage
  filename text,
  content jsonb,
  updated_at timestamp with time zone default now()
);

-- 9. Songs (Unified Hymnal Table)
create table songs (
  id integer primary key, -- Explicit ID from JSON
  collection text not null, -- MHB, CAN, CANTICLES_EN, CANTICLES_FANTE
  code text,
  number integer,
  title text not null,
  raw_title text,
  lyrics text not null,
  author text,
  copyright text,
  tags text,
  reference_number text,
  is_favorite boolean default false,
  created_at timestamp with time zone default now()
);

-- 10. Sermon Talk Notes (For Listening)
create table if not exists sermon_talk_notes (
  id uuid primary key default uuid_generate_v4(),
  preacher text,
  note_date date,
  location text,
  sermon_title text,
  main_scripture text,
  opening_remarks text,
  passage_context text,
  key_themes text,
  key_doctrines text,
  theological_strengths text,
  theological_questions text, 
  tone_atmosphere text,
  use_of_scripture text,
  use_of_stories text,
  audience_engagement text,
  flow_transitions text,
  memorable_phrases text,
  minister_lessons text,
  personal_challenge text,
  application_to_preaching text,
  pastoral_insights text,
  calls_to_action text,
  spiritual_challenges text,
  practical_applications text,
  prayer_points text,
  closing_scripture text,
  central_message_summary text,
  final_memorable_line text,
  followup_scriptures text,
  followup_topics text,
  followup_people text,
  followup_ministry_ideas text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 11. Sermon Talk Points (Child Table for Notes)
create table if not exists sermon_talk_points (
  id uuid primary key default uuid_generate_v4(),
  note_id uuid not null references sermon_talk_notes(id) on delete cascade,
  point_number int,
  main_point text,
  supporting_scripture text,
  key_quotes text,
  illustrations text,
  ministry_emphasis text,
  created_at timestamp with time zone default now()
);
create index if not exists idx_sermon_talk_points_note_id on sermon_talk_points(note_id);

-- 12. Daily Verses Table (New)
create table daily_verses (
  id uuid primary key default uuid_generate_v4(),
  reference text not null unique,
  translation text default 'NLT',
  text text,
  image_url text,
  date date, -- Optional specific date assignment
  created_at timestamp with time zone default now()
);

-- 13. Row Level Security (RLS) - Simple Public Access for Demo
-- In production, replace 'true' with proper auth.uid() checks
alter table church_programs enable row level security;
create policy "Public access" on church_programs for all using (true);

alter table standing_orders enable row level security;
create policy "Public access" on standing_orders for all using (true);

alter table tasks enable row level security;
create policy "Public access" on tasks for all using (true);

alter table reminders enable row level security;
create policy "Public access" on reminders for all using (true);

alter table counseling_sessions enable row level security;
create policy "Public access" on counseling_sessions for all using (true);

alter table ideas enable row level security;
create policy "Public access" on ideas for all using (true);

alter table sermons enable row level security;
create policy "Public access" on sermons for all using (true);

alter table uploaded_documents enable row level security;
create policy "Public access" on uploaded_documents for all using (true) with check (true);

alter table songs enable row level security;
create policy "Public access" on songs for all using (true);

alter table sermon_talk_notes enable row level security;
create policy "Public access" on sermon_talk_notes for all using (true);

alter table sermon_talk_points enable row level security;
create policy "Public access" on sermon_talk_points for all using (true);

alter table daily_verses enable row level security;
create policy "Public access" on daily_verses for all using (true);

-- OPTIONAL: Migration script if 'ideas' table already exists without 'title'
-- alter table ideas add column title text;
```

## Meeting Minutes – Supabase SQL Setup

Run the following SQL in your Supabase SQL Editor to set up the Meeting Minutes feature.

```sql
-- Enable UUID generation extension (if not already enabled)
create extension if not exists "pgcrypto";

---------------------------------------------------------
-- TABLE: meeting_minutes
---------------------------------------------------------
create table if not exists meeting_minutes (
  id uuid primary key default gen_random_uuid(),

  -- Basic Meeting Info
  meeting_title text not null,
  meeting_datetime timestamptz,
  meeting_type text,               -- Diocesan, Circuit, Society, Other
  meeting_type_other text,         -- Only used if meeting_type = 'Other'
  facilitator text,
  attendees text,

  -- Full structured minutes stored as JSONB
  minutes_json jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Automatically update updated_at on row changes
create or replace function update_meeting_minutes_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_meeting_minutes_timestamp
before update on meeting_minutes
for each row execute procedure update_meeting_minutes_timestamp();

-- RLS Policy (Public access for demo purposes, restrict in production)
alter table meeting_minutes enable row level security;
create policy "Public access" on meeting_minutes for all using (true);
```

### Storage Setup for Meeting Minutes

Run this to create the bucket for storing JSON backups of meeting minutes.

```sql
-- Create a storage bucket for exported JSON and Word documents
insert into storage.buckets (id, name, public)
values ('meeting-minutes-json', 'meeting-minutes-json', false)
on conflict (id) do nothing;

-- ALLOW PUBLIC UPLOAD/READ (For Demo Simplicity - In production use Authenticated policies)
create policy "Allow public upload"
on storage.objects
for insert
with check (bucket_id = 'meeting-minutes-json');

create policy "Allow public read"
on storage.objects
for select
using (bucket_id = 'meeting-minutes-json');

create policy "Allow public delete"
on storage.objects
for delete
using (bucket_id = 'meeting-minutes-json');
```

**Note on Data Structure:**
*   Top-level fields (title, type, facilitator) are stored in columns for easy searching.
*   The detailed content (Agenda items, Action items, text blocks) is stored in the `minutes_json` column.
*   Every save operation also uploads a `.json` backup file to the `meeting-minutes-json` storage bucket.

## 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key

# Optional: only for Node helper scripts that can bootstrap schema automatically.
# Never expose this in client-side code.
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### How to get these keys:

**1. Supabase Credentials:**
*   Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
*   Select your project.
*   Go to **Project Settings** (gear icon) -> **API**.
*   Copy the **Project URL** -> `VITE_SUPABASE_URL`.
*   Copy the **Project API keys** (anon / public) -> `VITE_SUPABASE_ANON_KEY`.
*   Optional: copy the **service_role** key only if you want Node helper scripts to create schema automatically -> `SUPABASE_SERVICE_ROLE_KEY`.

**2. Gemini API Key:**
*   Go to [Google AI Studio](https://aistudio.google.com/).
*   Click on **Get API key**.
*   Create a key in a new or existing Google Cloud project.
*   Copy the key string -> `GEMINI_API_KEY`.
*   For local-only AI, start the app with `npm run dev:secure` or `npm run preview:secure` so the key stays server-side.
*   For GitHub Pages or other static hosting, store `GEMINI_API_KEY` in Supabase Edge Function secrets instead of the frontend.

### John Wesley Library (Sermons + Quotes + Diary + Hymn Stories)

The app already ships with the full John Wesley sermon library in [public/wesley/sermons.json](public/wesley/sermons.json).

The app also ships with an expanded Wesley quote library in [public/wesley/quotes.json](public/wesley/quotes.json).

The app also ships with a searchable Wesley diary corpus in [public/wesley/diary.json](public/wesley/diary.json).

The diary also ships as a lightweight list index in [public/wesley/diary_index.json](public/wesley/diary_index.json) plus a full-text lookup in [public/wesley/diary_texts.json](public/wesley/diary_texts.json) so the diary tab can render faster before the full text finishes loading.

The app also ships with an expanded hymn-story corpus in [public/wesley/hymn_stories.json](public/wesley/hymn_stories.json).

The app also ships with canticle story mappings in [public/wesley/canticle_stories.json](public/wesley/canticle_stories.json).

- No Supabase table is required to read the 44 sermons in the app.
- The John Wesley page uses bundled local JSON corpora for sermons, quotes, diary entries, and hymn stories.
- A quote of the day is generated automatically from the local quote set, based on the current date.
- Wesley diary entries can be searched, filtered by year, and read directly in the `Wesley Diary` tab.
- Stories behind classic Methodist hymns can be searched and read in the `Hymn Stories` tab.
- Stories behind Methodist canticles are also available and matched by explicit collection/code references.
- When a hymn in the Hymnal matches a curated story, the reader shows a `Story Behind This Hymn` action and an in-reader story panel.
- Run `npm run sync:hymn-stories` to refresh MHB/canticle mappings from the hymnal export JSON.
- The SQL and seed scripts remain optional only if you later want a separate Supabase copy for querying or editing.

Build / refresh the diary corpus locally:

1. Run `npm run build:wesley:diary`.
2. This fetches CCEL journal pages and rewrites `public/wesley/diary.json`, `public/wesley/diary_index.json`, and `public/wesley/diary_texts.json`.

Song dedupe helper:

1. Run `npm run songs:dedupe` for a dry-run duplicate report.
2. Run `npm run songs:dedupe:apply` only when you are ready to delete exact duplicate `songs` rows.
3. The script keeps one canonical row per exact duplicate group and leaves conflicting rows untouched for manual review.
4. Run `npm run songs:dedupe:report` to export all remaining conflicting collection/code/number groups to `reports/song-conflicts.json`.
5. Run `npm run songs:dedupe:csv` to export a prioritized review template CSV at `reports/song-conflicts-review.csv`.
6. If no conflicts remain, `npm run songs:dedupe:csv` writes a header-only CSV and exits successfully with `Rows exported: 0`.
7. Full-cleanup baseline: after conflict resolution, `npm run songs:dedupe:report` should show `conflictingGroups: 0` and `exactDuplicateGroups: 0`.
8. One-off SQL cleanup scripts used during remediation are archived in `sql/archive/song-cleanup-2026-03-19/`.

Quote theme consistency checks:

1. Run `npm run hooks:install` once to enable repository-managed Git hooks.
2. Every commit will run `npm run check:wesley:themes` via `.githooks/pre-commit`.
3. Run `npm run check:wesley:themes:strict` for CI-style strict checking.

Optional Supabase sync later:

1. Run `sql/john_wesley_sermons_chunks/00_schema_min.sql` once in **Supabase -> SQL Editor -> New query**.
2. Run `npm run seed:wesley` to upsert all 44 sermons into `public.john_wesley_sermons`.
3. Run `npm run wesley:status` to verify that Supabase now has `44/44` sermons.


## 3. Running the Web App

1.  `npm install`
2.  `npm start` (or `npm run dev`)

---

## 4. Deploying to GitHub Pages

You can publish this app as a static site using GitHub Pages. The public link will be:

```
https://charleskcoffie-a11y.github.io/Ministry-Manager/
```

### Steps to Deploy

1. Push your changes to the `main` branch on GitHub.
2. GitHub Actions will build the app and publish the `dist` output to the `gh-pages` branch (the branch required by the repository's Pages settings).
3. After a few minutes, your site will be live at the link above.

> If you need to trigger a manual deployment (for example, to republish without a new commit), run the **Deploy to GitHub Pages** workflow from the Actions tab, or run `npm run build && npm run deploy` locally to push the `dist` folder to `gh-pages`.

#### Troubleshooting
- If you don't see your changes, try clearing your browser cache or wait a few minutes for GitHub Pages to update.
- Make sure the `base` in `vite.config.ts` is set to `/Ministry-Manager/`.

---
