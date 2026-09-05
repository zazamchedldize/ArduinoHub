-- =========================================================
-- ArduinoHub / ArduinoChemistryHub
-- სრული Supabase database schema
--
-- ეს სკრიპტი:
-- 1. ქმნის admin_users ცხრილს
-- 2. ქმნის projects ცხრილს
-- 3. აყენებს RLS უსაფრთხოებას
-- 4. ქმნის project images/videos storage buckets-ს
-- 5. ქმნის კლუბის შეკრების სისტემას
--
-- IMPORTANT:
-- Auth მომხმარებლები ამ SQL-ით არ იქმნება.
-- ისინი უნდა შექმნათ:
-- Supabase Dashboard → Authentication → Users
--
-- პაროლები ამ ფაილში არასოდეს შეინახოთ.
-- =========================================================


-- =========================================================
-- EXTENSIONS
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- ADMIN USERS
-- =========================================================

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null unique
    references auth.users(id)
    on delete cascade,

  username text not null unique
    check (char_length(username) between 2 and 80),

  created_at timestamptz not null default now()
);


-- =========================================================
-- PROJECTS
-- =========================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),

  title text not null
    check (char_length(trim(title)) between 1 and 120),

  description text not null
    check (char_length(trim(description)) between 1 and 5000),

  components text,

  how_it_was_made text,

  code text,

  category text not null
    check (
      category in (
        'Arduino',
        'Robotics',
        'Sensors',
        'Automation',
        'LED',
        'LCD',
        'IoT',
        'Other'
      )
    ),

  author text not null
    check (char_length(trim(author)) between 1 and 80),

  author_id uuid not null
    default auth.uid()
    references auth.users(id),

  image_url text,

  video_url text,

  published boolean not null default false,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


-- =========================================================
-- PROJECT INDEXES
-- =========================================================

create index if not exists projects_public_listing_idx
on public.projects (created_at desc)
where published = true;

create index if not exists projects_author_idx
on public.projects (author_id, created_at desc);


-- =========================================================
-- ADMIN CHECK FUNCTION
-- =========================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;


-- =========================================================
-- PROJECT AUDIT FUNCTION
-- =========================================================

create or replace function public.set_project_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin

  new.updated_at = now();

  if tg_op = 'INSERT' then
    new.author_id = auth.uid();
  end if;

  return new;

end;
$$;


-- =========================================================
-- PROJECT AUDIT TRIGGER
-- =========================================================

drop trigger if exists projects_audit_fields
on public.projects;

create trigger projects_audit_fields
before insert or update
on public.projects
for each row
execute function public.set_project_audit_fields();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.admin_users
enable row level security;

alter table public.projects
enable row level security;


-- =========================================================
-- TABLE PERMISSIONS
-- =========================================================

revoke all
on public.admin_users, public.projects
from anon;

grant select
on public.projects
to anon, authenticated;

grant select
on public.admin_users
to authenticated;

grant insert, update, delete
on public.projects
to authenticated;


-- =========================================================
-- ADMIN USERS POLICIES
-- =========================================================

drop policy if exists
"admins can see admin registry"
on public.admin_users;

create policy
"admins can see admin registry"
on public.admin_users
for select
to authenticated
using (
  public.is_admin()
);


-- =========================================================
-- PROJECT SELECT POLICY
-- =========================================================

drop policy if exists
"published projects are public"
on public.projects;

create policy
"published projects are public"
on public.projects
for select
using (
  published = true
  or public.is_admin()
);


-- =========================================================
-- PROJECT INSERT POLICY
-- =========================================================

drop policy if exists
"admins insert projects"
on public.projects;

create policy
"admins insert projects"
on public.projects
for insert
to authenticated
with check (
  public.is_admin()
  and author_id = auth.uid()
);


-- =========================================================
-- PROJECT UPDATE POLICY
-- =========================================================

drop policy if exists
"admins update projects"
on public.projects;

create policy
"admins update projects"
on public.projects
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);


-- =========================================================
-- PROJECT DELETE POLICY
-- =========================================================

drop policy if exists
"admins delete projects"
on public.projects;

create policy
"admins delete projects"
on public.projects
for delete
to authenticated
using (
  public.is_admin()
);


-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
--
-- project-images:
-- მაქსიმუმ 5 MB
--
-- project-videos:
-- მაქსიმუმ 50 MB
--
-- დაშვებული ვიდეო ფორმატები:
-- MP4 / WebM / OGG
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
(
  'project-images',
  'project-images',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
),
(
  'project-videos',
  'project-videos',
  true,
  52428800,
  array[
    'video/mp4',
    'video/webm',
    'video/ogg'
  ]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- =========================================================
-- STORAGE POLICIES — IMAGES
-- =========================================================

drop policy if exists
"admins upload project images"
on storage.objects;

create policy
"admins upload project images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-images'
  and public.is_admin()
);


drop policy if exists
"admins delete project images"
on storage.objects;

create policy
"admins delete project images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-images'
  and public.is_admin()
);


-- =========================================================
-- STORAGE POLICIES — VIDEOS
-- =========================================================

drop policy if exists
"admins upload project videos"
on storage.objects;

create policy
"admins upload project videos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-videos'
  and public.is_admin()
);


drop policy if exists
"admins delete project videos"
on storage.objects;

create policy
"admins delete project videos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-videos'
  and public.is_admin()
);


-- =========================================================
-- CLUB MEETING
-- =========================================================
--
-- კლუბის შეკრების სისტემა.
--
-- ინახება მხოლოდ:
--   • თარიღი
--   • დრო
--   • ცვლილების ავტორი
--   • ცვლილების დრო
--
-- დღე JavaScript-ში ავტომატურად გამოითვლება
-- თარიღიდან.
--
-- ადგილმდებარეობა შეგნებულად არ არსებობს მონაცემთა ბაზაში.
--
-- მხოლოდ ერთი აქტიური შეხვედრა შეიძლება არსებობდეს.
-- id ყოველთვის 1 იქნება.
-- =========================================================


create table if not exists public.club_meeting (
  id integer primary key default 1
    check (id = 1),

  meeting_date date not null,

  meeting_time time not null,

  updated_by uuid
    references auth.users(id)
    on delete set null,

  updated_at timestamptz not null default now()
);


-- =========================================================
-- CLUB MEETING UPDATED_AT FUNCTION
-- =========================================================

create or replace function public.set_meeting_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin

  new.updated_at = now();

  new.updated_by = auth.uid();

  return new;

end;
$$;


-- =========================================================
-- CLUB MEETING TRIGGER
-- =========================================================

drop trigger if exists club_meeting_updated_at
on public.club_meeting;

create trigger club_meeting_updated_at
before insert or update
on public.club_meeting
for each row
execute function public.set_meeting_updated_at();


-- =========================================================
-- CLUB MEETING RLS
-- =========================================================

alter table public.club_meeting
enable row level security;


-- =========================================================
-- CLUB MEETING PERMISSIONS
-- =========================================================
--
-- ყველას შეუძლია მხოლოდ ნახვა.
--
-- INSERT / UPDATE / DELETE მხოლოდ authenticated
-- admin მომხმარებლებისთვის.
-- =========================================================

revoke all
on public.club_meeting
from anon;

revoke all
on public.club_meeting
from authenticated;

grant select
on public.club_meeting
to anon, authenticated;

grant insert, update, delete
on public.club_meeting
to authenticated;


-- =========================================================
-- CLUB MEETING SELECT POLICY
-- =========================================================
--
-- სტუმარსაც შეუძლია გამოქვეყნებული შეხვედრის ნახვა.
-- =========================================================

drop policy if exists
"public can view club meeting"
on public.club_meeting;

create policy
"public can view club meeting"
on public.club_meeting
for select
using (
  true
);


-- =========================================================
-- CLUB MEETING INSERT POLICY
-- =========================================================

drop policy if exists
"admins insert club meeting"
on public.club_meeting;

create policy
"admins insert club meeting"
on public.club_meeting
for insert
to authenticated
with check (
  public.is_admin()
  and id = 1
);


-- =========================================================
-- CLUB MEETING UPDATE POLICY
-- =========================================================

drop policy if exists
"admins update club meeting"
on public.club_meeting;

create policy
"admins update club meeting"
on public.club_meeting
for update
to authenticated
using (
  public.is_admin()
  and id = 1
)
with check (
  public.is_admin()
  and id = 1
);


-- =========================================================
-- CLUB MEETING DELETE POLICY
-- =========================================================

drop policy if exists
"admins delete club meeting"
on public.club_meeting;

create policy
"admins delete club meeting"
on public.club_meeting
for delete
to authenticated
using (
  public.is_admin()
  and id = 1
);


-- =========================================================
-- ADMIN ACCOUNTS
-- =========================================================
--
-- Auth მომხმარებლები ჯერ შექმენით:
--
-- Supabase Dashboard
-- → Authentication
-- → Users
-- → Add user
--
-- შემდეგ ქვემოთ მოცემული INSERT-ები გაუშვით
-- სწორი email-ებით.
--
-- მაგალითად:
--
-- insert into public.admin_users (user_id, username)
-- select id, 'Zaza'
-- from auth.users
-- where email = 'YOUR_ZAZA_EMAIL'
-- on conflict (user_id)
-- do update set username = excluded.username;
--
--
-- Tekla:
--
-- insert into public.admin_users (user_id, username)
-- select id, 'Tekla'
-- from auth.users
-- where email = 'YOUR_TEKLA_EMAIL'
-- on conflict (user_id)
-- do update set username = excluded.username;
--
--
-- Maia:
--
-- insert into public.admin_users (user_id, username)
-- select id, 'Maia'
-- from auth.users
-- where email = 'YOUR_MAIA_EMAIL'
-- on conflict (user_id)
-- do update set username = excluded.username;
--
--
-- პაროლები აქ და source code-ში არასოდეს ჩაწეროთ.
-- =========================================================
