-- M0b: departments + profiles (+ auth signup trigger)

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  naam text not null,
  actief boolean not null default true,
  sort_order int not null default 0
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  naam text not null,
  email text not null unique,
  rol public.user_role not null default 'gebruiker',
  afdeling_id uuid references public.departments (id),
  actief boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role helpers (security definer avoids RLS recursion on profiles)
create or replace function public.current_rol()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.profiles where id = auth.uid();
$$;

create or replace function public.is_uitvoerder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select rol = 'uitvoerder' and actief from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_manager_or_uitvoerder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select rol in ('manager', 'uitvoerder') and actief from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Auto-create profile on signup (rol always starts as gebruiker; IT promotes)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, naam, email, rol)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'naam',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    'gebruiker'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.departments (code, naam, sort_order) values
  ('finance', 'Finance', 10),
  ('magazijn', 'Magazijn', 20),
  ('inkoop', 'Inkoop', 30),
  ('sales', 'Sales', 40),
  ('it', 'IT', 50),
  ('directie', 'Directie', 60);
