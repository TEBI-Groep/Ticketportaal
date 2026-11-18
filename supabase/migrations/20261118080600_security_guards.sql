-- Column-level guards (RLS alone cannot restrict columns)

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_uitvoerder() then
    if new.rol is distinct from old.rol
       or new.actief is distinct from old.actief
       or new.email is distinct from old.email
       or new.afdeling_id is distinct from old.afdeling_id
       or new.id is distinct from old.id then
      raise exception 'alleen uitvoerder mag rol, e-mail, afdeling of actief wijzigen';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

create or replace function public.protect_ticket_melder_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_uitvoerder() then
    return new;
  end if;

  -- Melder may only tweak content while status is still nieuw
  if auth.uid() = old.melder_id and old.status = 'nieuw' then
    if new.status is distinct from old.status
       or new.prioriteit is distinct from old.prioriteit
       or new.categorie is distinct from old.categorie
       or new.eigenaar_id is distinct from old.eigenaar_id
       or new.streefdatum is distinct from old.streefdatum
       or new.omvang is distinct from old.omvang
       or new.oplossing_samenvatting is distinct from old.oplossing_samenvatting
       or new.vertrouwelijk is distinct from old.vertrouwelijk
       or new.melder_id is distinct from old.melder_id
       or new.ticketnummer is distinct from old.ticketnummer
       or new.closed_at is distinct from old.closed_at
       or new.melder_bevestigd_at is distinct from old.melder_bevestigd_at
       or new.netsuite_ref is distinct from old.netsuite_ref then
      raise exception 'melder mag alleen inhoud wijzigen zolang status nieuw is';
    end if;
    return new;
  end if;

  raise exception 'geen rechten om dit ticket te wijzigen';
end;
$$;

create trigger tickets_protect_melder_update
  before update on public.tickets
  for each row execute function public.protect_ticket_melder_update();
