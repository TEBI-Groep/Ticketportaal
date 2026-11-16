# Ticketportaal Tebi — MVP-scope & fasering

Bronnen: `Opzet ticketportaal.docx`, `Extra informatie.docx`, `docs/project-context.md`.  
Alles hieronder volgt die bronnen; aannames staan expliciet gemarkeerd als **[Aanname]**.

---

## 1. Probleem & doelen

### Probleem
IT-verzoeken leven versnipperd in de IT-inbox (mail) en deels in Planner. Registratie is optioneel; leidinggevenden zien niet wat IT doet en hebben geen invloed op prioriteit. In drukke periodes verdwijnen mails; omzetten naar Planner-taken voelt als drempel.

### Doelen (na livegang)
1. Alle nieuwe IT-verzoeken staan in het ticketportaal; Planner en losse mails niet meer voor nieuwe verzoeken.
2. Elk ticket heeft binnen **2 werkdagen** categorie + status.
3. Leidinggevenden zien altijd de **top 10** en waar IT aan werkt.
4. NetSuite-aanpassingen zijn herleidbaar naar een ticket.
5. Na ~**3 maanden** merkbaar minder statusvragen aan IT (baseline vóór livegang vastleggen).

### Productprincipe (UX)
Na inloggen: **ranglijst eerst**. Ticket aanmaken of stemmen in **maximaal 3 klikken**. Tebi-huisstijl, rustig/zakelijk. Bereikbaar op PC en mobiel.

---

## 2. Explicit MVP-scope (“nu”) vs later

Ruthless prioriteit: eerste release moet mail/Planner voor **nieuwe** verzoeken vervangen, stemmen op NetSuite-wensen mogelijk maken, en IT in staat stellen tickets te claimen en status bij te houden.

### MVP IN (must voor eerste bruikbare release)

| Gebied | Wat precies |
|--------|-------------|
| Auth | Inloggen met account; zonder account alleen loginpagina |
| Rollen | Gebruiker / Manager / Uitvoerder (IT) — zie §3 |
| Tickets CRUD | Aanmaken, bekijken, bewerken (velden: zie §4) |
| Type & systeem | Type: storing / wijziging / vraag / idee; systeem: NetSuite / WMS / hardware / Outlook / overig |
| Impact (melder) | werk ligt stil / hinderlijk / wens |
| Status (IT) | Minimaal: nieuw → ingepland → in behandeling → afgerond / afgewezen (+ optioneel “wacht op melder” als één wachtstatus) |
| Prioriteit (IT) | IT zet definitieve prioriteit (los van impact/stemmen); labels o.a. Spoed / Voorrang / Belangrijk (exacte set: open vraag) |
| Categorie | Zoals in opzet (o.a. NetSuite, telefonie, WMS) — overlap met “systeem” oplossen in open vragen |
| Stemmen | Alleen op NetSuite wijzigingsverzoeken & ideeën; max **5** stemmen tegelijk, 1 per ticket; intrekken mag; stem vrij bij afgerond/afgewezen; stemmen = advies |
| Ranglijst | Openbare wensenlijst NetSuite-verzoeken, gesorteerd op stemmen; tekst dat IT definitief prioriteert |
| Spoed | Overzicht tickets met hoge impact / IT-prioriteit Spoed (storingen + spoed) |
| Mijn tickets | Overzicht van tickets die de gebruiker heeft aangemaakt (en/of waarop gestemd; **[Aanname]** start met “aangemaakt”) |
| Afgerond | Afgeronde/afgewezen tickets (filterbaar) |
| Ticketdetail | Alle kernvelden, stemknop (waar toegestaan), statusgeschiedenis light |
| IT-werk | Eenvoudig IT-overzicht: wachtrij “nieuw”, filters op systeem/prioriteit/eigenaar; claim/eigenaar zetten; streefdatum + omvang S/M/L |
| Beheer light | IT maakt accounts aan en wijst rollen toe |
| API-beveiliging | Alle endpoints achter authenticatie; pagina’s per rol afgeschermd |

### MVP OUT (bewust later of nice-to-have)

| Item | Bron | Fase |
|------|------|------|
| Bijlagen / screenshots | Opzet nice-to-have; Extra formulierveld | Fase 2 |
| Weekoverzicht | Opzet nice-to-have | Fase 2 |
| Suggestie vergelijkbare tickets bij aanmaken | Extra §1 | Fase 2 |
| Ontvangstbevestiging e-mail met ticketnummer | Extra §1 | Fase 2 |
| Volledige statusset (wacht leverancier, testen, …) | Extra §2 | Fase 2 |
| Gerelateerde/dubbele tickets koppelen + stemmen optellen | Extra §2/§5 | Fase 2 |
| Interne notities vs berichten aan melder | Extra §3 | Fase 2 |
| E-mail/Teams bij statuswijziging of reactie | Extra §3 / Opzet notificaties | Fase 2 |
| Volledig audit-logboek (wie/wat/wanneer) | Extra §3 | Fase 2 (MVP: basis created/updated) |
| Oplossingsveld / herbruikbaar antwoord | Extra §3 | Fase 2 |
| Afdelingsoverzicht alle open tickets | Extra §4 | Fase 2 |
| Openbare planning (ingepland/wachtlijst) | Extra §4 | Fase 2 |
| Vertrouwelijke tickets | Extra §4 | Fase 2 |
| Stem-toelichting + herkomst per afdeling | Extra §5 | Fase 2 |
| Auto-bericht aan alle stemmers | Extra §5 | Fase 2 |
| Volledig kanban + lijst per collega | Extra §6 | Fase 2 |
| Filters op aantal stemmen (uitgebreid) | Extra §6 | Fase 2 |
| Onderscheid dagelijks vs projecten | Extra §6 | Fase 2 |
| SLA’s per prioriteit + stilstand-signalen | Extra §7 | Fase 3 |
| Goedkeuring grote impact door leidinggevende | Extra §7 | Fase 3 |
| Bevestiging melder vóór definitief sluiten | Extra §7 | Fase 3 |
| Rapportages (volume, doorlooptijd, terugkerend, top-10 agenda) | Extra §8 / Opzet | Fase 3 |
| Zelf indienen + manager-goedkeuring | Opzet toekomst | Fase 3 |
| Kennisbank | Extra §9 | Fase 4 |
| Intake vanuit mail/Teams | Extra §9 / Opzet koppelingen | Fase 4 |
| NetSuite deep link (record/script) | Extra §9 | Fase 4 |
| Terugkerende taken | Extra §9 | Fase 4 |
| C# native apps | Opzet (niet noodzakelijk) | Niet gepland |

**[Aanname — wie mag aanmaken in MVP]**  
Opzet-rollen: alleen **Manager** maakt tickets aan; Extra: “voor alle afdelingen” een meldformulier. Voor een bruikbare vervanging van mail is het logischer dat **Managers én Uitvoerders** aanmaken in MVP, en eventueel alle medewerkers — zie open vraag Q1. Tot besluit: plan rekent met **Manager + Uitvoerder** kunnen aanmaken; Gebruiker bekijken + stemmen.

---

## 3. Rollen & rechten (MVP)

| Rol | Wie | Mag in MVP |
|-----|-----|------------|
| **Gebruiker** | Alle medewerkers met account | Inloggen; Ranglijst/Spoed/Afgerond bekijken; ticketdetail bekijken; stemmen (binnen limiet); “Mijn tickets” voor eigen stemmen **[Aanname]** of leeg tot ze manager zijn |
| **Manager** | Leidinggevenden | Alles van Gebruiker + tickets **aanmaken** + eigen tickets bewerken (inhoud tot IT oppakt) |
| **Uitvoerder** | IT | Alles: tickets CRUD; status/prioriteit/categorie/eigenaar/streefdatum/omvang; IT-bord; gebruikers/rollen beheren |

Niet in MVP: aparte “alleen-afdeling-zicht”, vertrouwelijkheid-ACL, manager-goedkeuringsworkflow.

---

## 4. Kernentiteiten & velden (MVP)

### User
| Veld | Toelichting |
|------|-------------|
| id | Intern |
| naam, e-mail | Uniek e-mail voor login |
| wachtwoord-hash | Of provider-auth — open besluit §6 |
| rol | `gebruiker` \| `manager` \| `uitvoerder` |
| afdeling | Voor latere filters; **[Aanname]** wel opslaan in MVP als optioneel/verplicht bij account |
| actief | Soft-disable |
| created_at | |

### Ticket
| Veld | Wie vult | MVP |
|------|----------|-----|
| ticketnummer | Systeem (uniek, leesbaar) | Ja |
| onderwerp | Melder | Ja |
| omschrijving | Melder | Ja |
| afdeling | Melder / account | Ja (keuzelijst) |
| type | storing \| wijziging \| vraag \| idee | Ja |
| systeem | NetSuite \| WMS \| hardware \| Outlook \| overig | Ja |
| impact | stil \| hinderlijk \| wens | Ja |
| categorie | IT (binnen 2 werkdagen) | Ja |
| status | IT; start `nieuw` | Ja (beperkte set) |
| prioriteit | IT (definitief) | Ja |
| melder_id | Systeem | Ja |
| eigenaar_id | IT (nullable tot claim) | Ja |
| streefdatum | IT | Ja (optioneel tot IT vult) |
| omvang | S \| M \| L | Ja (optioneel tot IT vult) |
| stemmen_count | Afgeleid | Ja |
| created_at / updated_at | Systeem | Ja |
| bijlage | — | Nee (fase 2) |
| oplossing | — | Nee (fase 2) |
| vertrouwelijk | — | Nee (fase 2) |

### Vote
| Veld | Toelichting |
|------|-------------|
| id | |
| ticket_id | Alleen als ticket type ∈ {wijziging, idee} én systeem = NetSuite én status niet afgerond/afgewezen |
| user_id | Uniek per (ticket, user) |
| created_at | |
| toelichting | Nee in MVP (fase 2) |

Business rules MVP:
- Max 5 actieve stemmen per user; intrekken mag; vrijgeven bij afgerond/afgewezen.
- Stemmen wijzigen IT-prioriteit **niet** automatisch.
- Storingen: geen stemmen; prioriteit via impact + IT.

---

## 5. Schermen & userflows (MVP)

Navigatie (4 hoofdpagina’s uit opzet): **Ranglijst | Spoed | Mijn tickets | Afgerond**  
Plus: Inloggen, Ticket aanmaken, Ticketdetail, IT-werkbord (alleen Uitvoerder), Gebruikersbeheer (alleen Uitvoerder).

### Flow A — Inloggen → Ranglijst
1. Login → landt op **Ranglijst** (NetSuite-wensen op stemmen).
2. Duidelijke disclaimer: stemmen = advies; IT bepaalt prioriteit.

### Flow B — Ticket aanmaken (≤3 klikken vanaf landingspagina)
1. CTA “Nieuw ticket” (Manager/Uitvoerder).
2. Formulier: onderwerp, omschrijving, afdeling, type, systeem, impact.
3. Opslaan → detail met ticketnummer; status `nieuw`.  
Geen bijlage, geen similar-ticket suggestie in MVP.

### Flow C — Stemmen
1. Op Ranglijst of detail van stem-baar ticket: “Stem” / “Stem intrekken”.
2. Blokkade + uitleg als limiet 5 bereikt of ticket niet stem-baar.

### Flow D — Spoed
Lijst van open tickets met impact “werk ligt stil” en/of IT-prioriteit Spoed, nieuwste/hoogste eerst. Doel: storingen niet onder wensenlijst verdwijnen.

### Flow E — Mijn tickets
Tickets waar `melder_id = current user` (en eventueel gestemde — Q2). Klik → detail.

### Flow F — Afgerond
Filter status afgerond/afgewezen; zoeken op onderwerp/ticketnummer light.

### Flow G — Ticketdetail
Toont alle MVP-velden; stemactie; voor IT: inline edit status, prioriteit, categorie, eigenaar, streefdatum, omvang.  
Reacties: **[Aanname]** één open commentaarthread in MVP (geen interne/externe split).

### Flow H — IT-werkbord (Uitvoerder)
- Tab/sectie **Wachtrij**: status `nieuw`, ongeclaimed.
- Tab/sectie **In behandeling**: gegroepeerd of gefilterd op eigenaar.
- Filters: systeem, prioriteit, eigenaar.  
Geen volledige kanban-drag in MVP (**[Aanname]** status wijzigen via dropdown volstaat).

### Flow I — Gebruikersbeheer (Uitvoerder)
Account aanmaken, rol/afdeling zetten, deactiveren.

---

## 6. Tech stack & hosting (uit briefs) + open besluiten

| Laag | Richting uit bronnen | Open besluit |
|------|----------------------|--------------|
| App | Webapp, PC + mobiel | — |
| Framework | **Next.js + TypeScript** | App Router vs Pages; monorepo of single app |
| Backend | Web ↔ API ↔ DB (Next route handlers of aparte API) | Alles-in-Next vs losse API |
| DB | **SQL**; schaalbaar ontwerp; later **Supabase** Pro als data groeit | Postgres via Cloud 86 vs **Supabase** vanaf dag 1 |
| Hosting | Interesse **Cloud 86** (centraal) | Past Node/Next op Cloud 86? Limieten? Anders Vercel + DB elders |
| Auth | Users met rol + wachtwoord; IT maakt accounts | Eigen credentials vs Supabase Auth / Microsoft Entra (Tebi M365?) |
| Beveiliging | Rol-gated pages; alle API’s authenticated | Session strategy (cookie/JWT) |
| C# | Genoemd voor native apps; **niet noodzakelijk** | Buiten scope |

**Aanbeveling om te valideren vóór bouw:** Next.js + Postgres. Als Cloud 86 Next slecht ondersteunt → host app elders, DB/auth eventueel Supabase; documenteer keuze in technisch ontwerp (fase Ontwerp).

---

## 7. Gefaseerde roadmap na MVP

### Fase 0 — Analyse & ontwerp (vóór code)
Eisen vastzetten (open vragen §9), wireframes 4 hoofdpagina’s + create/detail/IT, datamodel, hosting/auth-PoC.

### Fase 1 — MVP (deze scope)
Auth, rollen, tickets, stemmen, 4 hoofdpagina’s, detail, create, IT-wachtrij/filters, user admin. Livegang: nieuwe verzoeken alleen via portaal.

### Fase 2 — Communicatie & samenwerking
Bijlagen; similar-ticket suggesties; e-mailontvangstbevestiging; e-mail/Teams bij status/reactie; interne vs externe comments; oplossingsveld; dubbele tickets samenvoegen (+ stemmen optellen); afdelingsinzage; openbare planning; vertrouwelijk; stem-toelichting & afdelingsherkomst; IT-kanban + per-persoon; uitgebreidere statusset; weekoverzicht.

### Fase 3 — Bewaking & sturing
SLA’s + stilstand/streefdatum-signalen; goedkeuring hoge impact; melder-bevestiging vóór close; rapportages (volume, doorlooptijd, terugkerend, top-10 NetSuite voor MT); zelf-indienen + manager-goedkeuring indien gewenst.

### Fase 4 — Ecosystem
Kennisbank; mail/Teams-intake; NetSuite deep links; terugkerende taken.

---

## 8. Succesmetrics / acceptatiecriteria MVP

### Functioneel (go/no-go live)
- [ ] Gebruiker zonder login komt alleen op loginpagina.
- [ ] Na login landt gebruiker op Ranglijst.
- [ ] Manager/Uitvoerder maakt ticket in ≤3 klikken vanaf landingspagina; krijgt uniek ticketnummer; status start op `nieuw`.
- [ ] Verplichte create-velden: onderwerp, omschrijving, afdeling, type, systeem, impact.
- [ ] IT zet binnen flow categorie, status, prioriteit, eigenaar; streefdatum/omvang kunnen.
- [ ] Stemmen alleen op NetSuite + (wijziging|idee); limiet 5; intrekken werkt; ranking sorteert op stemmen.
- [ ] Spoed toont stilliggende/spoed-tickets gescheiden van wensenlijst.
- [ ] Mijn tickets / Afgerond tonen juiste subsets.
- [ ] Gebruiker kan geen IT-velden of user-admin bereiken; API weigert dit ook.
- [ ] Op PC én mobiele browser bruikbaar (kernflows).

### Organisatie (eerste 2–12 weken na live)
- [ ] Beleid gecommuniceerd: nieuwe IT-verzoeken niet meer via Planner/nieuwe mail-threads.
- [ ] Baseline “statusvragen aan IT” per week vastgelegd vóór of bij livegang.
- [ ] Steekproef: ≥X% nieuwe verzoeken heeft binnen 2 werkdagen categorie + status (X te bepalen, voorstel 90%).
- [ ] Leidinggevenden bevestigen dat top 10 + IT-werk zichtbaar is zonder IT te appen.

### Expliciet géén MVP-acceptatie
Bijlagen, notificaties, rapportage-dashboards, SLA-alerts, NetSuite-koppeling.

---

## 9. Open vragen (besluit Jorik/Tebi vóór bouw)

| # | Vraag | Waarom blokkerend |
|---|-------|-------------------|
| **Q1** | Wie mag tickets aanmaken in MVP: alleen Manager, of alle medewerkers? | Bepaalt of mail echt verdwijnt voor werkvloer |
| **Q2** | Is “Mijn tickets” alleen aangemaakte tickets, of ook gestemde? | Navigatie/UX |
| **Q3** | Exacte prioriteitslabels (Spoed/Voorrang/Belangrijk/…)? | Datamodel + Spoed-filter |
| **Q4** | “Categorie” vs “systeem”: één veld of beide? | Opzet noemt beide concepten |
| **Q5** | Auth: lokale wachtwoorden (IT-provisioned) of Microsoft/Entra / Supabase Auth? | Bouwweek 1 |
| **Q6** | Hosting: Cloud 86 voor Next.js haalbaar, of app elders + Cloud 86 alleen DB/andere diensten? | Infrastructuur |
| **Q7** | DB vanaf dag 1: managed Postgres (Cloud 86) of Supabase? | Auth, storage (bijlagen fase 2), RLS |
| **Q8** | Commentaar in MVP: ja (één thread) of helemaal geen reacties tot fase 2? | Scope detailpagina |
| **Q9** | Afdelingenlijst (vaste enum) — welke waarden? | Create-form + latere rapportage |
| **Q10** | Seed/migratie: bestaande Planner/open mail-items overzetten of clean start? | Livegang |
| **Q11** | Wanneer telt NetSuite-traceability (doel 4): handmatig ticketnummer in change notes, of pas fase 4 deep link? | Acceptatie doel 4 in MVP-periode |
| **Q12** | Soft launch (alleen IT + managers) vs big-bang heel Tebi? | Testfase & training |

---

## Bronmapping (kort)

- Probleem, doelen, must/nice/later, rollen, Next/TS, SQL, Cloud 86, Supabase-schaal, UX 3-klikken, 4 pagina’s → **Opzet**.
- Formuliervelden, stemregels NetSuite, IT-statussen/eigenaar/SML, communicatie, afdelingsinzage, kanban, SLA, rapportage, latere uitbreidingen → **Extra informatie** (groot deel bewust ná MVP).
- Samenvattende projectcontext → `docs/project-context.md`.
