# Design: `make doctor` Preflight Check

Date: 2026-03-12

## Problem

Claude spends disproportionate time debugging local dev environment issues — wrong Supabase keys, .env vs .env.local confusion, migrations out of sync, services not running. Each issue triggers multiple fix-retry cycles before landing on the right solution.

Root cause: no way to verify environment health before starting work. Setup docs tell you _how_ to set up, but not _whether_ setup is correct right now.

## Solution

A Bash diagnostic script (`scripts/doctor.sh`) that validates the full local dev stack in ~5 seconds. Called via `make doctor`. CLAUDE.md updated with a mandatory preflight rule.

## Checks

12 checks in 4 groups:

| Group              | Check                              | Pass condition                                                 | Fix hint                                                    |
| ------------------ | ---------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| **Infrastructure** | Docker daemon                      | `docker info` succeeds                                         | Start Docker Desktop                                        |
|                    | Supabase DB                        | `curl 127.0.0.1:54321` returns 200                             | Run `supabase start`                                        |
|                    | Supabase Auth                      | `curl 127.0.0.1:54321/auth/v1/health` returns 200              | Run `supabase stop && supabase start`                       |
| **Env Files**      | `.env.local` exists                | File exists                                                    | Copy from .env.example                                      |
|                    | `.env.local` points to localhost   | `NEXT_PUBLIC_SUPABASE_URL` contains `127.0.0.1` or `localhost` | Update URL to `http://127.0.0.1:54321`                      |
|                    | `backend/.env` exists              | File exists                                                    | Create from backend/.env or copy                            |
|                    | `backend/.env` points to localhost | `SUPABASE_URL` contains `127.0.0.1` or `localhost`             | Update URL to `http://127.0.0.1:54321`                      |
| **Dependencies**   | Python 3.12+                       | `python3 --version` >= 3.12                                    | Install via pyenv or brew                                   |
|                    | uv installed                       | `uv --version` succeeds                                        | Install: `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
|                    | Backend deps synced                | `cd backend && uv sync --frozen` exits 0                       | Run `cd backend && uv sync`                                 |
|                    | pnpm deps installed                | `pnpm ls` succeeds                                             | Run `pnpm install`                                          |
| **Data**           | Migrations in sync                 | `supabase db diff` returns no output                           | Run `supabase db push`                                      |

## Output Format

Color-coded pass/fail per check with fix commands for failures:

```
CafeRoam Doctor
────────────────────────────────
[PASS] Docker running
[PASS] Supabase healthy (127.0.0.1:54321)
[PASS] Supabase Auth healthy
[PASS] .env.local exists
[FAIL] .env.local points to remote Supabase
       Fix: Update NEXT_PUBLIC_SUPABASE_URL to http://127.0.0.1:54321
...
────────────────────────────────
Result: 11/12 checks passed
```

Exit code: 0 if all pass, 1 if any fail.

## Files Changed

| File                  | Change                                   |
| --------------------- | ---------------------------------------- |
| `scripts/doctor.sh`   | New — the diagnostic script (~100 lines) |
| `Makefile`            | Add `doctor` target                      |
| `CLAUDE.md`           | Add preflight rule + extensibility rule  |
| `ERROR-PREVENTION.md` | Add "Environment Debugging Loops" entry  |

## CLAUDE.md Rules (new)

1. **Before any environment-dependent work**, run `make doctor` and fix all failures.
2. **When adding a new service, external dependency, or env var**, update `scripts/doctor.sh` with a corresponding health check.

## Extensibility

The script includes a header comment explaining how to add new checks. Pattern:

```bash
check "Description" "command_that_returns_0_on_success" "Fix: command to run"
```

## What This Does NOT Include

- **Auto-fix** — keeps the script simple, predictable, and side-effect-free
- **Build verification** (`pnpm build`, `pytest`) — too slow for preflight; belongs in CI
- **Remote/production checks** — local-only by design
- **Seed data check** — migration sync check covers schema state; seed data may be legitimately empty

## Governance

The doctor script is a living document. The CLAUDE.md extensibility rule ensures it grows with the project. When a new service or env var is added, a corresponding check must be added to `scripts/doctor.sh`.
