# Scenario 023 — Document review with an exact-version Artefact

## Goal and boundary

Civic Trust wants a person to review the exact bytes of a document before it is used, with a signed decision tied to that version. This scenario uses a synthetic sample file; Arturo records and hashes the file but does not copy, upload, publish, or send it.

## What an Artefact is

An Artefact is Arturo's record of a real file: a stable ID and exact version (e.g. `artefact-1@1`), the Enterprise and kind, the creator, the file location and media type, its SHA-256 hash, and its review state and signed decision.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Civic Trust"
                       · "Handle personal information carefully, with a person accountable for every published notice."
                       · skip
/function            → 1 · "Document Review"
                       · "Review exact document versions and record accountable decisions before use."
                       · skip
/add-human-worker    → "Document Reviewer" · 2 (reviews work before it goes out) · skip
/function start "Document Review"
/staff               → yes to each Worker it proposes
```

## Register and verify the exact version

A sample file lives at `cli/scenario_harness/assets/privacy-notice.txt`. Register it, then confirm its stored hash matches the file on disk:

```text
/artefact add "Draft privacy notice" --enterprise "Civic Trust" --kind specification --file "./scenario_harness/assets/privacy-notice.txt" --created-by "Document Reviewer"
/artefacts
/artefact inspect artefact-1
/artefact verify artefact-1@1
```

## Submit and decide on the exact version

```text
/artefact submit artefact-1@1 --reviewer "Document Reviewer" --notes "Check scope, retention, and rights statement."
/human-tasks
/artefact review artefact-1@1 --decision approve --as "Document Reviewer" --notes "Approved for use after a qualified legal check."
/artefact inspect artefact-1
/timeline
```

The decision is signed against that exact version, URI, hash, reviewer, reason, and time. A changed document must be registered as a new version; approving `artefact-1@1` never approves `artefact-1@2`.

## Safe completion condition

The exact bytes are hashed, reviewed, and signed off by a named person. A valid hash proves which bytes were reviewed; it does not prove legal compliance or quality. A qualified person must still check the real document before use.
