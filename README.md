# Ministry Manager Web App

This is a React application built with TypeScript and Tailwind CSS, using Supabase for the backend.

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
  created_at timestamp with time zone default now()
);

-- 3. Tasks Table
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  task_date date not null,
  message text not null,
  is_completed boolean default false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 4. Ideas Table
create table ideas (
  id uuid primary key default uuid_generate_v4(),
  idea_date date not null,
  place text,
  note text not null,
  created_at timestamp with time zone default now()
);

-- 5. Row Level Security (RLS) - Simple Public Access for Demo
-- In production, replace 'true' with proper auth.uid() checks
alter table church_programs enable row level security;
create policy "Public access" on church_programs for all using (true);

alter table standing_orders enable row level security;
create policy "Public access" on standing_orders for all using (true);

alter table tasks enable row level security;
create policy "Public access" on tasks for all using (true);

alter table ideas enable row level security;
create policy "Public access" on ideas for all using (true);
```

## 2. Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
API_KEY=your_gemini_api_key
```

*Note: If using Vite, use `VITE_SUPABASE_URL` etc., and update `supabaseClient.ts` accordingly.*

## 3. Running the Web App

1.  `npm install`
2.  `npm start` (or `npm run dev`)

## 4. Features & Usage

*   **Programs:** Import your Excel file (Save as CSV first). The CSV headers must match: `Date`, `Activities-Description`, `Venue`, `Lead`.
*   **Standing Orders:** You can manually insert data into the `standing_orders` table via Supabase dashboard or build an administrative uploader. Search works by typing "SO 117" (code) or keywords like "discipline".
*   **Tasks:** Simple checklist.
*   **Ideas:** Journals your thoughts. Click "Expand with AI" to use Gemini to generate a sermon outline from your note.

