# Organisational identity checkpoint

A User is an authenticated person; a Human Worker is an organisational role/resource.
One User can hold memberships in multiple Enterprises and be bound to Human Workers.
AI and workflow Workers can belong to an Enterprise, but cannot impersonate a User.
Legacy Workers remain unowned local resources; migration does not invent identities.
Network decisions require resolved Enterprise scope, matching Worker ownership, and
active owner/admin/reviewer membership. A member alone cannot approve work.

## Trusted-host setup

Run from `cli/` with the runtime's `ARTURO_DATA_DIRECTORY`. First verify the person's
identity outside Arturo. Register the Human Worker and Enterprise with existing admin
commands, then use their actual identifiers:

```sh
npm run identity -- user verified-local alice "Alice Reviewer"
npm run identity -- member <enterprise-id> <returned-user-id> reviewer
npm run identity -- worker <enterprise-id> "Alice" <returned-user-id>
npm run identity -- session <returned-user-id> 15
npm run identity -- show <enterprise-id>
```

Deliver the returned session secret privately to that verified person. They open the
review server's `/session` page, paste it into the password field, and then return to
their signed review link. Exchange rotates the secret once and preserves its expiry.
The review link and authenticated session are both required for a decision. `/session`
also provides sign-out. There is no public User creation API.

Set `PUBLIC_BASE_URL` to the actual HTTPS review origin behind TLS termination; this
sets Secure cookies and allows that origin's form submissions. Cross-origin POSTs are
refused. Use the normal networked signing-secret requirements for the review server.

```sh
npm run identity -- member <enterprise-id> <user-id> reviewer suspended
npm run identity -- disable <user-id> true
```

Membership changes take effect at each decision. Disabling revokes sessions permanently;
re-enabling requires issuing a new session. Removing Workers or resetting Enterprises
removes stale ownership/membership records. Historical signed decisions are retained.

## Compatibility and boundaries

Local in-process/CLI operations remain trusted-host administration. Old signatures
without a User id continue to verify; new network approval signatures include that id.
Human Task actions record signed authenticated identity after a successful action.
Unscoped or ambiguous network work must be assigned to an Enterprise before submission;
standalone Human Tasks without a source Job currently remain trusted-local work.
Identity sessions are local opaque credentials, not an OIDC/MFA integration. This
checkpoint does not make the process safe for hostile multi-tenant hosting. Human Task
workflow transitions retain existing multi-store side-effect ordering; they are not a
new atomic transaction spanning workflow execution and identity audit.
