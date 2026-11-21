# Tutorial 007 — Email notification boundary

## Purpose

Configure Arturo's optional SMTP transport without confusing notification delivery with task completion, identity verification, or Worker authority.

Email is an advanced integration, not a primary terminal command. `/chat` cannot send email, and registering a Human Worker does not automatically notify them.

## Configure safely

Use a dedicated test mailbox and an untracked `.env`:

```dotenv
EMAIL_NOTIFICATIONS=true
SMTP_HOST=<test SMTP host>
SMTP_PORT=587
SMTP_USER=<test account>
SMTP_PASSWORD=<secret or application password>
SMTP_FROM=<verified sender>
PUBLIC_BASE_URL=<trusted HTTPS review URL>
HUMAN_TASK_TOKEN_SECRET=<unique random value of at least 32 characters>
```

Never commit SMTP credentials. For production, require TLS validation, secret rotation, recipient allowlisting, delivery monitoring, redaction, and an approved retention policy.

## Test only the transport

From `cli/`:

```bash
npm run test-email
```

Then run the automated integration tests without sending real mail:

```bash
npm run test:run
```

## Operational verification

When a workflow creates an email-eligible review notification, verify three separate facts:

1. Arturo recorded the Human Task or notification.
2. The SMTP provider accepted or rejected delivery.
3. The intended participant completed the task through an authorised channel.

An accepted SMTP request is not proof of inbox delivery, readership, identity, approval, or completion. Keep `EMAIL_NOTIFICATIONS=false` when email is not explicitly required.
