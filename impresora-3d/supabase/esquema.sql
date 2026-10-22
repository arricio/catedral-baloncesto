-- ════════════════════════════════════════════════════════════════
--  IMPRESORA 3D · Esquema de Supabase (plan gratuito)
--  Pégalo en Supabase → SQL Editor → «New query» → «Run».
--  Cada usuario solo puede ver y modificar SUS datos (Row Level Security).
-- ════════════════════════════════════════════════════════════════

create table if not exists public.carpetas (
  id          text not null,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  nombre      text not null,
  creado      bigint not null,
  actualizado bigint not null,
  primary key (user_id, id)
);

create table if not exists public.modelos (
  id          text not null,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  carpeta_id  text not null,
  datos       jsonb not null,           -- nombre, origen, texto, estilo, colores…
  bytes       bigint not null default 0,
  creado      bigint not null,
  actualizado bigint not null,
  primary key (user_id, id)
);

alter table public.carpetas enable row level security;
alter table public.modelos  enable row level security;

drop policy if exists "carpetas propias" on public.carpetas;
create policy "carpetas propias" on public.carpetas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "modelos propios" on public.modelos;
create policy "modelos propios" on public.modelos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Almacén privado de archivos: <id-usuario>/<id-modelo>/modelo.glb, original, miniatura
insert into storage.buckets (id, name, public)
values ('impresora3d', 'impresora3d', false)
on conflict (id) do nothing;

drop policy if exists "archivos propios leer"   on storage.objects;
drop policy if exists "archivos propios subir"  on storage.objects;
drop policy if exists "archivos propios cambiar" on storage.objects;
drop policy if exists "archivos propios borrar" on storage.objects;

create policy "archivos propios leer" on storage.objects for select
  using (bucket_id = 'impresora3d' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "archivos propios subir" on storage.objects for insert
  with check (bucket_id = 'impresora3d' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "archivos propios cambiar" on storage.objects for update
  using (bucket_id = 'impresora3d' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "archivos propios borrar" on storage.objects for delete
  using (bucket_id = 'impresora3d' and (storage.foldername(name))[1] = auth.uid()::text);
