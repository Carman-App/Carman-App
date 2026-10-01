# Carma Reports — web

The report described in *The report is the product*, built as a web app. It
reads the same `/api/v1` the mobile app uses, served by `admin/`.

It is one report whose sections switch on when the records support them:

- **Expense report** — for an owner or a shared garage. A mileage record is
  one content choice on it.
- **Work report** — for a workshop.

Every report is shown page by page before it leaves. From there it can be
downloaded or shared as a PDF, a CSV or a summary card. Each file is kept in
an archive on the device, exactly as it was sent. The app works offline.

## Run it locally

You need Postgres and the `admin/` app, which serves the API.

```bash
# admin/ — the API and the database
cd admin
cp .env.example .env                    # set DATABASE_URL and SESSION_SECRET
npm install
npx prisma migrate deploy
npm run seed                            # the demo account and garage
npx tsx scripts/seed-config-lists.ts    # service intervals, document types, …
npm run seed:reports                    # a year of demo records and a workshop
npx next dev -p 4000

# web/ — this app
cd ../web
cp .env.example .env
npm install
npm run dev                             # http://localhost:5180
```

`npm run seed:reports` can be run again at any time. It deletes and recreates
only its own rows (their ids start `seedrpt-`), with dates counted back from
today, so the demo always has a "last month". It gives the demo garage:

- three vehicles, one of them a project car;
- a second member and a former one;
- a duplicate fuel fill, plus an edited record and one entered late;
- documents that are about to expire;
- a workshop, Ralak Motors, with mechanics, customers, jobs, estimates,
  invoices and payments.

There is no end-user sign-in yet. As in the mobile app, every request
identifies itself with the `x-carma-account-id` header, set from
`VITE_DEV_ACCOUNT_ID`. `getCurrentAccountId()` in `src/api/client.ts` is the
one place to swap in real authentication.

## Check

```bash
npm run typecheck
npm run lint
npm test            # the report engine's unit tests
npm run build
```

## How it's put together

- `src/report/` — the engine. Pure functions turn the API's snapshot into a
  `ReportDoc`: sections made of figures, bars, tables, facts and notes.
  - **Deterministic:** the clock, the generation stamp and earlier versions
    are all inputs.
  - **Exact money:** amounts are whole cents throughout, so every total is
    the exact sum of its lines.
  - **Files:**
    - `expense.ts` — the expense report.
    - `mileage.ts` — the mileage record.
    - `work.ts` — the work report.
    - `csv.ts` — the CSV exports.
    - `period.ts` — period presets and tax years by country.
    - `odometer.ts` — distance and the cost-per-kilometre rules.
    - `service.ts` — service intervals, adherence and gaps.
    - `duplicates.ts` — possible duplicate records.
    - `fmt.ts` — the region's date, number and currency conventions.
- `src/render/` — draws the same `ReportDoc` in three ways:
  - `ReportView.tsx` — the reading view. It reflows with the text size and is
    structured for screen readers.
  - `ReportPdf.tsx` — the A4 PDF, made with react-pdf.
  - `card.ts` — the summary card, a PNG.

  It also holds the export plumbing:
  - `PdfPages.tsx` — draws the PDF preview with pdf.js.
  - `export.ts` — handles download, share and the archive.
- `src/screens/` — the builders, the report pages, the export panel ("Check
  it, then send it") and the archive.
- `src/data/` — API queries, with an offline copy of the records in
  IndexedDB. Report parameters live in the URL, and saved setups are kept
  here too.
- `sw/service-worker.js` — the offline service worker. The plugin in
  `vite.config.ts` fills in the build's file list.
- In `admin/`, two endpoints each return everything a report needs in one
  call: `GET /api/v1/garages/:id/report-data` and
  `GET /api/v1/workshops/:id/report-data` (see
  `src/lib/reports/report-data.ts`). That response is also the copy kept for
  offline use.

## What the brief asked for, and where it is

### Expense report

| Section | Appears when | Stories |
| --- | --- | --- |
| Cover and scope | Always. It names every filter, what is left out and who sent it | SYS-02, SYS-14, RECIP-07, RECIP-09, RECIP-10 |
| Total for the period | Always. For one vehicle, it adds all recorded spend to date | OWN-01, OWN-06, SYS-03, SYS-04 |
| By category | There is spending. In a filtered report, two categories must have records | OWN-02 |
| Against the previous period | The previous period has records | OWN-04 |
| Cost per kilometre | One vehicle, and its odometer readings support it | OWN-03, OWN-13 |
| By vehicle | More than one vehicle. Cost per km is worked out the same way for each, and fuel outliers are marked within each vehicle class | OWN-14, FLEET-01, FLEET-02, FLEET-03, FLEET-05 |
| Who spent it | The garage has more than one member | SHARE-01, SHARE-02, SHARE-07 |
| By workshop and vendor | Records come from more than one place | — |
| Planned against unplanned | There are both services and repairs | FLEET-04 |
| Service history and coverage | One vehicle | OWN-08, OWN-09, WNTY-01, WNTY-02 |
| What is due next | Documents, services or a run rate to show | OWN-07, FLEET-09 |
| Build stages | The vehicle is a project car | PROJ-01 (partly), PROJ-03, PROJ-04 (partly) |
| Every record | Always | SYS-03, TAX-03, SHARE-05, SYS-15 |

The builder also offers three content choices on the same report:

- **Leave amounts out** — a service history for a buyer (OWN-08, RECIP-10).
- **Distance only** — the one-page mileage record (OWN-13).
- **Records that mention…** — isolates one part or job (OWN-10).

### Work report

| Section | Appears when | Stories |
| --- | --- | --- |
| Invoiced in the period | Always. Shows average repair order and car count | SHOP-02, SHOP-03 |
| Invoiced and collected | Always | MECH-01 |
| Who owes, and how long | Anything is outstanding | MECH-02 |
| The bench | The workshop has more than one mechanic. The commission basis is printed | SHOP-01, SHOP-08 |
| By customer | Always. Shows concentration, new against returning, and customers not seen for a while | SHOP-06, MECH-06 |
| Approved and declined | There are estimates | SHOP-04, MECH-09 |
| Takings by method | The period is a day or a week | MECH-12 |
| Every job | Always. Shows turnaround and returns | MECH-05, MECH-10 |
| Statement | One customer is chosen | MECH-07 |
| Work record | One vehicle is chosen | MECH-11 |

### Across every report

| Stories | How the app meets them |
| --- | --- |
| SYS-01, TAX-01 | Periods are two taps away, including the tax year for each market |
| SYS-05 | Generation is deterministic, and the report notes when an earlier version differs |
| SYS-06, TAX-05 | The archive keeps the exact files sent, on this device |
| SYS-09 | File names carry the subject, scope and period |
| SYS-10 | A page-by-page preview comes before anything leaves |
| SYS-11 | The region's conventions are used throughout |
| SYS-12 | Long reports get a contents block, repeating table headers and page numbers |
| SYS-13 | Saved setups keep their scope while the period rolls forward |
| SYS-15 | Possible duplicates are shown at the builder, before generating |
| FLEET-13, RECIP-03 | A CSV comes alongside the PDF |
| RECIP-01 | The PDF stands alone, with nothing to install |
| RECIP-05 | The file size is shown, and files stay small |
| RECIP-06 | Readable in black and white, with nothing under 9 pt |
| RECIP-08 | Currency and units appear exactly as recorded |
| REACH-01 | Works offline |
| REACH-03 | Key figures stand out by size and position |
| REACH-04 | A reflowing reading view with adjustable text size |
| REACH-05 | A one-image summary card |

## Not built, and why

These stories are in scope but need data Carma doesn't record yet. Where it
matters, the report says so rather than guessing.

| Stories | What's missing |
| --- | --- |
| OWN-05, fuel consumption | Fills aren't marked as full-tank. The report states this |
| MECH-03, revenue by type of work | Jobs have no type. The report states this |
| PROJ-01 and PROJ-02, estimate against actual and the forecast | Stages have no estimate. Only the project's budget is compared |
| PROJ-03, brand and part number | Neither is stored. The report notes this under the parts table |
| OWN-06 and PROJ-04, comparison against purchase price | The purchase price isn't stored |
| SHARE-04, OWN-11, RECIP-04, PROJ-04 receipt coverage, and the attachments in OWN-10 and TAX-05 | Receipts aren't linked to records. The expense report's cover says "Receipts are not attached" |
| FLEET-07, consumables | Records carry no part class |
| MECH-10, "same system" | A return is counted as the same vehicle coming back within 30 days of an invoice |
| WNTY-03, no accident repairs | Repairs aren't marked as accident repairs |
| SHOP-04, by advisor | Estimates don't record who wrote them |

These need work on the server:

- **FLEET-14, scheduled delivery.** Saved setups are the route to it, but
  admin's notification provider is still a no-op.
- **SYS-08, expiring share links.** These need hosted documents. Today the
  PDF itself is what gets sent.
- **TAX-05, keeping reports beyond the device.** The archive keeps exact
  files in this browser. The server only records that a report was
  generated.

The 42 stories parked by the brief's §05 decisions are not built.

## Decisions worth knowing

- **Narrowed reports cover only their records.** A report narrowed by person,
  place, category or search covers those records, not the whole vehicle. It
  leaves out the service history and what is due next, and the cover says
  so.
- **Cost per kilometre has a threshold.** It needs 3 odometer readings
  spanning at least 30 days and 100 km. It isn't shown when the report is
  narrowed to some people, places or items. The rules are in
  `src/report/odometer.ts`.
- **The mileage record fits on one page.**
  - When not all of its readings fit, it lists the opening and closing
    readings and puts the rest in the CSV.
  - The room for readings is `ONE_PAGE` in `src/report/mileage.ts`, measured
    against the PDF. To re-measure, render records with more and more
    readings and find the most that stay on one page. Do this for plain
    readings, readings entered late, a rate, a two-line note and a long
    vehicle name.
  - Re-measure whenever the PDF layout changes.
  - If a record still runs over, usually because of a long note, the export
    panel warns before it is sent.
- **How offline works.**
  - The service worker keeps the app and the PDF engine on the device, about
    3.7 MB, and never touches `/api`.
  - Records come from the last copy saved in IndexedDB, and the report says
    when that copy is from.
  - A new version of the app waits until its open tabs are closed.
- **Deploying.**
  - Any static host works, provided it falls back to `index.html` for unknown
    paths.
  - Serve `sw.js` without long-lived caching.
  - If the API is on another origin, set `VITE_API_URL` here and add this
    app's origin to admin's `CORS_ALLOWED_ORIGINS`.
- **Former garage members.** While building this, admin's authorization was
  fixed: members removed from a garage used to keep access, and now lose it
  (`admin/src/lib/api/authorize.ts`).
