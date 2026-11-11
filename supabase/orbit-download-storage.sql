-- Orbit Windows installer: authenticated, short-lived downloads.
-- Run once in the Supabase SQL Editor for the Orbit project.

insert into storage.buckets (id, name, public)
values ('orbit-downloads', 'orbit-downloads', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated Orbit users can download the agent" on storage.objects;
create policy "Authenticated Orbit users can download the agent"
on storage.objects
for select
to authenticated
using (bucket_id = 'orbit-downloads');
