create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Read own roles or admin" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Read own profile or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Update own profile" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  topic text not null default '',
  statement text not null,
  options jsonb not null,
  correct_index int not null,
  explanation text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index questions_subject_idx on public.questions(subject, topic);
grant select, insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "Signed-in read questions" on public.questions for select to authenticated using (true);
create policy "Admin insert questions" on public.questions for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin update questions" on public.questions for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admin delete questions" on public.questions for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_index int not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);
create index attempts_user_idx on public.attempts(user_id, created_at);
grant select, insert on public.attempts to authenticated;
grant all on public.attempts to service_role;
alter table public.attempts enable row level security;
create policy "Read own attempts" on public.attempts for select to authenticated using (user_id = auth.uid());
create policy "Insert own attempts" on public.attempts for insert to authenticated with check (user_id = auth.uid());

-- compute correctness server-side
create or replace function public.set_attempt_correct()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select (q.correct_index = new.selected_index) into new.is_correct from public.questions q where q.id = new.question_id;
  return new;
end $$;
create trigger attempts_set_correct before insert on public.attempts for each row execute function public.set_attempt_correct();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.email, ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();