/**
 * The enrolment (pairing) pages served by the sign-off listener. They
 * never offer host-only steps, and they never say "passkey", "approve",
 * "phone" or "desk" (off-terminal sign-off brief).
 *
 * SIDE EFFECT: Completing enrolment may write a credential and send mail.
 */

import type { RegistrationResponseJSON } from "@simplewebauthn/server";

import { lookupOffTerminalLink } from "./offTerminalLinks";
import { completeEnrolment, enrolmentOptions } from "./passkeys";
import type { ListenerHttpResult } from "./listenerRequest";

const CSS = `
body{font:16px/1.4 system-ui,sans-serif;margin:0;padding:16px;max-width:24rem;color:#1a1a1a;background:#fff}
h1{font-size:1.25rem;font-weight:600;margin:0 0 12px}
p{margin:0 0 12px}
button{display:block;width:100%;padding:12px 16px;border:0;border-radius:8px;background:#1a1a1a;color:#fff;font:inherit;cursor:pointer}
.err{margin-top:12px}
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlResult(status: number, html: string): ListenerHttpResult {
  return {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    body: html,
  };
}

function jsonResult(status: number, body: unknown): ListenerHttpResult {
  return {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

const ENDED = page("Link ended", "<h1>This link no longer works</h1>");

const PAIR_SCRIPT = `
<script>
(async () => {
  const err = document.getElementById("err");
  const btn = document.getElementById("go");
  const show = (m) => { err.textContent = m; };
  btn.addEventListener("click", async () => {
    err.textContent = "";
    try {
      const optRes = await fetch(location.pathname + "/options", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const opt = await optRes.json();
      if (!optRes.ok) { show(opt.refused || "This link no longer works"); return; }
      const cred = await navigator.credentials.create({ publicKey: opt.options });
      const att = cred.getClientExtensionResults ? cred : cred;
      const body = {
        id: cred.id,
        rawId: buf(cred.rawId),
        type: cred.type,
        response: {
          clientDataJSON: buf(cred.response.clientDataJSON),
          attestationObject: buf(cred.response.attestationObject)
        },
        clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}
      };
      const done = await fetch(location.pathname + "/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await done.json();
      if (!done.ok) { show(result.refused || "We couldn't check it's you. Nothing was saved."); return; }
      document.body.innerHTML = "<h1>Device check set up</h1><p>" + (result.message || "") + "</p>";
    } catch (e) {
      show("We couldn't check it's you. Nothing was saved.");
    }
  });
  function buf(v) {
    const bytes = new Uint8Array(v);
    let s = "";
    bytes.forEach((b) => s += String.fromCharCode(b));
    return btoa(s).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  }
})();
</script>
`;

export async function handlePairRoute(input: {
  readonly action: string;
  readonly token: string;
  readonly method: string;
  readonly body: string;
  readonly now?: number;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<ListenerHttpResult> {
  const now = input.now ?? Date.now();
  const link = lookupOffTerminalLink(input.token, { now });
  if ("refused" in link || link.kind !== "enrolment") {
    if (input.action === "page") {
      return htmlResult(404, ENDED);
    }
    return jsonResult(404, { refused: "This link no longer works" });
  }

  if (input.action === "page") {
    return htmlResult(
      200,
      page(
        "Set up a device check",
        `<h1>Set up a device check</h1><p>This takes a minute and uses Face ID, a fingerprint or a PIN. After that there's a 12-hour wait before it can sign anything off.</p><button type="button" id="go">Check it's me and set this up</button><p class="err" id="err"></p>${PAIR_SCRIPT}`
      )
    );
  }

  if (input.action === "options") {
    const options = await enrolmentOptions({ token: input.token, now, env: input.env });
    if ("refused" in options) {
      return jsonResult(400, options);
    }
    return jsonResult(200, options);
  }

  if (input.action === "verify") {
    let response: RegistrationResponseJSON;
    try {
      response = JSON.parse(input.body) as RegistrationResponseJSON;
    } catch {
      return jsonResult(400, { refused: "We couldn't check it's you. Nothing was saved." });
    }
    const result = await completeEnrolment({ token: input.token, response, now, env: input.env });
    if ("refused" in result) {
      return jsonResult(400, result);
    }
    return jsonResult(200, result);
  }

  return htmlResult(404, ENDED);
}
