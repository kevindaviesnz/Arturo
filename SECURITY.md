# Security policy

Arturo is open-source software licensed under the Apache License 2.0. Because Arturo enforces trust boundaries, policy rules, and approval signing around AI agent execution, we take security issues seriously.

## Reporting a vulnerability

If you discover a security vulnerability, please report it **privately** rather than opening a public issue or pull request:

- Email `kdaviesnz@gmail.com` with the subject `Arturo security report`.

Please include, where safe to do so:

- the affected version or commit hash;
- a concise description and likely impact;
- minimal reproduction steps that do not expose live secrets or personal data; and
- a way to contact you for follow-up.

Do not include live credentials, API keys, or private third-party data in any report. If a credential may have been exposed, rotate or revoke it immediately.

## Security boundaries to keep in mind

- **Local single-operator CLI:** Arturo is designed as a local terminal runtime backed by SQLite. Multiple Enterprises can exist locally, but this is not production multi-tenant isolation.
- **Fail-closed host capabilities:** AI Workers cannot execute host filesystem or process capabilities unless `ARTURO_WORKER_SANDBOX_MODE=trusted-host-dev` is explicitly set for local development.
- **Outbound HTTP allowlist:** Outbound Worker HTTPS calls fail closed when `ARTURO_HTTP_ALLOWED_HOSTS` is empty.
- **Secrets management:** Never commit `cli/.env` or real signing secrets. Keep `cli/.env.example` placeholder-only.

## Governed Web Search

Web Search is disabled by default. When enabled, Arturo sends the operator's query to the configured Brave Search API or operator-controlled SearXNG service. The provider can see the query and normal network metadata. Do not put secrets, personal information, confidential designs, or private customer data in a search query.

The source-domain allowlist filters result links after the search provider responds. Arturo stores permitted titles, URLs, and snippets as a local hashed evidence Artefact. Treat every returned field as untrusted third-party data that may be wrong, misleading, or crafted to manipulate a language model.

Arturo does not follow result links or sign into social platforms. Every provider attempt counts against the process-local search allowance, including failed attempts. Keep provider credentials in the ignored `.env` file, restrict allowed domains where practical, and independently verify important sources before consequential use.
