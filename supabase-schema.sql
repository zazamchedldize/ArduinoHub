-- ArduinoHub: გაუშვით მთლიანად Supabase SQL Editor-ში.
-- ეს სკრიპტი არ ქმნის Auth მომხმარებლებს; ისინი Dashboard → Authentication-ში იქმნება.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null check (char_length(trim(description)) between 1 and 5000),
  components text,
  how_it_was_made text,
  code text,
  category text not null check (category in ('Arduino','Robotics','Sensors','Automation','LED','LCD','IoT','Other')),
  author text not null check (char_length(trim(author)) between 1 and 80),
  author_id uuid not null default auth.uid() references auth.users(id),
  image_url text,
  video_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_public_listing_idx on public.projects (created_at desc) where published = true;
create index if not exists projects_author_idx on public.projects (author_id, created_at desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()) $$;

create or replace function public.set_project_audit_fields()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin
  new.updated_at = now();
  if tg_op = 'INSERT' then new.author_id = auth.uid(); end if;
  return new;
end; $$;
drop trigger if exists projects_audit_fields on public.projects;
create trigger projects_audit_fields before insert or update on public.projects for each row execute function public.set_project_audit_fields();

alter table public.admin_users enable row level security;
alter table public.projects enable row level security;
revoke all on public.admin_users, public.projects from anon;
grant select on public.projects to anon, authenticated;
grant select on public.admin_users to authenticated;
grant insert, update, delete on public.projects to authenticated;

drop policy if exists "admins can see admin registry" on public.admin_users;
create policy "admins can see admin registry" on public.admin_users for select to authenticated using (public.is_admin());
drop policy if exists "published projects are public" on public.projects;
create policy "published projects are public" on public.projects for select using (published = true or public.is_admin());
drop policy if exists "admins insert projects" on public.projects;
create policy "admins insert projects" on public.projects for insert to authenticated with check (public.is_admin() and author_id = auth.uid());
drop policy if exists "admins update projects" on public.projects;
create policy "admins update projects" on public.projects for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete projects" on public.projects;
create policy "admins delete projects" on public.projects for delete to authenticated using (public.is_admin());

-- Public buckets: საჯარო URL საჭიროა გამოქვეყნებული მედიის სანახავად; წერასა და წაშლას მხოლოდ RLS ადმინი ახორციელებს.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('project-images','project-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']),
 ('project-videos','project-videos',true,52428800,array['video/mp4','video/webm','video/ogg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins upload project images" on storage.objects;
create policy "admins upload project images" on storage.objects for insert to authenticated with check (bucket_id = 'project-images' and public.is_admin());
drop policy if exists "admins delete project images" on storage.objects;
create policy "admins delete project images" on storage.objects for delete to authenticated using (bucket_id = 'project-images' and public.is_admin());
drop policy if exists "admins upload project videos" on storage.objects;
create policy "admins upload project videos" on storage.objects for insert to authenticated with check (bucket_id = 'project-videos' and public.is_admin());
drop policy if exists "admins delete project videos" on storage.objects;
create policy "admins delete project videos" on storage.objects for delete to authenticated using (bucket_id = 'project-videos' and public.is_admin());

-- Auth-ში სამივე ანგარიში შექმნის შემდეგ, ჩაანაცვლეთ EMAIL-ები სწორი მისამართებით და გაუშვით:
-- insert into public.admin_users (user_id, username)
-- select id, 'Zaza' from auth.users where email = 'YOUR_ZAZA_EMAIL'
-- on conflict (user_id) do update set username = excluded.username;
-- გაიმეორეთ Tekla და Maia-სთვის. პაროლები აქ და source code-ში არასოდეს შეინახოთ.
