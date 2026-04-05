-- Adds optional title support used by Ideas Journal UI
alter table if exists public.ideas
add column if not exists title text;
