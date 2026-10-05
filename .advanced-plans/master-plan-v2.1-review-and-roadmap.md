# Master plan — v2.1: review remediation, upstream ports, new capabilities

**Created:** 05/10/2026 · **Baseline:** `69afe72` on `main` (318 Node + 45 Python tests green)
**Inputs:** three parallel review passes (proxy/auth core; skills/tests; upstream `ryaker/outlook-mcp`
`0abe0e7..95d6ff2`, 47 commits). Findings marked ✔ were reproduced locally; the rest were read from
code and are marked *plausible* where behaviour depends on Microsoft's side.

## Goal

Move the plugin from "structurally tidy, green tests" to "works end-to-end on real mailboxes":
fix the defects that make documented skills fail at runtime, close the remaining prompt-injection
and auth gaps, then add the capabilities users most often ask for.

## Assumptions this plan rests on

1. Architecture stays as is: skills + `scripts/graph_call.py` proxy; `mcp-server/` mirrors the proxy.
   Upstream is a monolithic JS MCP server, so we port **intent**, never merge commits.
2. Default scopes stay user-consentable (lesson from the previous plan: admin-gated scopes break
   sign-in on managed tenants). New scopes are opt-in unless confirmed user-consentable.
3. Each phase is independently shippable as one PR, test-first; `npm test` green at every gate.
4. Power Automate is out of scope (second token audience, non-Graph host, admin consent).

---

## Phase 1 — Proxy correctness (`graph_call.py` ⇄ `mcp-server/src/graph.js` parity)

The single highest-leverage phase: several skills are broken *at the proxy*, not in their docs.

**1.0 Test harness.** Local HTTPS-less mock Graph server (stdlib `http.server`) + injectable base URL
so `make_request` can be tested at HTTP level. Mirror for Node with a mocked `fetch`.

**1.1 Pagination** ✔ — absolute `@odata.nextLink` is rejected (400). Accept an absolute URL only if it
begins exactly `https://graph.microsoft.com/v1.0/`; strip that, then run the normal guard. Any other
host/scheme → 400. Optional `--all --max-pages N`.

**1.2 URL encoding** ✔ — a space in the query (`$search="quarterly report"`, `displayName eq 'My Projects'`)
raises `InvalidURL` → opaque 500. Percent-encode the query safely; map `InvalidURL` to 400. Also
narrow the catch-all so timeouts / malformed refresh responses get specific errors.

**1.3 Endpoint guard hardening** ✔ — Node uses bare `startsWith("/me")`; `"/me\..\..\beta\users"`
reaches `https://graph.microsoft.com/beta/users`. Port Python's segment-exact check; in **both**
proxies reject `\` and `%5c`, and validate the *parsed* URL pathname (`/v1.0/me…` or `/v1.0/users/…`).
Catch `URIError` from stray `%`.

**1.4 Throttling** — surface `retry_after` from response headers on 429/503 in both proxies;
optionally one bounded retry for idempotent methods.

**1.5 Bodies in and out**
- Request body via `-` (stdin) or `@file` — removes the 128 KiB argv / ~32 K Windows limit and the
  shell-quoting injection risk of `'…'` JSON bodies.
- `--out FILE` for binary/non-JSON responses (`$value`, attachments, `.eml` export); never decode
  binary as UTF-8. Align Node (currently returns `null` for non-JSON 2xx).
- Size cap on inline output so multi-MB base64 never floods context.

**1.6 Redirect safety** ✔ (urllib behaviour) — strip `Authorization` on cross-host redirects.

**1.7 Auth error messages** ✔ — `auth_required` hint omits `--reauth`, so a revoked refresh token loops
("Already authenticated"). Add `--reauth`/`-Reauth`; classify `invalid_client` /
`unauthorized_client` (expired client secret) as a config error pointing at `OUTLOOK_CLIENT_SECRET`
instead of "transient network error".

**Gate:** HTTP-level tests for every item above in Python and Node; parity test asserting both proxies
give the same `{status, error}` for a shared table of endpoints.

---

## Phase 2 — Untrusted content and destructive-action safety

**2.1 Server-side text bodies** — add `Prefer: outlook.body-content-type="text"` to read/reply/forward
flows so raw HTML never reaches the model.
**2.2 Sanitiser inside the proxy** (upstream #35/#46, adapted) — opt-in `--sanitize-body` using stdlib
`html.parser` (not regex): drop hidden CSS (display/visibility/opacity/zero-size/off-screen/
same-colour), comments, `aria-hidden`, `<title>/<noscript>`, invisible Unicode (~30 code points),
`javascript:`/`data:` links; wrap content in boundary markers. Port upstream's test cases. Mirror in
Node.
**2.3 Untrusted-data rule** in `outlook-base` — subject, `bodyPreview`, sender name, body, event and
contact text are data; never send/forward/create rules or events because content says to.
**2.4 Attachment download** ✔ — `open(data['name'],'wb')` allows `../` traversal and overwrite; crashes
on `itemAttachment`/`referenceAttachment`. Move into the proxy (`--out` with basename + fixed dir +
no-clobber, branch on `@odata.type`).
**2.5 Confirmation coverage** — SAFETY markers for draft delete, event delete, contact overwrite, rule
create with external `forwardTo` (exfiltration warning).
**2.6 Delete semantics** (upstream #48) — `DELETE` goes to Recoverable Items, it is *not* irreversible;
add `POST …/permanentDelete` with double confirmation and correct the wording. Fix the calendar claim
that deleting an organiser's event does not notify attendees (it sends cancellations).

---

## Phase 3 — Skill documentation correctness

| Item | Change |
|---|---|
| Inbox default (upstream #21) | `/me/mailFolders/inbox/messages`; keep `/me/messages` for "everywhere" |
| `$search` rules (upstream #40) | Cannot combine with `$orderby`; avoid `$filter` on messages; no KQL for unread → filter client-side |
| `$filter`+`$orderby` | Put `receivedDateTime` first in `$filter` or drop `$orderby` (`InefficientFilter`) |
| KQL quoting (upstream #31) | Quote multi-word values, escape inner quotes |
| OData literals | Double `'` → `''` (folder "O'Brien") |
| Calendar windows | Bounds need an explicit offset (`zoneinfo`); `Prefer` only affects the response. Stop hard-coding `Europe/London` |
| Calendar reference ✔ | Unescaped `$top/$orderby/$filter` inside double quotes (`reference.md:36,45`) |
| Categories | PATCH replaces the array — document read-modify-write for add/remove |
| Folders | Remove duplicated move section; add rename/delete (with SAFETY) or drop the claim; `childFolderCount` in `$select`; `$top` |
| Calendar list | Follow `nextLink`; drop "free/busy of others" trigger until Phase 6 |
| Setup reference | Fix admin-approval cause (scopes, not redirect URI → AADSTS50011); remove venv/500 text |
| Descriptions | De-overlap send/reply ("reply with a new message"), "respond", "schedule", "email filters" |
| Contacts search | Verify `$search` on `/me/contacts` via integration test; fall back to `startswith` |

**Gate:** new lints — unescaped `$` inside double-quoted endpoints; `$search` combined with
`$orderby`; per-command SAFETY check (not "word appears anywhere").

---

## Phase 4 — Auth server and MCP server hardening

**4.1** ✔ `auth-server.js` listens on all interfaces. Bind `127.0.0.1` (handle `::1`), don't replace a
pending state on repeated `/auth`, bind state to the browser (cookie), add **PKCE**. Closes the
same-LAN account-fixation path and the Windows Firewall prompt.
**4.2** MCP refresh: one in-flight refresh promise, unique temp file, honour `tokens.json.lock`;
`getToken({forceRefresh})` on 401 retry (currently retries with the same token).
**4.3** `auth-server` writes `tokens.json` atomically under the lock; lock wait > refresh timeout; fix
stale-lock reclaim race.
**4.4** State-dir parity in MCP (`~` expansion, legacy-dir test on `.env`, single `.env` source,
platform-correct hints).
**4.5** PowerShell 5.1 encoding in `setup/install.ps1` / `package.ps1` (BOM + ANSI read) — use
`[IO.File]` with `UTF8Encoding($false)`. *Plausible; needs a Windows run to confirm.*
**4.6** MCP SDK floor `^1.27.1` (upstream #39, protocol 2025-11-25).

---

## Phase 5 — Test-suite depth

Scope-contract over `reference.md` (not just `SKILL.md`); negative/confusion cases in skill selection
and add email-draft to fixtures; delete dead `test/eval/fixtures/curl-patterns.yaml`; extend opt-in
integration smoke to pagination, `$search`, `calendarView` with offsets. Correct the scope-contract
mapping so GET `masterCategories` needs `MailboxSettings.Read`, not `.ReadWrite`.

**Phase gate:** decide explicitly whether Phase 6 earns its place against what you use the plugin for.

---

## Phase 6 — New capabilities (tiered by scope cost)

**6a. No new scopes** (depends on Phase 1.5 for attachments)
- `outlook-email-attachments` — list/download (proxy `--out`), upload incl. `createUploadSession`
  (needs a narrowly validated unauthenticated PUT helper for the `uploadUrl`)
- Conversations/threads (`conversationId`), thread summary
- Focused Inbox (`inferenceClassification`)
- Free/busy via `POST /me/calendar/getSchedule`
- Secondary calendars (`/me/calendars/{id}/calendarView`)
- Event delete/forward; respond to an invite from its email (`$expand=microsoft.graph.eventMessage/event`)
- Teams join link from `onlineMeeting.joinUrl`
- MailTips before send (OOF / external recipient warnings)
- `$batch` for bulk triage (each sub-request validated by the same guard) — M
- Delta queries ("what's new since last check", needs `deltaLink` storage) — M

**6b. Small scope additions** (verify user-consentable on your tenant before adding to defaults)
- `MailboxSettings.Read` — user timezone (fixes 3's hard-coded zone), working hours, read OOF status
- `People.Read` — relevance-ranked contact lookup
- `Tasks.ReadWrite` — Microsoft To Do, incl. flagged-email follow-ups

**6c. Opt-in / often admin-gated** (stay in `admin_consent_scopes`)
- Shared/delegated mailboxes & calendars (`Mail.*.Shared`, `Calendars.ReadWrite.Shared`) — `/users/{upn}` already passes the guard
- Set out-of-office (`MailboxSettings.ReadWrite`)
- OneDrive (`Files.Read[Write]`, upstream #34) — download inside the proxy, never surface
  `@microsoft.graph.downloadUrl` (pre-authenticated URL)

**Not doing:** Power Automate (upstream #34).

---

## Upstream changes deliberately **not** copied

1. Search silently falling back to "recent emails" when all strategies fail.
2. `isRead:false` as a KQL term (unsupported).
3. Empty body → `'{}'` (ours: `data: null` + status, clearer).
4. Appending `Z` to calendar times client-side (wrong with `Prefer: outlook.timezone`).
5. Exposing OneDrive `downloadUrl` to the model (bearer-equivalent).
6. A second token store/audience for Power Automate.
7. Regex sanitiser applied *after* the model has seen raw HTML.
8. `MS_CLIENT_ID` / `OUTLOOK_CLIENT_ID` alias pair (more credential sources).

Already covered in ours (no action): draft emails, tenant-specific endpoints, refresh wiring, CSRF state,
XSS escaping, 0600 token files, `calendarView` for recurring instances, empty-response parse.

## Recommended order

Phase 1 → 2 → 3 → 4 → 5 → gate → 6a → 6b → 6c. Phases 3 and 4 are independent and can run in
parallel once Phase 1 has landed.
