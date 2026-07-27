# Master Plan — Code-Review Remediation

## Goal

Bring `outlook-mcp-skills` from **"several skills silently broken + pervasive doc/security drift"** to **"functional, safe, tested, and de-duplicated."**

Concretely, when this plan is done:
1. **Every shipped skill works** — no skill 403s because the auth flow never requested its scope, and no write operation fails because of Windows path mangling.
2. **Tokens are genuinely invisible and hard to leak** — no client secret persisted to disk, token files created with restrictive permissions, OAuth callback protected against cross-site request forgery (CSRF — a malicious page tricking the browser into hitting the local callback).
3. **The test suite actually exercises the runtime** — behavioral Python tests for the proxy and token lifecycle, plus a scope-contract test that fails if a skill needs a scope the auth flow doesn't request.
4. **One source of truth** — the scope list, the version number, and the 30-day session constant each live in exactly one place; the 56 KB of duplicated `references/` YAML collapses into `outlook-base`.
5. **Docs match reality** — no false security claims, no wrong redirect URI, correct skill count and architecture description.

Non-goals (explicitly deferred): new Outlook features (OneDrive, Power Automate), migrating to a public-client/PKCE flow (noted as a future option, not required here), and any rework of the `mcp-server/` transport beyond deciding its fate.

## Source

This plan operationalizes ~60 findings from a four-agent code review (auth/security core, skill content, tests/tooling, architecture/docs), 2026-07-16. Findings cross-confirmed by multiple agents are treated as highest confidence.

## Workstreams

The work groups into six workstreams, ordered by dependency. WS1 is a hard prerequisite (nothing else matters if the skills don't work); WS2–WS4 touch overlapping files and must be sequenced to avoid churn; WS5–WS6 are lower-risk and can land last.

### WS1 — Unblock broken skills (functional blockers) — CRITICAL, do first

| ID | Finding | Fix | Files |
|----|---------|-----|-------|
| 1.1 | contacts-manage/rules/categories 403 — scopes never requested | Add `Contacts.ReadWrite` + `MailboxSettings.ReadWrite` to `SCOPES` and every permission table | `auth-server.js`, AZURE_SETUP.md, azure-setup-guide.html, outlook-auth/reference.md, outlook-setup/reference.md |
| 1.2 | Windows Git Bash mangles bare `/me` → all writes fail | Self-heal in `graph_call.py`: strip a leading `<drive>:/<git-path>` before the `/me` check | `scripts/graph_call.py` |
| 1.3 | `startswith("/me")` matches `/messages`, `/memberOf`; double-encoded traversal survives | Segment-exact check (`== "/me" or startswith("/me/") or startswith("/users/")`); reject residual `%` after one unquote | `scripts/graph_call.py` |
| 1.4 | `openid/profile/email` scopes added but uncommitted → lost on checkout | Commit the working-tree change; fold into the single-sourced scope list (WS5) | `auth-server.js` |

### WS2 — Security hardening

| ID | Finding | Fix | Files |
|----|---------|-----|-------|
| 2.1 | OAuth `state` generated but never validated; predictable `Date.now()`; no CSRF/host check | Random `state`, store + strict single-use compare; verify `Host` header is localhost:8400 | `auth-server.js` |
| 2.2 | `tokens.json` written world-readable at creation (hardening only on first refresh) | `mode: 0o600` at write + `icacls` on win32 immediately | `auth-server.js` |
| 2.3 | `client_secret` persisted in plaintext `tokens.json` (unnecessary — refresh paths fall back to `.env`) | Stop writing it; make `.env` the sole source for refresh | `auth-server.js`, `token_helper.py` |
| 2.4 | Reflected content in callback HTML; no server/request timeouts | HTML-escape interpolated values; 10-min server deadline; 30s request timeout | `auth-server.js` |
| 2.5 | Concurrent-refresh race: shared `tokens.json.tmp`, no lock, last-writer-wins | Unique tmp name + advisory lock; re-check expiry under lock | `token_helper.py` |
| 2.6 | `tokens.json.tmp` not gitignored → crash leaves committable credentials | `.gitignore` → `tokens.json*` | `.gitignore` |

### WS3 — Skill-content correctness

| ID | Finding | Fix | Files |
|----|---------|-----|-------|
| 3.1 | 17 raw `curl -H "Authorization: Bearer $TOKEN"` examples violate the security model and invite reading tokens.json | Rewrite all 17 to `graph_call.py` calls | 7 `reference.md` files |
| 3.2 | 8 parsing templates omit the `.data` unwrap → print nothing / KeyError / `NOT_FOUND` into batch move | Insert `data = json.load(sys.stdin).get('data', {})` at top of each | 8 templates |
| 3.3 | ~10 bash examples leave OData `$select/$top/$orderby` unescaped → bash eats them or 500 | Escape `\$`; `%20`-encode spaces | outlook-base, email-list, folders, calendar-list, email-draft refs |
| 3.4 | 401 auto-retry is a no-op (resends cached token) | Add `get_token(force_refresh=True)`; use on retry; catch `TokenRefreshError` → 503 | `graph_call.py`, `token_helper.py` |
| 3.5 | Smaller correctness: `-H`→`--header`, wrong success codes (202/201 not 204/200), PowerShell `${VAR}`, relative script path, dangling `curl -d`, invalid rules example | Batch-fix per finding list | multiple SKILL.md/reference.md |
| 3.6 | Auto-trigger description overlaps (folders vs email-move; organize vs categories; calendar-list over-broad) | Scope descriptions to disambiguate | 4 SKILL.md frontmatter |

### WS4 — Tests + tooling

| ID | Finding | Fix | Files |
|----|---------|-----|-------|
| 4.1 | Deprecated scripts wired into npm; only tests cover dead code | Delete `scripts/outlook-*.js`, their npm entries, and both unit test files | package.json, scripts/, test/unit/ |
| 4.2 | 0% behavioral coverage of runtime code | Add Python test tier: endpoint-validation table, token_helper refresh/expiry/wipe with temp files + mocked endpoint | new `test/python/` |
| 4.3 | No guard against the WS1.1 scope class of bug | Scope-contract test: derive required scopes from each SKILL.md verb+endpoint, assert `SCOPES` covers them | new test |
| 4.4 | Docs drift silently | Doc-consistency test: assert canonical redirect URI + scope list appear across README/AZURE_SETUP/guide | new test |
| 4.5 | CI Linux-only, no Python step, scripts never linted | Add `windows-latest` matrix leg, `python -m py_compile`, shellcheck + PSScriptAnalyzer | `.github/workflows/test.yml` |
| 4.6 | Install not idempotent; package.ps1 misses a rewrite; `sed -i` breaks on macOS; install.ps1 prints undefined var | Fix each | setup/*.sh, setup/*.ps1 |

### WS5 — De-duplication + single-sourcing

| ID | Finding | Fix | Files |
|----|---------|-----|-------|
| 5.1 | 56 KB (38% of skill payload) duplicated `references/` YAML across skills | Keep canonical copies in `outlook-base/references/`; repoint 29 links; delete 30 dup files; add anti-dup test | skills/*/references/ |
| 5.2 | Scope list in ~8 places, 4 variants | Single source (`scopes.json` or shared const) consumed by auth-server.js; docs greped against it | auth-server.js + docs |
| 5.3 | Version drift: plugin.json 1.0.0 vs package.json 2.0.0 vs mcp-server 1.0.0; no CHANGELOG | Single-source version; add CHANGELOG; fill manifest fields | plugin.json, package.json |
| 5.4 | 30-day constant hardcoded 5×; `--status` day-math off by one vs token_helper | One constant per runtime; align the arithmetic | auth-server.js, token_helper.py |

### WS6 — Documentation truth

| ID | Finding | Fix | Files |
|----|---------|-----|-------|
| 6.1 | `outlook-skills/README.md` + `setup/README.md` describe a non-existent system with false security claims (AES-256, keychain, PKCE) and wrong redirect URI | Rewrite to match `auth-server.js`/`.env`/`tokens.json`, or delete and point at AZURE_SETUP.md | 2 README.md |
| 6.2 | `outlook-auth/reference.md` (the file Claude loads for first-time auth) has wrong redirect URI + `~/.skills/config.json` that nothing reads | Correct URI; replace with `.env` flow | outlook-auth/reference.md |
| 6.3 | Root README: wrong architecture ("two MCP tools"), "19 skills", wrong artifact name | Rewrite around skills + graph_call.py; fix counts; fix broken anchor | README.md |
| 6.4 | CLAUDE.md invents uv/.venv bootstrap; omits mcp-server from tree | Correct Setup section; add mcp-server/.mcp.json to tree; qualify "all calls" claim | CLAUDE.md |
| 6.5 | Stale planning/research debris ships in the plugin; version/state contradictions | Move plans/research to parent repo; `git rm --cached` committed loop JSONs; decide `mcp-server/` fate | .claude/plans/, research/, mcp-server/ |

## Dependency & sequencing notes

- **WS1 before everything** — until the scopes are correct and Windows paths work, the plugin's core promise is broken. The scope change (1.1/1.4) is also a prerequisite for the scope-contract test (4.3) to pass.
- **WS2.3 (drop client_secret) and WS3.4 (force-refresh) touch the same refresh path** in `token_helper.py` — land them in the same phase to avoid re-touching.
- **WS4.2/4.3 tests should land with the code they lock in**, not after — write the endpoint-validation test alongside WS1.3, the scope-contract test alongside WS1.1.
- **WS5.1 dedup is mechanical and low-risk** but must come *after* WS3 content fixes (otherwise a fix like `-H`→`--header` has to be applied to both the soon-to-be-deleted duplicates and the canonical copy). Fix content first, then deduplicate.
- **WS6 docs last** (or continuously) — docs should describe the *final* behavior, so writing them before the code settles just creates a second drift.

## Review amendments (lean eng/DX review, 2026-07-16)

An independent engineering review verified the findings against source and required these structural changes before execution (Codex voice was unavailable — CLI too old for its model — so this is single-reviewer):

- **A1 (CRITICAL, gates 2.3):** `token_helper.py:105` gets `client_secret` into `os.environ` only via `load_dotenv()`, which is wrapped in `try/except ImportError: pass` — and nothing in the install flow guarantees `python-dotenv` is installed (`setup/install.sh:33` "Bootstrap venv" only runs `auth.sh --status`, which is Node-only and creates no venv). So dropping the stored secret (2.3) would make **every silent refresh fail on a clean machine**. Fix: add a **dependency-free `.env` parser to `token_helper.py`** (mirror `auth-server.js:loadEnv`, ~20 lines) *before* 2.3. Prove refresh works from `.env` alone, then stop persisting the secret.
- **A2 (HIGH, re-order):** Merge **5.2 (single-source scopes) into the same phase as 1.1**. Otherwise 1.1 hand-edits the scope list in ~5 files and 5.2 deletes 4 of them a phase later — pure churn with a drift window. Add the two missing scopes once, in the canonical source; generate/grep docs from it; point the 4.3 test at the single source.
- **A3 (MEDIUM, merge):** 1.2 and 1.3 both rewrite the endpoint guard (`graph_call.py:85–92`). A too-greedy 1.2 path-strip can re-open the traversal hole 1.3 closes. Treat as **one atomic validation rewrite** with one shared table-test whose fixtures include Git-Bash-mangled inputs.
- **A4 (MEDIUM, don't-break-CI):** Deleting `test/unit/` (4.1) breaks the `test` and `test:unit` globs in `package.json:8,11` — `node --test` errors on a zero-match glob. 4.1 must update those globs (repoint `test:unit` at the Python tier or drop it) in the same change.
- **A5 (HIGH, test correctness):** Listing rules/categories (`GET .../messageRules`, `GET .../masterCategories`) needs `MailboxSettings.Read` — so reads 403 today too, not just writes. The 4.3 scope map must map **GET** verbs to the read-tier scope and **fail closed** (unknown endpoint ⇒ test failure demanding a map entry) so new skills can't slip through unmapped.
- **A6 (MEDIUM, blast radius):** WS5.1 dedup repoints 29 links; a mis-pointed link doesn't error — the skill silently loads no reference. Extend `test/static/cross-references.test.js` to assert every repointed link **resolves to a real file** post-dedup, not just "no dup exists."
- **A7 (MEDIUM, contradiction):** 6.4 wants `mcp-server/` **added** to the CLAUDE.md tree; 6.5 wants to **decide its fate** (possibly delete). Resolve as **one explicit decision item** in the dedup/tooling phase before either doc rewrite; grep for references first (CLAUDE.md + README point at it; committed `node_modules/` present).
- **A8 (LOW):** `auth-server.js:188` uses `Buffer.from(payload,'base64url')`, which needs Node ≥16, but `package.json:34` declares `engines.node >=14`; on Node 14 the id_token email decode silently returns `'unknown'`. Bump `engines` (align with 5.3 version work).

## Recommended phase grouping (execution order)

| Phase | Scope | Ship criterion |
|-------|-------|----------------|
| **P1 — Unblock + lock scopes** | WS1 (1.1, merged 1.2+1.3, 1.4) + **5.2 merged in** + scope-contract test 4.3 + endpoint-validation test (part of 4.2) + minimal CI to run Python; **+ C1 re-auth migration banner** | All 20 skills' scopes covered; Windows `/me` works; both guarded by tests |
| **P2 — Auth/security core** | WS2 (2.1–2.6) + 3.4, with **A1 `.env` parser first**, then 2.3+2.5 together (shared refresh path) + behavioral token_helper tests (4.2 rest) | No `client_secret` at rest; mode-600 at creation; CSRF-validated callback; refresh survives without `python-dotenv` |
| **P3 — Skill content** | WS3 (3.1–3.6), batched by file | `grep -rn "Bearer\|curl" skills/` empty; eval tests pass |
| **P4 — Dedup + tooling** | WS5.1/5.3/5.4 + WS4.1/4.4/4.6 + finish 4.5; extend cross-ref test (A6); fix test globs (A4); resolve mcp-server fate (A7) | No dup references; links resolve; single-sourced version; CI on ubuntu+windows |
| **P5 — Docs truth** | WS6 (6.1–6.5), reconciling 6.4 vs 6.5 with P4's mcp-server decision | Redirect URI + scopes consistent across all docs; no false security claims |

## Migration & rollout (existing authenticated users)

Two fixes are **breaking for anyone already authenticated** and must ship with an explicit re-auth step, not silently:

- **New scopes (1.1, 1.4)** — existing `tokens.json` files were minted without `Contacts.ReadWrite`/`MailboxSettings.ReadWrite` (and, for older sessions, without `openid/profile/email`). A silent refresh reuses the old grant, so those skills keep 403ing until the user runs `auth.ps1 -Reauth`. The release notes and the auth skill's error text must say so. Consider having `token_helper` compare stored `scopes` against the required set and raise `AuthRequiredError("re-auth needed for updated permissions")` when they're missing — turns a silent 403 into an actionable prompt.
- **Dropping client_secret from tokens.json (2.3)** — `token_helper.py:105` currently reads `client_secret` from the token store first and falls back to `.env`. After 2.3, refresh depends entirely on `.env` being present and correct. Verify the `.env` fallback path works *before* removing the stored copy, and confirm existing token files (which still contain the secret) don't break when the writer stops adding it. Order within the phase: make `.env` the primary source and prove refresh works, then stop persisting the secret.

## Success criteria (verifiable)

- `npm test` includes a passing Python tier that imports and exercises `graph_call.py` and `token_helper.py`.
- A scope-contract test passes and would fail if a skill's verb+endpoint needs an unrequested scope.
- `graph_call.py GET "/me"` returns 200 from Windows Git Bash without `MSYS_NO_PATHCONV`.
- `grep -rn "Bearer" skills/` returns nothing; no `curl` in skill files.
- No `references/*.yaml` under a skill folder duplicates an `outlook-base` file (enforced by test).
- `tokens.json` never contains `client_secret`; created at mode 600.
- Redirect URI string is identical across all docs; version identical across plugin.json/package.json.
- CI runs on ubuntu + windows with a Python compile/lint step.
