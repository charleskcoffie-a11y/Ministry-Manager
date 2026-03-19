alter table if exists public.sermons
    add column if not exists service_hymns jsonb;

comment on column public.sermons.service_hymns is
    'Stores selected service hymns, generation context, and optional AI guidance for sermon planning.';