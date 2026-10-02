# Carma Compliance Audit

Full audit of `mobile/` and `admin/` against both spec documents:
- **Product spec** ("Carma Vehicle Management Design.pdf") — Owner side, Workshop side, roles, consent model, plans/limits.
- **Admin console spec** ("Carma Vehicle Management Design (1).pdf") — 101 stories across 14 surfaces, 3 build phases.

Five parallel audits were run: Admin Phase ONE, Admin Phase TWO, Admin Phase THREE, Mobile Owner-side, and Workshop domain (schema/API). Each read the actual spec text, checked it against the real codebase, and fixed scoped real gaps with confidence — not a rebuild, a verification-and-repair pass.

**Overall picture**: the large majority of both specs is genuinely implemented and verified working. This pass found and fixed **~20 real bugs/gaps** that had accumulated silently across many prior build passes — mostly things that were partially wired, had drifted after later infrastructure changes, or were never actually connected end-to-end despite looking complete. It also surfaced **two real security gaps** (consent enforcement, unverified account linking) and a handful of larger feature gaps that are correctly out of scope for a fix-in-place pass (no Inspection/Estimate/Invoice creation endpoints, no mobile Mechanic UI, no trial-expiry write-gating).

---

## Admin Console — Phase ONE (Pulse, Accounts, Audit, Roles/2FA)

| ID | Status | Note |
|---|---|---|
| PULSE-01..06 | DONE | All six real: today-vs-7-day-avg with direction, alert strip, live feed (type+account only, no amounts/photos), fixed-timezone yesterday column, week-over-week, pinned metrics persisted per admin. |
| ACCT-01 | DONE (fixed) | Universal search now includes phone (via `WorkshopCustomer.phone`), previously missing. |
| ACCT-02..08 | DONE | Full detail page, onboarding trail, no-vehicle chase list, manual verification, suspend, restore, merge (real transactional preview-then-write). |
| ACCT-07 | DONE (hardened) | Account deletion now requires two-person approval (was single-click). |
| ACCT-09 | MISSING (accepted) | No device/telemetry model exists; needs a schema model + mobile write path — a real feature build, not a scoped fix. |
| ACCT-10 | PARTIAL (accepted) | Region correction works but can't retag historical record currency — no record model has a currency column. |
| AUD-01, 02, 04, 05 | DONE | Append-only audit log (DB-trigger enforced), filterable+exportable, admin role management, mandatory TOTP 2FA + session management. |
| AUD-03 | DONE (fixed) | Account deletion and admin role changes now go through real two-person approval — previously only garage-handover and refunds did. |
| AUD-06 | PARTIAL | Verified for masked-money reveals and consent-view sessions; not independently verified for every sensitive-view type. |

**New findings fixed:** two-person approval gap on deletion/role-change (real compliance gap); a stale "not wired" Pulse alert that had silently regressed after the scalability pass added a real job queue.

---

## Admin Console — Phase TWO (Garages/Vehicles, Workshops+Work, Money, Support, Trust, Messaging)

| ID | Status | Note |
|---|---|---|
| GAR-01..05, 07 | DONE | Full garage/vehicle listing, member history (former members retained), vehicle trail, odometer-fraud flagging (flag-only, never edits), duplicate-plate finder, two-person-approved ownership transfer. |
| GAR-06 | PARTIAL (new finding) | Console renders transfer history correctly, but no code path anywhere creates a `VehicleTransfer` row yet — will show empty until a handover write-path exists. |
| WORK-01..08 | DONE | Workshop listing, verification grant/revoke, bench view, job-state aging, mechanic-money (correctly separated from Carma's own revenue), outlier detection, contact log. |
| MON-01..02, 04..10 | DONE | MRR, trial cohorts, dunning, cancellations, refunds (real two-person-approved threshold), free-period grants, revenue-by-region, accountant CSV export. |
| MON-03 | DONE (honest gap) | Real table + audited "request new card" action; actual processor connection deferred (Stripe reserved, not connected). |
| MON-06 | DONE (fixed) | **Real bug**: FINANCE role — the role the spec names as owning billing — could not open the account page at all (403), despite every billing screen linking there. Fixed with a billing-scoped view. |
| SUP-01, 02, 05..08 | DONE | Ticket queue, technical-state snapshot on open, channel-native replies, category-required close, full per-account history, response/resolution metrics. |
| SUP-03 | PARTIAL (honestly scaffolded) | Consent request/grant/deny/time-box/audit all real; deliberately not wired to any actual live-data view, since that would need a real no-write guarantee this pass couldn't fully verify. |
| SUP-04 | DONE (fixed) | **Real bug**: 3 of the 6 named "common fixes" (resend invite, re-issue report link, re-run failed export) didn't exist anywhere in the codebase. Added all three. |
| TRUST-01, 02, 05, 06 | DONE | Report queue, evidence trail (entered-late markers; "edited" markers undeliverable — no `updatedAt` on money models), image takedown (preserves original), compliance-request log. |
| TRUST-03 | PARTIAL (new finding, not fixed) | Console CRUD is correct and audited, but **`CapabilityRestriction` is never checked anywhere in the live API** — restricting "no invites"/"no photo upload" has zero real enforcement today. Flagged for a follow-up scoped to the relevant API routes. |
| TRUST-04 | DONE (honest gap) | Groups by shared payment method only — no device/phone tracking exists to extend it. |
| COMM-01..06 | DONE | Segmented campaigns with a server-enforced test-send-before-live gate, frequency caps, suppression lists, template editor with variable validation, what's-new notes, in-app banners. Actual delivery honestly no-op pending real providers. |

---

## Admin Console — Phase THREE (Growth, Data Quality, Config, System, Privacy)

| ID | Status | Note |
|---|---|---|
| GROW-03 | DONE (fixed — real bug) | **Retention was measuring the wrong thing**: computed from API-activity timestamps, directly contradicting the spec's own explicit rule ("opening the app is not retention"). Rewired to measure actual record-writes. |
| GROW-01, 02, 04..08 | DONE | Funnel, signup source, invite performance, mechanic attach rate, feature adoption, geography split, engaged-accounts shortlist. |
| DATA-01..03 | DONE | Record counts by type, edited/late rates, flagged-mistake list (questions only, never auto-corrected). |
| DATA-04 | DONE (fixed) | Was missing the required "share of accounts with ≥1 report" stat — added. |
| DATA-05, 06 | PARTIAL (accepted) | Per-account storage real; per-plan breakdown not built. Sync-errors table real but empty (no mobile error-reporting pipeline). |
| CFG-01, 02, 06..08 | DONE | Country/plan/subscription-rules config, all through a real draft/publish/diff/version-history/revert mechanism. |
| CFG-02 | DONE (verified, not a bug) | Confirmed no code path can accidentally reprice a live subscriber — `Subscription.lockedPriceCents` genuinely protects them. |
| CFG-03 | DONE (fixed — real bug) | List-item "delete" was a hard, unrecoverable delete despite a ready-made soft-delete flag sitting unused right next to it. Fixed to deactivate. |
| CFG-04 | DONE (fixed — real bug) | Merge queue recorded the decision but **never actually corrected the affected vehicles**. Added the real correction cascade. |
| CFG-05 | PARTIAL (accepted) | Authoring is real; nothing reads flags yet (mobile doesn't consume config). |
| OPS-01, 06, 07 | PARTIAL (accepted) | Honest "not connected" states — no APM, no cloud billing API, no Neon Management API credentials. |
| OPS-02, 03, 05 | DONE (fixed — stale docs) | Page literally claimed "no job queue exists" and "nothing times requests" — both had become false after the scalability pass. Wired to the real data and corrected the claims; added a working per-job retry action. |
| OPS-04 | DONE | Real package version + git SHA. |
| PRIV-01..04 | DONE | Full account data export (real traversal, audited), deletion-rule disclosure, consent viewer (honestly empty — no mobile capture flow), retention-rule config. |
| PRIV-05 | DONE (fixed — real gap) | Money's billing pages already masked amounts correctly; the Data-Quality flagged-records page did not. Fixed to match. |

---

## Workshop Domain (Product Spec, mobile stub + schema/API)

| Capability | Status | Note |
|---|---|---|
| Mobile Mechanic/Workshop UI | Confirmed intentionally deferred | All 21 screens are genuine placeholder stubs — no logic, no crash risk, correctly wired into navigation. Unchanged, as planned. |
| Job intake, job-board states, plan limits | DONE | Full state machine (10 states, transition-enforced), plan-limit checks on job creation. |
| **Consent/access-grant enforcement** | **DONE (fixed — real security gap)** | `AccessGrant.expiresAt`/`revokedAt` existed in the schema but were **never read anywhere** — any workshop could attach a job to any vehicle by ID with zero consent check. This is the core mechanism the whole two-sided product depends on. Fixed. |
| **Customer-on-file account linking** | **DONE (fixed — real security gap)** | A workshop could claim any account ID belonged to a walk-in customer at creation time, unverified. Replaced with a real email-matched invite flow. |
| Invoice partial payments | DONE (fixed) | Schema supported it; no code ever created a `Payment` row. Added the endpoint. |
| Bench/staff roles | PARTIAL | Role enforcement correct where it's checked (job-line pricing now correctly excludes apprentices — fixed); no API exists yet to add staff or assignments at all. |
| Inspection/Estimate/Invoice creation | **MISSING — largest single gap found** | No endpoint anywhere creates any of these three (only reads + the estimate-decision action exist). This is a real, sizeable feature gap, not a bug — flagged for a dedicated follow-up pass, not attempted here. |
| Workshop's own reporting (by technician/customer/period) | MISSING | Only platform-operator-wide aggregation exists (Phase Two's WORK-01..08); nothing gives a workshop its own view. |
| No-marketplace-fee compliance | DONE (verified) | No commission/fee logic anywhere in the codebase. |

---

## Mobile Owner Side (Product Spec)

| Capability | Status | Note |
|---|---|---|
| Garages, vehicles, records, documents, project builds | DONE | Real API-backed CRUD throughout, attributed record entries. |
| **Reminders (all 4 kinds)** | **DONE (fixed — real bug, 3 of 4 kinds were fake)** | Only seed data ever populated reminders; no live generation existed. SERVICE_DUE, DOCUMENT_EXPIRY, and ESTIMATE_PENDING were **never created by any code path** — not even a placeholder. PROJECT_STALLED didn't exist at all. Built a real reconciliation engine for all four (PROJECT_STALLED uses a documented heuristic, since the schema has no per-stage activity timestamp — a precise fix needs a migration). |
| Timeline | DONE (fixed — real bug) | Documents were invisible in the timeline, and the "Docs" filter chip was actually filtering the wrong record types entirely. Fixed. |
| Insights | DONE | Real server-computed running cost and cost-per-km. |
| **Reports leaving the app** | **DONE (fixed — real bug, dead buttons)** | The Export/Share buttons on the report preview screen had no `onPress` handler at all. Wired to a real share action. Full PDF/CSV file generation still doesn't exist — a real gap, needs a new dependency, correctly not attempted in this pass. |
| Work from mechanics — estimates, invoices, inspections | DONE | Real approve/decline, correct "payment recorded as a fact, not processed" behavior (throws rather than faking success where no endpoint exists), real inspection viewing. |
| **Access grant time window** | **DONE (fixed)** | Backend already supported a real time-scoped grant; the mobile screen never exposed it to the owner. Added a 7/30/90-day picker. |
| Work landing automatically in vehicle timeline | PARTIAL (not fixed) | Completed jobs/invoices don't create a timeline record — flagged as belonging with a future workshop-side job-completion pass, not attempted here (would touch mechanic-side logic out of this pass's scope). |
| Account profile "Both" switching | MISSING (new finding) | Onboarding presents the choice; the actual switch screen is a stub, and there's no backend path to add a second profile. |
| **Region-driven currency** | **DONE (fixed — real bug)** | Currency was hardcoded to `"KES"` in ~20 places despite the region-selection screen and `REGION_UNITS` map already existing. Fixed app-wide. |
| Region-driven distance/volume units | MISSING (new finding, not fixed) | Still hardcoded km/litres in ~15 files — same class of bug as currency, but needs real numeric unit conversion, not just a label swap. Flagged for a dedicated pass. |
| **Plan seat limits (Free 1 / Personal 3 / Pro 10)** | **DONE (fixed — real gap)** | The limit existed on the `Plan` model but nothing ever checked it — invitations and member-adds were unconditional. Fixed server-side (counts pending invitations too, per spec: "pending holds a seat"). |
| Plan limits — 90-day history trim, CSV export | MISSING (new finding, not fixed) | Neither exists at all. Real features, not scoped-fix material. |
| Trial-expiry write-gating | MISSING (new finding, not fixed) | Nothing checks trial/subscription status before allowing new writes — only count-based plan limits exist today. |
| Not a payment processor / not telematics / not an owner-dashboard-for-workshops | DONE (verified) | All three confirmed correct by direct code inspection. |

---

## Summary counts (approximate, by story/capability, across all five audits)

- **DONE (verified working):** ~95
- **DONE (fixed this pass — real bugs/gaps closed):** ~20
- **PARTIAL (real, working, with a documented limitation):** ~15
- **MISSING (new findings, correctly not attempted — flagged for future work):** ~10
- **Known/accepted gaps (unchanged, correctly out of scope):** ~15 (OAuth, payment processor, Redis, real messaging providers, device telemetry, mobile config consumption, mobile Mechanic UI)

## The two most important findings overall

1. **Consent enforcement between owners and workshops never actually existed at the API level.** This is the mechanism the entire two-sided product model depends on ("a workshop sees a vehicle's history only while access is granted") — it was correctly modeled in the schema and correctly written to, but never read/checked anywhere. Any workshop could attach a job to any vehicle by ID. Fixed.
2. **Three of the four reminder types the mobile app displays were never actually generated by any code** — only seed data made them appear to work. A real user would have gotten zero service-due, document-expiry, or estimate-pending reminders. Fixed.

Both were things that looked complete in earlier passes (the schema existed, the UI rendered correctly when data was present) but had no real code path actually producing that data in normal use — exactly the class of gap a fresh end-to-end audit is for.

## Recommended next steps

1. Wire `CapabilityRestriction` enforcement into the actual API routes it's supposed to restrict (invites, photo uploads) — currently authored but inert.
2. Build Inspection/Estimate/Invoice creation endpoints — the single largest gap in the workshop domain, needed before the mobile Mechanic UI build could even begin.
3. Real numeric unit conversion (distance/volume) to match the already-fixed currency handling.
4. Trial-expiry write-gating.
5. Mobile Mechanic/Workshop UI build (deliberately deferred since the beginning of this project).
