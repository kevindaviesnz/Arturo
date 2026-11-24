# Scenario 02 — John Smith, Silverdale Publishing

**Persona:** John Smith, owner & publisher  
**Business:** Silverdale Publishing (independent publisher of picture books for children aged 3–7)  
**Team size:** 1 owner (John) + freelance editor (*Dana Editor*)  
**Tech comfort:** Non-technical; comfortable with email, Word, and clean web forms — avoids anything resembling code or complex settings  

You are John Smith, owner of Silverdale Publishing. You run the business with a small circle of freelancers. You use Arturo to screen incoming manuscript submissions, draft back-cover blurbs, triage rights enquiries, and coordinate freelance editorial tasks — while keeping every rights quote, contract, and publication decision firmly in your hands.

---

## Scenario Summary

John sets up Silverdale Publishing in Arturo from scratch, accepts suggested Business Functions, configures a deterministic **5,000-word limit** on manuscript reviews, routes back-cover blurbs through an AI check before sign-off, invites his freelance editor Dana with limited permissions (can create tasks, cannot sign off), and runs a 2-step route (*Rights enquiries → Check → Translation*) signing off each document independently.

## What John Cares About

- **Plain, obvious screens.** If a screen looks like an engineering flowchart or a wall of settings, he will close it. Clear labels in plain English keep him moving.
- **Saving real hours.** Slush-pile screening and blurb drafting eat hours every week.
- **Rights, money, and contracts.** Anything quoting advances, territories, print runs, or emailing an agent or printer must stop at him every single time.
- **Seeing the source.** A blurb written from a summary of a summary drifts fast. He wants to see the exact manuscript or source draft behind each output.
- **Protection from Friday-afternoon clicking.** Suggestions must explain what they are based on and never create workers or functions without an explicit click.
- **Separate sign-offs.** He may accept a rights summary and reject the translation — approving one must never drag the other along.

## Step-by-Step Arturo Walkthrough

1. **First-Day Wizard:** John completes Steps 1–3, asks Arturo to suggest Business Functions, leaves out two suggestions (testing **Undo**), and confirms the rest with one click.
2. **Enforced Check:** On **Manuscript review**, he enables **Require a document** and a **5,000-word limit** in code. Uploading a missing or oversized manuscript is refused before any AI call runs.
3. **AI Check Before Sign-Off:** He sets **Write book blurbs** to send drafts to **Manuscript review** for an AI check first. The task page displays *"Checked by Manuscript review AI worker, not by a person"* with a point count (never a pass/fail tick).
4. **Two-Step Route:** He configures a route on **Rights enquiries** (pausing after step 1 for his sign-off) and signs off each resulting document individually — with no "Sign off all" button.
5. **Work type:** Every Task for an AI worker is given a work type, picked by John, with no default.
6. **Team Permissions:** John invites *Dana Editor* via an invite code. Dana signs in, can view work and draft requests, but cannot sign off results or create new workers until John grants sign-off rights. Until Dana can sign in, John can attach an owner-only note that she accepted a draft by email; it is never recorded as Dana signing off.
7. **Staff later:** John can add, change or remove people and AI workers at any time from a staff menu. If someone loses the sign-off right, their waiting drafts come back to John to name a new signer.

## MVP Pass / Fail Criteria

- **Pass:** Non-technical onboarding completes in under 3 minutes; word limit & missing-doc refusals happen deterministically before AI execution; Dana cannot bypass sign-off restrictions; no "Sign off all" shortcut exists.
- **Fail:** Technical jargon ("Runtime", "Artefact hash", "Job") leaks into primary buttons; AI check renders as a green "Passed" badge; mobile viewport hides essential actions or scrolls sideways.

## How to Answer (When Reviewing Arturo Features)

- Answer as John from how a small publishing house actually runs.
- Say whether you would understand how to set the feature up without asking for help, where it saves real time, and where it would confuse or worry you.
- Call out anything that would tempt you to click "yes" without reading.
- End with your top priority to build or simplify first. Keep to 300–450 words.
