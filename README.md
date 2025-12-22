
# Ministry Manager Web App

This is a React application built with TypeScript and Tailwind CSS, using Supabase for the backend.

## Build and preview

1. Install dependencies: `npm install`
2. Run a production build to ensure the bundle compiles: `npm run build`
3. Preview the built site locally (mirrors the GitHub Pages base path):
   `npm run preview -- --host --port 4173 --strictPort`
4. Open `http://localhost:4173/Ministry-Manager/` in your browser to verify the app renders instead of a blank screen. When running `npm run dev`, use `http://localhost:3000/` (no subpath) because the dev server now serves from the root for convenience.

The Vite `base` path automatically switches to `/Ministry-Manager/` only for production builds so GitHub Pages still loads assets correctly, while local dev/preview uses the server root to avoid blank pages when you open the provided port directly.

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
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
API_KEY=your_gemini_api_key
```

### How to get these keys:

**1. Supabase Credentials:**
*   Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
*   Select your project.
*   Go to **Project Settings** (gear icon) -> **API**.
*   Copy the **Project URL** -> `REACT_APP_SUPABASE_URL`.
*   Copy the **Project API keys** (anon / public) -> `REACT_APP_SUPABASE_ANON_KEY`.

**2. Gemini API Key:**
*   Go to [Google AI Studio](https://aistudio.google.com/).
*   Click on **Get API key**.
*   Create a key in a new or existing Google Cloud project.
*   Copy the key string -> `API_KEY`.

*Note: If using Vite, use `VITE_SUPABASE_URL` etc., and update `supabaseClient.ts` accordingly.*


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
