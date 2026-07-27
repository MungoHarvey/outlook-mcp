# Plans Index

Master plan and phase breakdowns for the Secure OAuth Integration project.

## Master Plan
- [master-plan-secure-oauth-integration.md](master-plan-secure-oauth-integration.md) — Full context, decisions, security audit, all phases overview

## Phase Plans

| Phase | Name | Status | Loops | Plan File |
|-------|------|--------|-------|-----------|
| 1 | Foundation Fixes & Keychain Security | Complete | 100-102 | [phase-1.md](phase-1.md) |
| 2 | Build `graph_call.py` Security Proxy | In Progress | 200-201 | [phase-2.md](phase-2.md) |
| 3 | Update Auth, Base & Operation Skills | In Progress | 300-303 | [phase-3.md](phase-3.md) |
| 4 | *(Merged into Phase 3)* | — | — | [phase-4.md](phase-4.md) |
| 5 | Security Tests, Project Files & Validation | In Progress | 500-502 | [phase-5.md](phase-5.md) |

## Execution Order

```
Phase 1 (foundation)
  └─> Phase 2 (graph_call.py proxy)
        └─> Phase 3 (migrate all skills)
              └─> Phase 5 (tests + docs + verification)
```

## Loop Summary

| Loop | Phase | Name | Type |
|------|-------|------|------|
| 100 | 1 | Create missing files | Implementation |
| 101 | 1 | Keychain for client_secret | Implementation |
| 102 | 1 | Fix imports, scopes, paths | Implementation |
| 200 | 2 | Build graph_call.py core | Implementation |
| 201 | 2 | Security hardening & cross-platform | Implementation |
| 300 | 3 | Rewrite auth & base skills | Migration |
| 301 | 3 | Migrate email skills (x7) | Migration |
| 302 | 3 | Migrate calendar + contacts skills (x6) | Migration |
| 303 | 3 | Migrate folders, rules, categories + verify | Migration |
| 500 | 5 | Security & API call tests | Implementation |
| 501 | 5 | Update unit + integration tests | Implementation |
| 502 | 5 | Project files & final verification | Implementation |
