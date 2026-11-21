# Arturo Customer Scenarios

This directory contains **10 realistic customer personas and end-to-end scenarios** used to evaluate Arturo's command-line interface (`npm run ui`), governance boundaries, and UX clarity.

Each file is written both as:
1. A **concrete test scenario** exercising a distinct combination of Arturo MVP capabilities and trust boundaries; and
2. A **reusable customer review persona** (following the format of Amy Wise and John Smith) so each customer can candidly critique proposed UI/UX or feature changes from their real day-to-day work.

## Scenario Index

| # | Customer & Business | Size & Sector | Blueprint / Pattern | Core MVP Features Exercised | Primary Trust Boundary | File |
|---|---|---|---|---|---|---|
| 01 | **Amy Wise**, Harbour Legal | Solo · Law practice | Document review & strict locks | `.docx` clause review, go-ahead vs. sign-off, set-aside, client intake, audit trail | Professional supervision, confidentiality, no rubber-stamping | [01-amy-wise-harbour-legal.md](./01-amy-wise-harbour-legal.md) |
| 02 | **John Smith**, Silverdale Publishing | 1 owner + freelancers · Children's books | Editorial pipeline & multi-step route | 3-step onboarding, word-limit checks, AI check before sign-off, 2-step route, multi-user roles | Separate sign-offs per document, rights/money stop at owner | [02-john-smith-silverdale-publishing.md](./02-john-smith-silverdale-publishing.md) |
| 03 | **Priya Nair**, Koru Learning Toys | 5 staff · Children's product design | Prototyper (Blueprint 5) | Deterministic `require-approval` Governance rules, physical drop-test Human Task, revision loop | Safety assessments never self-approve; AI text ≠ physical test | [03-priya-nair-koru-learning-toys.md](./03-priya-nair-koru-learning-toys.md) |
| 04 | **Dave Callaghan**, Callaghan Electrical | 4 staff · Local electrical trade | Dispatcher (Blueprint 2) | AI-drafted scope & job sheets, mobile `/work` hand-off for field crew, missing-ability refusal | AI drafts only — never emails clients or alters accounting records | [04-dave-callaghan-callaghan-electrical.md](./04-dave-callaghan-callaghan-electrical.md) |
| 05 | **Hannah Reid**, Tawa Accounting | 3 staff · Bookkeeping & advisory | Needs-input reply loop | Conversational client intake, **Needs-Input Reply Loop** with CSV/note attachment, team sign-in | Incomplete data pauses for clarification instead of guessing | [05-hannah-reid-tawa-accounting.md](./05-hannah-reid-tawa-accounting.md) |
| 06 | **Dr. Sam Patel**, Kestrel Clinical Research | 4 staff · Health research consultancy | Evidence & versioned Artefacts | Exact-version Artefact review (`@1` → `@2`), provenance badges, Audit Timeline inspection | Supplied evidence strictly separated from unverified model synthesis | [06-sam-patel-kestrel-clinical-research.md](./06-sam-patel-kestrel-clinical-research.md) |
| 07 | **Rachel Tang**, Threadline Apparel | 6 staff · Boutique fashion brand | Orchestrator (Blueprint 4) | Watched folder ingestion, parallel AI costing + Human designer `/work` file upload | Signed-off brief required before downstream human hand-off | [07-rachel-tang-threadline-apparel.md](./07-rachel-tang-threadline-apparel.md) |
| 08 | **Marcus Webb**, Southern Freight Co. | 12 staff · Regional warehousing | Sensor (Blueprint 3) | Mobile physical inspection capture → AI damage/claim drafting → manager sign-off | Only humans observe physical reality; AI reasons only from logged findings | [08-marcus-webb-southern-freight.md](./08-marcus-webb-southern-freight.md) |
| 09 | **Aroha Te Whare**, Rangatahi Trust | 2 staff + volunteers · Community charity | High-trust governance & local-first | Multi-approver safeguarding policy, local-first model transparency, non-technical volunteer UX | Sensitive youth data stays local; no single-click bypass of safeguarding | [09-aroha-te-whare-rangatahi-trust.md](./09-aroha-te-whare-rangatahi-trust.md) |
| 10 | **Ben Kowalski**, ClearView SaaS | 8 staff · B2B software | Pure Digital Pipeline + Event-driven (Blueprints 1 & 6) | Scheduled recurring Tasks, Event-driven downstream review, deny rules, model budget panel | Zero unauthorized external/shell/email execution; bounded external spend | [10-ben-kowalski-clearview-saas.md](./10-ben-kowalski-clearview-saas.md) |

## Synthetic Data Rule

Every person, business, client, document, and matter in these scenarios is fictional. Never use real customer or personal data when running scenarios.
