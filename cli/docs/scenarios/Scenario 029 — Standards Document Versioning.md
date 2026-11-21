# Scenario 029 — Standards document versioning and exact-version review

## Goal and boundary

The Standards Office wants to reject one exact version, register a corrected version, and approve that new version — proving that approval binds to specific bytes. Synthetic sample documents only; Arturo hashes them but does not publish or distribute them.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Standards Office"
                       · "Publish only exactly-reviewed document versions, with a named approver on the record."
                       · skip
/function            → 1 · "Standards Review"
                       · "Review exact document versions and record signed decisions before publication."
                       · skip
/add-human-worker    → "Standards Approver" · 2 (reviews work before it goes out) · skip
/function start "Standards Review"
/staff               → yes to each Worker it proposes
```

## Register v1, review it, and reject it

Sample files live at `cli/scenario_harness/assets/standard-v1.txt` and `…/standard-v2.txt`.

```text
/artefact add "Cabling standard" --enterprise "Standards Office" --kind specification --file "./scenario_harness/assets/standard-v1.txt" --created-by "Standards Approver"
/artefact submit artefact-1@1 --reviewer "Standards Approver" --notes "Check scope and safety clauses."
/artefact review artefact-1@1 --decision reject --as "Standards Approver" --notes "Safety clause omits isolation before work."
```

## Register the corrected version and approve it

```text
/artefact version artefact-1 --file "./scenario_harness/assets/standard-v2.txt" --created-by "Standards Approver" --notes "Added isolation-before-work safety clause."
/artefact inspect artefact-1
/artefact verify artefact-1@2
/artefact submit artefact-1@2 --reviewer "Standards Approver" --notes "Re-review corrected safety clause."
/artefact review artefact-1@2 --decision approve --as "Standards Approver" --notes "Isolation clause now present; approved for publication after a qualified check."
/artefact inspect artefact-1
/timeline
```

Rejecting `artefact-1@1` never carries forward, and approving `artefact-1@2` binds only to those bytes. Each decision is signed against its exact version, URI, hash, reviewer, reason, and time.

## Safe completion condition

One version is rejected and a corrected version is approved, each decision bound to a specific SHA-256. A valid hash proves which bytes were reviewed; a qualified person must still confirm the standard is correct before any real use.
