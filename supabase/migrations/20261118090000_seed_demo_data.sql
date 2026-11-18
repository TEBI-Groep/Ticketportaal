-- Demo seed: Auth users + profiles + tickets/ratings/comments/it_notes
-- Password for all demo accounts: TebiDemo2026!
-- Idempotent-ish: skips if Sara already exists.

do $$
declare
  v_pwd text := crypt('TebiDemo2026!', gen_salt('bf'));
  d_finance uuid := '682e34de-0a50-473a-9e77-2be675dfdccd';
  d_magazijn uuid := '211e4896-e31b-4af6-970c-6e784f66fc05';
  d_inkoop uuid := 'dc00a767-0587-423e-a815-3316bb4c58d1';
  d_sales uuid := '56079c35-082e-4b7a-9c92-90aaa4fe0f8f';
  d_it uuid := '1ccdae54-94e1-42a8-bb0c-5c0b1c1698d3';
  d_directie uuid := '47e7b0e3-27cf-4b7c-93d5-d8b53dad98d4';
  u1 uuid := 'a0000000-0000-4000-8000-000000000001';
  u2 uuid := 'a0000000-0000-4000-8000-000000000002';
  u3 uuid := 'a0000000-0000-4000-8000-000000000003';
  u4 uuid := 'a0000000-0000-4000-8000-000000000004';
  u5 uuid := 'a0000000-0000-4000-8000-000000000005';
  u6 uuid := 'a0000000-0000-4000-8000-000000000006';
  u7 uuid := 'a0000000-0000-4000-8000-000000000007';
  u8 uuid := 'a0000000-0000-4000-8000-000000000008';
  u9 uuid := 'a0000000-0000-4000-8000-000000000009';
  u10 uuid := 'a0000000-0000-4000-8000-00000000000a';
  u11 uuid := 'a0000000-0000-4000-8000-00000000000b';
  u12 uuid := 'a0000000-0000-4000-8000-00000000000c';
  t1 uuid := 'b0000000-0000-4000-8000-000000000001';
  t2 uuid := 'b0000000-0000-4000-8000-000000000002';
  t3 uuid := 'b0000000-0000-4000-8000-000000000003';
  t4 uuid := 'b0000000-0000-4000-8000-000000000004';
  t5 uuid := 'b0000000-0000-4000-8000-000000000005';
  t6 uuid := 'b0000000-0000-4000-8000-000000000006';
  t7 uuid := 'b0000000-0000-4000-8000-000000000007';
  t8 uuid := 'b0000000-0000-4000-8000-000000000008';
  t9 uuid := 'b0000000-0000-4000-8000-000000000009';
  t10 uuid := 'b0000000-0000-4000-8000-00000000000a';
  t11 uuid := 'b0000000-0000-4000-8000-00000000000b';
begin
  if exists (select 1 from auth.users where id = u1) then
    raise notice 'Demo seed already present — skipping';
    return;
  end if;

  -- Auth users (trigger creates profiles)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    ('00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
     'sara.devries@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Sara de Vries"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated',
     'mark.jansen@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Mark Jansen"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u3, 'authenticated', 'authenticated',
     'lisa.bakker@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Lisa Bakker"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u4, 'authenticated', 'authenticated',
     'tom.vermeer@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Tom Vermeer"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u5, 'authenticated', 'authenticated',
     'noor.smits@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Noor Smits"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u6, 'authenticated', 'authenticated',
     'peter.deboer@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Peter de Boer"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u7, 'authenticated', 'authenticated',
     'anne.mulder@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Anne Mulder"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u8, 'authenticated', 'authenticated',
     'chris.veld@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Chris Veld"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u9, 'authenticated', 'authenticated',
     'erik.vos@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Erik Vos"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u10, 'authenticated', 'authenticated',
     'inge.kuipers@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Inge Kuipers"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u11, 'authenticated', 'authenticated',
     'marieke.bos@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Marieke Bos"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u12, 'authenticated', 'authenticated',
     'sanne.hof@tebi.nl', v_pwd, now(),
     '{"provider":"email","providers":["email"]}', '{"naam":"Sanne Hof"}', now(), now(), '', '', '', '');

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  select
    u.id, u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email', u.email, now(), now(), now()
  from auth.users u
  where u.id in (u1,u2,u3,u4,u5,u6,u7,u8,u9,u10,u11,u12);

  update public.profiles set naam = 'Sara de Vries', rol = 'uitvoerder', afdeling_id = d_it, actief = true where id = u1;
  update public.profiles set naam = 'Mark Jansen', rol = 'manager', afdeling_id = d_finance, actief = true where id = u2;
  update public.profiles set naam = 'Lisa Bakker', rol = 'gebruiker', afdeling_id = d_magazijn, actief = true where id = u3;
  update public.profiles set naam = 'Tom Vermeer', rol = 'manager', afdeling_id = d_sales, actief = true where id = u4;
  update public.profiles set naam = 'Noor Smits', rol = 'uitvoerder', afdeling_id = d_it, actief = true where id = u5;
  update public.profiles set naam = 'Peter de Boer', rol = 'gebruiker', afdeling_id = d_inkoop, actief = true where id = u6;
  update public.profiles set naam = 'Anne Mulder', rol = 'gebruiker', afdeling_id = d_finance, actief = true where id = u7;
  update public.profiles set naam = 'Chris Veld', rol = 'manager', afdeling_id = d_directie, actief = true where id = u8;
  update public.profiles set naam = 'Erik Vos', rol = 'gebruiker', afdeling_id = d_magazijn, actief = false where id = u9;
  update public.profiles set naam = 'Inge Kuipers', rol = 'gebruiker', afdeling_id = d_magazijn, actief = true where id = u10;
  update public.profiles set naam = 'Marieke Bos', rol = 'gebruiker', afdeling_id = d_inkoop, actief = true where id = u11;
  update public.profiles set naam = 'Sanne Hof', rol = 'gebruiker', afdeling_id = d_sales, actief = true where id = u12;

  alter table public.ratings disable trigger ratings_enforce_eligibility;

  insert into public.tickets (
    id, ticketnummer, onderwerp, omschrijving, afdeling_id, type, systeem, impact,
    status, prioriteit, melder_id, eigenaar_id, streefdatum, omvang, oplossing_samenvatting,
    created_at, updated_at
  ) values
    (t1, 'TP-104', 'Factuurexport naar Exact verbeteren',
     'De huidige CSV-export mist BTW-regels en kost Finance elke maand handmatig werk. Graag een standaard NetSuite-saved search of Suitelet.',
     d_finance, 'wijziging', 'NetSuite', 'hinderlijk', 'ingepland', 'belangrijk', u2, u5, '2026-12-01', 'M', null,
     '2026-10-02', '2026-11-10'),
    (t2, 'TP-112', 'Picklijst WMS sorteren op locatie',
     'Pickers lopen onnodig heen en weer. Sorteer picklijsten standaard op magazijnlocatie.',
     d_magazijn, 'idee', 'NetSuite', 'wens', 'nieuw', 'normaal', u3, null, null, null, null,
     '2026-10-14', '2026-11-08'),
    (t3, 'TP-118', 'Goedkeuringsflow inkooporders > €5.000',
     'Orders boven €5.000 moeten via de afdelingsmanager lopen voordat ze naar de leverancier gaan.',
     d_inkoop, 'wijziging', 'NetSuite', 'hinderlijk', 'in_behandeling', 'voorrang', u1, u5, '2026-11-28', 'L', null,
     '2026-10-20', '2026-11-12'),
    (t4, 'TP-121', 'Klantkorting zichtbaar op verkooporder',
     'Sales wil de toegekende korting meteen zien op de orderregel, niet pas op de factuur.',
     d_sales, 'idee', 'NetSuite', 'wens', 'nieuw', 'normaal', u4, null, null, null, null,
     '2026-10-28', '2026-11-05'),
    (t5, 'TP-125', 'Dashboard openstaande debiteuren',
     'Eén overzicht van openstaande posten per klant met aging buckets, filterbaar op afdeling.',
     d_finance, 'wijziging', 'NetSuite', 'hinderlijk', 'nieuw', 'normaal', u1, null, null, null, null,
     '2026-11-01', '2026-11-09'),
    (t6, 'TP-130', 'Outlook gedeelde mailbox IT bereikbaar',
     'Meerdere collega’s krijgen geen toegang meer tot it@tebi.nl sinds de migratie van vanochtend.',
     d_it, 'storing', 'Outlook', 'stil', 'in_behandeling', 'spoed', u5, u5, null, 'S', null,
     '2026-11-16', '2026-11-16'),
    (t7, 'TP-131', 'Handheld scanners magazijn offline',
     'Drie Zebra-scanners verbinden niet meer met het WMS-wifi-SSID. Picken loopt vast op zone B.',
     d_magazijn, 'storing', 'hardware', 'stil', 'nieuw', 'spoed', u3, null, null, null, null,
     '2026-11-16', '2026-11-16'),
    (t8, 'TP-098', 'WMS pickfout bij split-orders',
     'Bij orders die over twee golven gaan, verdwijnt soms een regel uit de picklijst.',
     d_magazijn, 'storing', 'WMS', 'hinderlijk', 'wacht_op_melder', 'voorrang', u1, u5, null, 'M', null,
     '2026-09-18', '2026-11-14'),
    (t9, 'TP-077', 'Printerqueue magazijn herstellen',
     'Labelprinters printten niet meer na Windows-update. IT heeft drivers opnieuw gezet.',
     d_magazijn, 'storing', 'hardware', 'stil', 'afgerond', 'spoed', u3, u5, null, 'S',
     'Driver X herinstalleren en printspooler resetten op de terminal-pc’s.',
     '2026-08-12', '2026-08-13'),
    (t10, 'TP-085', 'NetSuite rol ‘Sales Light’ aanpassen',
     'Sales Light had te veel rechten op klantprijzen. Rechten aangescherpt en getest.',
     d_sales, 'wijziging', 'NetSuite', 'wens', 'afgerond', 'normaal', u4, u5, null, 'S',
     'Permissieset bijgewerkt; documentatie in Confluence gezet.',
     '2026-09-01', '2026-09-20'),
    (t11, 'TP-090', 'Automatische herinnering open PO’s',
     'Wens voor wekelijkse mail bij openstaande inkooporders ouder dan 14 dagen.',
     d_inkoop, 'idee', 'NetSuite', 'wens', 'afgewezen', 'normaal', u2, null, null, null,
     'Afgewezen: dekt bestaande saved-search + SuiteAnalytics al voldoende.',
     '2026-09-05', '2026-10-01');

  insert into public.ratings (ticket_id, user_id, score, created_at, updated_at) values
    (t1, u1, 5, '2026-10-05', '2026-10-05'), (t1, u2, 5, '2026-10-05', '2026-10-05'),
    (t1, u3, 4, '2026-10-06', '2026-10-06'), (t1, u4, 5, '2026-10-06', '2026-10-06'),
    (t1, u5, 4, '2026-10-07', '2026-10-07'), (t1, u6, 5, '2026-10-07', '2026-10-07'),
    (t1, u7, 4, '2026-10-08', '2026-10-08'), (t1, u8, 5, '2026-10-08', '2026-10-08'),
    (t2, u3, 5, '2026-10-15', '2026-10-15'), (t2, u6, 4, '2026-10-15', '2026-10-15'),
    (t2, u9, 4, '2026-10-16', '2026-10-16'), (t2, u4, 4, '2026-10-16', '2026-10-16'),
    (t2, u2, 3, '2026-10-17', '2026-10-17'), (t2, u10, 5, '2026-10-17', '2026-10-17'),
    (t3, u6, 5, '2026-10-21', '2026-10-21'), (t3, u8, 4, '2026-10-21', '2026-10-21'),
    (t3, u2, 4, '2026-10-22', '2026-10-22'), (t3, u11, 3, '2026-10-22', '2026-10-22'),
    (t3, u4, 3, '2026-10-23', '2026-10-23'),
    (t4, u1, 3, '2026-10-29', '2026-10-29'), (t4, u4, 5, '2026-10-29', '2026-10-29'),
    (t4, u12, 4, '2026-10-30', '2026-10-30'), (t4, u2, 2, '2026-10-30', '2026-10-30'),
    (t5, u2, 4, '2026-11-02', '2026-11-02'), (t5, u7, 3, '2026-11-02', '2026-11-02'),
    (t5, u8, 2, '2026-11-03', '2026-11-03'),
    (t10, u4, 4, '2026-09-15', '2026-09-15'), (t10, u12, 5, '2026-09-15', '2026-09-15'),
    (t10, u8, 3, '2026-09-16', '2026-09-16'), (t10, u2, 4, '2026-09-16', '2026-09-16'),
    (t11, u6, 2, '2026-09-10', '2026-09-10'), (t11, u11, 3, '2026-09-10', '2026-09-10'),
    (t11, u2, 2, '2026-09-11', '2026-09-11');

  alter table public.ratings enable trigger ratings_enforce_eligibility;

  insert into public.comments (ticket_id, user_id, body, source, created_at) values
    (t1, u5, 'We kijken naar een Suitelet-export. Kunnen jullie een voorbeeld-CSV meesturen van de gewenste kolommen?', 'portal', '2026-11-08'),
    (t1, u2, 'Voorbeeld staat in de gedeelde Finance-map (FactuurExport_gewenst.xlsx). BTW per regel is het belangrijkst.', 'portal', '2026-11-09'),
    (t1, u5, 'Top, dank. Concept staat gepland voor week 48.', 'portal', '2026-11-10'),
    (t6, u5, 'Permissions opnieuw gezet op it@tebi.nl. Kunnen Verkoop en Magazijn even testen of ze erbij kunnen?', 'portal', '2026-11-16'),
    (t6, u4, 'Sales kan er weer bij — werkt hier.', 'portal', '2026-11-16'),
    (t8, u5, 'We hebben een screenshot nodig van de picklijst wanneer de regel ontbreekt. Kun je die plaatsen?', 'portal', '2026-11-14'),
    (t3, u1, 'Drempel mag later configureerbaar zijn, maar start met €5.000 zoals Directie vroeg.', 'portal', '2026-11-11');

  insert into public.it_notes (ticket_id, user_id, body, created_at, updated_at) values
    (t1, u5, 'Saved search prototype in sandbox. Let op: BTW-groep mapping wijkt af van Exact — even met Mark checken vóór go-live.', '2026-11-09', '2026-11-09'),
    (t1, u1, 'Omvang M bevestigd. Streefdatum blijft 1 dec tenzij regressie in WMS.', '2026-11-10', '2026-11-10'),
    (t6, u5, 'Exchange shared mailbox ACL opnieuw gezet. Monitoring tot morgen 12:00; daarna ticket afronden als geen klachten.', '2026-11-16', '2026-11-16'),
    (t8, u5, 'Wacht op screenshot van melder. Reproduceert niet in test-wave — mogelijk alleen split over DC2.', '2026-11-14', '2026-11-14'),
    (t3, u5, 'Workflow in draft. Goedkeurder = afdelingsmanager uit employee record; fallback Directie.', '2026-11-12', '2026-11-12');

  perform setval('public.ticket_nummer_seq', 131, true);
end $$;
