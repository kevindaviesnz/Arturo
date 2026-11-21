# Contributing to Arturo

Thank you for your interest in contributing to Arturo!

Arturo is open-source software licensed under the [Apache License 2.0](./LICENSE). Contributions—bug reports, documentation improvements, tests, and code pull requests—are welcome.

## Reporting issues

When opening an issue:

- use synthetic or non-sensitive data only (never include API keys, credentials, personal data, or confidential documents);
- distinguish reproducible software defects from language-model output preferences; and
- include your Node.js version, the command you ran, expected behaviour, actual behaviour, and reproduction steps.

For suspected security vulnerabilities, please report them privately according to [SECURITY.md](./SECURITY.md) rather than opening a public issue.

## Submitting pull requests

1. Fork the repository and create a branch from `main`.
2. Make focused, well-tested changes under `cli/`.
3. Verify TypeScript compilation and the full test suite before opening a PR:

```bash
cd cli
npm install
npm run build
npm run test:run
```

4. Keep documentation and `/help` text aligned with implemented behaviour. The test suite enforces documentation conformance (`uiCommandReferenceDoc.test.ts` and `uiScenarioDocsConformance.test.ts`).

By submitting a contribution, you agree that it is licensed under the Apache License 2.0 as stated in Section 5 of [LICENSE](./LICENSE).

## Design principles

Changes should preserve Arturo's core operating and trust-boundary principles:

- enduring **Functions** own outcomes; **Workers** are replaceable execution resources;
- deterministic application code—not model judgment—governs consequential actions and policy enforcement;
- approval chains, policy rules, and result sign-offs remain cryptographically signed and verified;
- evidence provenance and uncertainty stay visible in user-facing output (never silently upgrade model synthesis to verified fact);
- Human authority is explicit and attributable (approval to run is separate from sign-off on the finished result);
- external side effects fail closed unless explicitly configured and authorized; and
- behaviour is documented and backed by automated tests.
