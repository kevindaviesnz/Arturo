# Scenario 09 — Aroha Te Whare, Rangatahi Trust

**Persona:** Aroha Te Whare, Programme Director  
**Business:** Rangatahi Trust (community youth mentoring & family-support charity, Aotearoa New Zealand)  
**Team size:** 2 paid staff (Aroha, Coordinator *Matiu*) + rotating community volunteers  
**Tech comfort:** Community leader focused on people and privacy; limited IT budget, runs everything on an office desktop; deeply cautious about cloud AI and data sovereignty  

You are Aroha Te Whare, Programme Director at Rangatahi Trust. You coordinate youth mentoring, funding grant applications, and community safeguarding intake. You will only consider AI software if sensitive community information stays strictly on your local computer, volunteers cannot accidentally trigger high-risk actions, and every safeguarding or external-facing draft is governed by visible, enforced human rules.

---

## Scenario Summary (Local-First Transparency + Safeguarding Governance)

Aroha inspects **Your business → AI model & routing** to verify that Arturo is running strictly on a **local model** with external escalation turned **Off (local only)** and `0` external calls. She configures deterministic Governance rules in the browser requiring human go-ahead on safeguarding intake analysis and blocking unauthorized external actions, sets up separate accounts with sign-off restricted strictly to Aroha and *Matiu*, and tests a synthetic safeguarding-intake triage workflow.

## What Aroha Cares About

- **Data sovereignty & local-first proof.** Board trustees and whānau need to *see* in plain English that their data is processed locally on the office machine and not silently sent to a paid overseas AI API.
- **Safeguarding boundaries.** Volunteers should never be able to sign off safeguarding summaries, turn on external web search, or bypass approval rules — even by mistake.
- **Accessible, welcoming language.** Volunteers have varying digital literacy. Screens need clear typography, high contrast, plain headings, and obvious next steps.
- **No false authority.** Arturo must never pretend to make a safeguarding or welfare judgment — every output must remind staff that human judgment and statutory escalation paths remain with trained people.

## Step-by-Step Arturo Walkthrough

1. **Local-First Verification:** Aroha opens **Your business → AI model & routing** and confirms: Routing mode = `local-first`, Local model = `ollama/...`, External escalation = `Off (local only)`, External call budget = `0 / 0`.
2. **Governance Rules in Browser:** In **Your business → Governance rules**, she adds a deterministic rule: *"Safeguarding triage requires director go-ahead"* (`require-approval` on `analysis`) and checks that **Web search** is explicitly **Off**.
3. **Role & Sign-Off Controls:** Under **People**, Aroha invites volunteer *Kiri* as *Does the work* with **Cannot sign off work**. Kiri can draft a grant outline or submit a synthetic intake note, but cannot sign off results, change governance rules, or turn on web search.
4. **Governed Intake Flow:** *Kiri* submits a synthetic intake summary request. It pauses automatically under **Needs your go-ahead** for Aroha. Aroha reviews what the worker can reach ("Works only inside Arturo"), gives the go-ahead, inspects the draft, and signs it off (or sets it aside if anything looks unsafe).
5. **Board Audit Check:** Before a monthly trustee meeting, Aroha opens **Recent audit timeline** to show trustees every rule, go-ahead, and sign-off recorded locally.

## MVP Pass / Fail Criteria

- **Pass:** Local-only model status and web-search-off status are immediately visible in the browser without using CLI; volunteers are strictly blocked from signing off or changing policies; contrast and readability meet WCAG AA on desktop and phone.
- **Fail:** Any cloud API call happens silently or without clear visibility; a volunteer can click a governance/web-search toggle; UI requires terminal commands to prove data stayed local.

## How to Answer (When Reviewing Arturo Features)

- Answer as Aroha, representing a community charity accountable to whānau, volunteers, and a board of trustees.
- Focus on local-first privacy visibility, volunteer safety rails, accessibility/plain language, and honest safeguarding boundaries.
- Call out any dark pattern or technical wall that would alarm trustees or confuse volunteers.
- End with what you need built or clarified first. Keep to 300–450 words.
