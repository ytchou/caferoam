#!/usr/bin/env bash
# CafeRoam Doctor — Local environment preflight check
#
# Usage: make doctor (or bash scripts/doctor.sh)
#
# HOW TO ADD A NEW CHECK:
#   1. Call the `check` function with three arguments:
#      check "Description" "command_that_returns_0_on_success" "Fix: what to run"
#   2. The command runs silently — only exit code matters (0 = pass, non-zero = fail)
#   3. Add checks in the appropriate group (Infrastructure / Env Files / Dependencies / Data)
#   4. Update the CLAUDE.md extensibility note if the check covers a new service category

set -euo pipefail

PASS=0
FAIL=0

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  GREEN=''
  RED=''
  YELLOW=''
  BOLD=''
  NC=''
fi

_pass() { printf "${GREEN}[PASS]${NC} %s\n" "$1"; PASS=$((PASS + 1)); }
_fail() { printf "${RED}[FAIL]${NC} %s\n" "$1"; printf "       ${YELLOW}Fix: %s${NC}\n" "$2"; FAIL=$((FAIL + 1)); }

check() {
  local description="$1"
  local command="$2"
  local fix_hint="$3"
  if bash -c "$command" > /dev/null 2>&1; then
    _pass "$description"
  else
    _fail "$description" "$fix_hint"
  fi
}

check_env_var_localhost() {
  local file="$1"
  local var_name="$2"
  local description="$3"

  if [ ! -f "$file" ]; then
    _fail "$description" "File $file does not exist"
    return
  fi

  local value
  value=$(grep "^${var_name}=" "$file" 2>/dev/null | head -1 | cut -d'=' -f2- || true)

  if echo "$value" | grep -qE '(127\.0\.0\.1|localhost)'; then
    _pass "$description"
  else
    _fail "$description" "Update $var_name in $file to http://127.0.0.1:54321"
  fi
}

# ─── Find project root (where Makefile lives) ────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf "\n${BOLD}CafeRoam Doctor${NC}\n"
printf "────────────────────────────────\n\n"

# ─── Infrastructure ───────────────────────────────────────────────────────────
printf "${BOLD}Infrastructure${NC}\n"
check "Docker running" \
  "docker info" \
  "Start Docker Desktop"

check "Supabase DB healthy (127.0.0.1:54321)" \
  "curl -sf http://127.0.0.1:54321/rest/v1/ -H 'apikey: placeholder' -o /dev/null" \
  "Run: supabase start"

check "Supabase Auth healthy" \
  "curl -sf http://127.0.0.1:54321/auth/v1/health" \
  "Run: supabase stop && supabase start"

printf "\n"

# ─── Env Files ────────────────────────────────────────────────────────────────
printf "${BOLD}Env Files${NC}\n"
check ".env.local exists" \
  "test -f '${PROJECT_ROOT}/.env.local'" \
  "Copy from .env.example: cp .env.example .env.local"

check_env_var_localhost "${PROJECT_ROOT}/.env.local" "NEXT_PUBLIC_SUPABASE_URL" \
  ".env.local SUPABASE_URL points to localhost"

check "backend/.env exists" \
  "test -f '${PROJECT_ROOT}/backend/.env'" \
  "Create backend/.env with SUPABASE_URL=http://127.0.0.1:54321"

check_env_var_localhost "${PROJECT_ROOT}/backend/.env" "SUPABASE_URL" \
  "backend/.env SUPABASE_URL points to localhost"

printf "\n"

# ─── Dependencies ─────────────────────────────────────────────────────────────
printf "${BOLD}Dependencies${NC}\n"
check "Python 3.12+" \
  "python3 -c 'import sys; exit(0 if sys.version_info >= (3, 12) else 1)'" \
  "Install Python 3.12+: brew install python@3.12 (or pyenv install 3.12)"

check "uv installed" \
  "command -v uv" \
  "Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh"

check "Backend deps synced" \
  "uv sync --frozen --check --directory '${PROJECT_ROOT}/backend'" \
  "Run: cd backend && uv sync"

check "pnpm deps installed" \
  "test -f '${PROJECT_ROOT}/node_modules/.modules.yaml'" \
  "Run: pnpm install"

printf "\n"

# ─── Data ─────────────────────────────────────────────────────────────────────
printf "${BOLD}Data${NC}\n"
check "Migrations in sync" \
  "cd '${PROJECT_ROOT}' && test -z \"\$(supabase db diff 2>/dev/null)\"" \
  "Run: supabase db push"

# ─── Summary ──────────────────────────────────────────────────────────────────
printf "\n────────────────────────────────\n"
if [ "$FAIL" -eq 0 ]; then
  printf "${GREEN}${BOLD}Result: All %d checks passed${NC}\n\n" "$((PASS + FAIL))"
  exit 0
else
  printf "${RED}${BOLD}Result: %d/%d checks passed (%d failed)${NC}\n" "$PASS" "$((PASS + FAIL))" "$FAIL"
  printf "Fix the issues above before proceeding.\n\n"
  exit 1
fi
