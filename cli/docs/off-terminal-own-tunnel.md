# Off-terminal sign-off on the business's own tunnel

This is the in-repo path for sign-off and set-aside from another device. The hosted relay is a later, separate project and is not used here.

TLS ends at the host computer. Arturo itself listens only on `127.0.0.1`. A hostname you control, with a certificate on this computer, is what people open. A tunnel or reverse proxy may forward traffic to Arturo, but it must not decrypt the draft.

## Environment

Set these in the shell before you start the listener. Do not commit them.

- `APPROVAL_SIGNING_SECRET` — at least 32 characters, not a placeholder
- `PUBLIC_BASE_URL` — `https://` plus your hostname, not an IP, for example `https://sign.yourbusiness.example`

## Start the listener

```bash
npx ts-node scripts/startOffTerminalListener.ts
```

It prints a port on `127.0.0.1`. Leave it running.

## Put HTTPS in front

On this computer, terminate HTTPS for your hostname and forward to `127.0.0.1:<port>`. Caddy, nginx, or another proxy you already run is fine, so long as the certificate is on this computer.

If you use a tunnel so the hostname can be reached from a phone, use a mode that passes TLS through, or that only forwards to the proxy on this computer after this computer has already terminated TLS. Do not use a hosted relay or a tunnel mode that decrypts the traffic off this computer.

Then set `PUBLIC_BASE_URL` to that `https://` hostname.

## Turn the path on, then enrol and sign off

The path starts off. Turning it on is a loosening: a typed reason, a 12-hour wait, and an email notice. Anyone who can sign off may cancel during the wait. Turning it off is immediate.

A person's email address must be recorded and verified with a one-time code before any enrolment or sign-off link is sent. The owner starts enrolment at the terminal. The person sets up a device check on their own phone. There is then a 12-hour wait, and the owner confirms at the terminal only if the person told them themselves that they set it up.

Sign-off and set-aside on the page always require a device check, and they go through the same `signOffTaskResult` and `setAsideTaskResult` functions as the terminal.

## Real-person test gate

Before later work (including a hosted relay) is built, one real person who does not use the terminal must enrol and sign off one result from their own phone, unaided, timed, on this tunnel path. If they cannot, the rest is not built.

The exact steps are in `formatRealPersonTestInstructions()` (`src/offterminal/realPersonTest.ts`).
