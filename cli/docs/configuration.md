# Configuration

Optional settings, all off by default. You do not need any of this to install
Arturo or work through the lessons — see
[Getting started](./getting_started.md) for installation.

## Outbound web access for Workers

`ARTURO_HTTP_ALLOWED_HOSTS` lists the exact websites a Worker may contact over
HTTPS. Leave it empty to block outbound Worker web access.

Nothing reaches the network implicitly. A Worker also needs an explicit,
authorised capability before any HTTP call is attempted.

## Governed Web Search

This is separate from the general HTTP setting above. Web Search is off by
default. To enable it, choose Brave Search or an operator-controlled SearXNG
service, set a small positive call allowance, and restart Arturo. Start from
the commented settings in `.env.example`, then check the result:

```text
/web-search
```

Do not put secrets or private business information in a search query. The
search provider receives the query. Arturo saves result titles, public HTTPS
URLs, and snippets as a local evidence Artefact, but it does not open the
pages or prove that their claims are true.

## Network safety

The review service listens only on `127.0.0.1` by default. This means it is
available on your own computer. Do not expose it directly to the internet or
an untrusted network.

The Runtime WebSocket also listens on `127.0.0.1` by default. If you change it
to another network address, Arturo requires a random
`RUNTIME_WS_AUTH_TOKEN` of at least 32 characters.

Runtime messages can contain Task and workflow information. Treat them as
sensitive.

The development control panel also listens on `127.0.0.1` by default. If you
set `CONTROL_PANEL_HOST` to a non-loopback address, Arturo requires a random
`CONTROL_PANEL_AUTH_TOKEN` of at least 32 characters. The control panel exposes
kernel process and event information; do not bind it to an untrusted network.

## Signing key storage

`APPROVAL_SIGNING_SECRET` is the HMAC key used for approvals, approval
requirements, Procedure integrity, and Governance policy integrity. Use a
unique non-placeholder value of at least 32 characters.

For server-style runs, prefer `APPROVAL_SIGNING_SECRET_FILE` so the signing key
can live outside Arturo's local data directory. The path must be absolute,
must point to a regular file, must be outside `ARTURO_DATA_DIRECTORY`, and on
POSIX systems must not be readable, writable, or executable by group or others.
If both settings are present, `APPROVAL_SIGNING_SECRET` wins.

Networked services fail fast unless one of these two settings is valid. Offline
local mode can still auto-provision a local key for convenience, but that key
lives beside the data it protects and is not a production secret-storage model.

## Governance policy integrity

Governance policy rows are HMAC-signed with the approval signing key. Arturo
checks the rule content and evaluation order when policies are loaded, so a
manual database edit that changes a rule or reorders rules is detected and
policy loading fails closed.

When an existing unsigned pre-signature policy store is opened for the first
time, Arturo signs the current rows and writes a local migration marker under
`ARTURO_DATA_DIRECTORY`. Review existing policies before upgrading a database
whose local storage may have been modified by an untrusted process.

## Worker sandbox boundary

By default, AI Worker Tasks that request host filesystem or process
capabilities (`file-read`, `file-write`, `shell-read`, `shell-execute`) fail
before execution. This prevents an approved Task from silently running
unsandboxed host-impact work.

`ARTURO_WORKER_SANDBOX_MODE=required` is the default. The only current override
is `ARTURO_WORKER_SANDBOX_MODE=trusted-host-dev`, which is for deliberate local
development on a trusted single-user host. Arturo does not yet provide a
production OS/container sandbox for those capabilities.

## Running without a person present (headless)

In a CI pipeline, a pipe, or with `ARTURO_NON_INTERACTIVE=true`, Arturo treats
the session as non-interactive. Commands that would wait for an answer refuse
with guidance instead of hanging, and work that needs a Human approval stays
blocked rather than running on its own. Headless never turns a Human-approval
gate into automatic execution.

## Which model does the thinking

`ARTURO_LLM_PROVIDER` and `ARTURO_LLM_MODEL` set the starting model. After
that, `/model` is how the choice is made and it is remembered across restarts.
Arturo never uses a paid model unless you choose one there and answer yes to a
question that names the cost.

See [Model routing](../../docs/Model_Routing.md) for the local-first policy,
approved aliases, and the session call cap.
