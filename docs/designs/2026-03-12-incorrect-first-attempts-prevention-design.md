# Design: Layered Defense Against Incorrect First Attempts

Date: 2026-03-12

## Problem

Claude frequently makes avoidable first-attempt mistakes:
1. **Wrong branch** — commits directly to `main` instead of using a worktree
2. **Pattern violations** — writes code that violates established project rules (`.data[0]` instead of `first()`, incorrect supabase-py API chaining)
3. **Boundary violations** — adds business logic to thin proxy files or bypasses the provider abstraction

The rules exist in CLAUDE.md but lack automated enforcement. Text-only rules are suggestions; under cognitive load, Claude doesn't always apply them.

## Design

A layered defense system where multiple independent enforcement points catch different failure modes. No single layer covers everything — but together they make first-attempt mistakes rare.

### Layer 1: Pre-commit branch guard (per-project, scaffolded by `/scope`)

Added to `.git/hooks/pre-commit`:

```bash
branch=$(git branch --show-current)
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "ERROR: Direct commits to main are not allowed."
  echo "Use a worktree: git worktree add .worktrees/<branch> -b <branch>"
  exit 1
fi
```

Blocks Claude and humans from committing to main. Fast-fail with actionable error pointing to the worktree convention.

### Layer 2: Pre-commit pattern checks (per-project, scaffolded by `/scope`)

Grep staged diffs for known anti-patterns. These checks run before lint-staged:

```bash
# Check for unsafe .data[0] access in any language
if git diff --cached | grep -E '^\+.*\.data\[0\]'; then
  echo "ERROR: Unsafe .data[0] access detected. Use first() helper instead."
  exit 1
fi

# Check for business logic in HTTP proxy layer (app/api/ routes)
if git diff --cached --name-only | grep -q 'app/api/'; then
  if git diff --cached -- 'app/api/' | grep -E '^\+.*(\.from\(|supabase\.|SELECT|INSERT|UPDATE)'; then
    echo "ERROR: Possible business logic in API proxy layer."
    echo "API routes are thin proxies only. Move logic to backend/services/."
    exit 1
  fi
fi
```

Pattern checks are blocking (exit 1). Claude must fix before committing.

**Extensibility:** Add new patterns as incidents occur. Each pattern should include the error message explaining where the correct code belongs.

### Layer 3: Global CLAUDE.md pre-flight checks and file ownership (global)

Added to `~/.claude/CLAUDE.md`:

#### Pre-Flight Checks (Before Writing Code)

1. Verify you are NOT on `main` — run `git branch --show-current`; switch to a worktree if needed
2. For external SDK or library code: check `docs/patterns/` for project-specific usage patterns before writing
3. Run `make doctor` before environment-dependent work

#### File Ownership (Before Editing Any File)

Never add business logic to proxy or adapter layers. The general rule applies across all projects:

| Layer | Allowed | Not allowed |
|-------|---------|-------------|
| HTTP proxy/gateway (`app/api/`) | HTTP wiring, request forwarding | Business logic, DB queries, validation |
| Service layer (`services/`) | All business logic | Direct external SDK calls |
| Provider/adapter layer (`providers/`) | External SDK adapters | Business logic |
| UI components | Rendering, event handlers | Direct API calls (use hooks/services) |

Check the project's CLAUDE.md for the project-specific ownership table.

### Layer 4: Pattern docs (per-project, scaffolded by `/scope`)

`docs/patterns/` directory with API usage patterns for libraries Claude tends to misuse:

- `docs/patterns/supabase-py.md` — correct method chaining order, result handling with `first()`, error patterns
- `docs/patterns/README.md` — index of all pattern docs

Project CLAUDE.md references this directory under Coding Standards so Claude checks it during exploration.

### Layer 5: Feedback memories (global, per-project memory)

Two new memories in the project's memory directory:

1. **Branch discipline** — verify branch before any git operation; if on main, create a worktree first
2. **Supabase patterns** — check `docs/patterns/supabase-py.md` before writing supabase-py code; never use `.data[0]`

## Responsibility split

| Layer | Location | How it gets there |
|-------|----------|------------------|
| Pre-commit branch guard | `.git/hooks/pre-commit` | `/scope` scaffolds |
| Pre-commit pattern checks | `.git/hooks/pre-commit` | `/scope` scaffolds |
| Pre-flight checks rule | `~/.claude/CLAUDE.md` | Direct edit |
| File ownership principle | `~/.claude/CLAUDE.md` | Direct edit |
| Pattern docs | `docs/patterns/` | `/scope` scaffolds placeholder; populate as incidents occur |
| Feedback memories | `~/.claude/projects/.../memory/` | Direct write |

## Defense matrix

| Failure mode | Pre-commit | CLAUDE.md preflight | File ownership | Pattern docs | Memory |
|---|---|---|---|---|---|
| Commit to `main` | Blocks (L1) | Reminds | — | — | Reminds |
| `.data[0]` any language | Blocks (L2) | — | — | Shows fix | Reminds |
| Business logic in API proxy | Blocks (L2) | — | Guides | — | — |
| Wrong supabase-py chaining | — | Preflight check | — | Shows correct pattern | Reminds |
| Editing wrong layer | — | — | Guides | — | — |
| Provider SDK bypass | Blocks (L2 via future pattern) | — | Guides | — | — |

## Out of scope

- LSP/architecture-boundary tooling (dependency-cruiser, custom Ruff rules) — evaluate if grep proves too noisy
- TypeScript-specific pattern docs — add `docs/patterns/supabase-js.md` if similar incidents recur
- File-level ownership enforcement beyond grep — add as incidents occur

## `/scope` changes required

When `/scope` initializes a new project it must:
1. Create `.git/hooks/pre-commit` with branch guard + baseline pattern checks
2. `chmod +x .git/hooks/pre-commit`
3. Create `docs/patterns/README.md` as placeholder
4. Add project-specific file ownership table to project CLAUDE.md
