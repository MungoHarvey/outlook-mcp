# Phase 4: Deduplication & Tooling

## Objective
Collapse the duplicated reference payload into one source, single-source version and session constants, delete dead code, and make the setup scripts and CI trustworthy on both platforms.

## Scope
### Included:
- Consolidate `references/` into `outlook-base/references/` (WS5.1): keep canonical copies, repoint 29 cross-skill links, delete 30 duplicate files (~56 KB). **Extend `test/static/cross-references.test.js` to assert every repointed link resolves to a real file** (**amendment A6**).
- Single-source the version (WS5.3): reconcile `plugin.json` (1.0.0) / `package.json` (2.0.0) / `mcp-server` (1.0.0); add `CHANGELOG.md`; fill manifest fields; bump `engines.node` to ≥16/≥18 (**amendment A8**).
- Single-source the 30-day session constant and fix the `--status` off-by-one (WS5.4).
- Delete deprecated `scripts/outlook-*.js` + their npm entries + both `test/unit/` files (WS4.1). **Update the `test`/`test:unit` globs so `npm test` doesn't break on the emptied dir** (**amendment A4**).
- Doc-consistency test (WS4.4): assert canonical redirect URI + each required scope token appears across README/AZURE_SETUP/guide — **presence checks, not list equality** (**T3**).
- Fix install idempotency, `package.ps1` parity, `sed -i` portability, `install.ps1` undefined-var bug (WS4.6).
- Finish CI (WS4.5): `windows-latest` matrix leg, shellcheck + PSScriptAnalyzer.
- **Resolve `mcp-server/` fate as one explicit decision** (**amendment A7**): grep references first; decide keep-documented vs delete; record the decision for Phase 5.

### Explicitly NOT included:
- The user-facing doc rewrites themselves (Phase 5) — this phase only *decides* mcp-server's fate and single-sources version/scopes.

## Key Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Canonical references + repointed links | Files + Markdown | `skills/outlook-base/references/`, 29 links |
| Link-resolution test | Test | `test/static/cross-references.test.js` |
| Single-sourced version + CHANGELOG | JSON + Markdown | `plugin.json`, `package.json`, `CHANGELOG.md` |
| Single 30-day constant + fixed math | Code | `auth-server.js`, `token_helper.py` |
| Deprecated code removed + globs fixed | Code + config | `scripts/`, `test/unit/`, `package.json` |
| Doc-consistency test | Test | `test/` |
| Idempotent, parity-correct setup scripts | Scripts | `setup/*.sh`, `setup/*.ps1` |
| CI windows leg + script linters | YAML | `.github/workflows/test.yml` |
| mcp-server fate decision | Decision record | phase-4 notes / commit message |

## Success Criteria
- ✓ No `references/*.yaml` under a skill folder duplicates an `outlook-base` file (enforced by test).
- ✓ Every cross-skill reference link resolves to an existing file (enforced by test).
- ✓ Version identical across `plugin.json` and `package.json`; `CHANGELOG.md` present.
- ✓ `--status` remaining-days matches `token_helper.get_session_info()` for the same token.
- ✓ Deprecated scripts and their tests gone; `npm test` still green (globs updated).
- ✓ Re-running the installer twice produces no nested `outlook-x/outlook-x/` folders.
- ✓ CI runs on ubuntu + windows with shell/PS linting.

## Dependencies
### Must Complete Before:
- Phase 3 (content fixes) — dedup must follow content fixes so fixes aren't lost.

### Blocked By:
- None.

### Optional:
- None.

## Skills Required (Broad Categories)
- `refactoring`: dedup + single-sourcing.
- `ci-cd`: matrix + linters.
- `shell-scripting`: cross-platform setup script fixes.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Mis-pointed link loads no reference silently | Med | Med | Link-resolution test (A6) |
| Deleting mcp-server breaks a documented path | Med | Med | Grep first; decide explicitly (A7); reconcile with Phase 5 |
| Emptied `test/unit` breaks `npm test` | High | Med | Update globs in same change (A4) |
| Installed skills already nested on user machines | High | Low | Idempotent installer + note manual cleanup (`~/.agents/skills`) |

## Assumptions
- Cross-skill relative links (`../outlook-base/...`) work in this plugin (already proven by existing links).

## Notes / Design Decisions
- The user's own machine already shows the install-nesting bug (`~/.agents/skills/outlook-auth/outlook-auth/`) — fixing idempotency here has real cleanup value.
- mcp-server decision must resolve the 6.4-vs-6.5 contradiction before Phase 5 doc work.

## Ralph Loops (4)
| Loop | Name | Type | Key Outputs |
|------|------|------|-------------|
| 400 | Dedup references + link-resolution test | Migration | canonical refs, repointed links, test |
| 410 | Single-source version + 30-day constant | Implementation | version sync, CHANGELOG, fixed math |
| 420 | Remove deprecated code + fix test globs | Migration | deletions, package.json globs |
| 430 | Setup-script fixes + CI matrix/linters + mcp-server decision | Implementation | idempotent scripts, CI, decision record |
