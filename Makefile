.PHONY: help doctor setup dev dev-all migrate seed seed-shops reset-db workers-enrich workers-embed test lint

help:
	@echo "CafeRoam — Available commands:"
	@echo "  make setup          Run full dev environment setup (install → supabase start → migrate → seed → dev)"
	@echo "  make dev            Start Next.js dev server on :3000"
	@echo "  make dev-all        Start frontend + backend concurrently (Supabase must already be running)"
	@echo "  make migrate        Apply Supabase migrations"
	@echo "  make seed           Seed ~50 Taipei shops from Cafe Nomad API"
	@echo "  make seed-shops     Restore full scraped shop data (710 shops, 164 live) from supabase/seeds/shops_data.sql"
	@echo "  make reset-db       Reset local database (run 'make seed-shops' after to restore scraped data)"
	@echo "  make workers-enrich Run data enrichment worker locally"
	@echo "  make workers-embed  Run embedding generation worker locally"
	@echo "  make test           Run Vitest tests"
	@echo "  make doctor         Run environment preflight check (run before starting work)"
	@echo "  make lint           Run ESLint + Prettier check + TypeScript check"

doctor:
	@bash scripts/doctor.sh

setup:
	pnpm install
	supabase start
	supabase db push
	pnpm db:seed
	pnpm dev

dev:
	pnpm dev

dev-all:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	pnpm dev:all

migrate:
	supabase db diff
	supabase db push

seed:
	pnpm db:seed

seed-shops:
	@echo "Restoring scraped shop data from supabase/seeds/shops_data.sql..."
	@docker exec -i supabase_db_caferoam psql -U postgres -d postgres < supabase/seeds/shops_data.sql
	@echo "Done — shop data restored."

reset-db:
	supabase db reset
	@echo ""
	@echo "Database reset. Run 'make seed-shops' to restore scraped shop data."

workers-enrich:
	pnpm workers:enrich

workers-embed:
	pnpm workers:embed

test:
	pnpm test

lint:
	pnpm lint && pnpm format:check && pnpm type-check
