# User Journey-Driven Testing — Philosophy & Standards

**Date:** 2026-02-27

## Context

Not all tests are equal. A uniform approach — such as striving for 100% coverage on all parts of the codebase — leads to diminishing returns and, worse, false confidence. The goal is a pragmatic test suite that maximizes confidence in real user experiences per unit of effort invested.

## The Core Problem: "Fake Tests"

The "fake data" problem is a **wrong abstraction level** problem. When you mock too deep in the stack — a repository method, an internal service, an in-memory calculation — you're only testing your own assumptions about how the system works, not the system itself. The test confirms the developer's mental model, not the user's experience.

High coverage numbers do not guarantee correctness. If the assumptions behind the tests are wrong, both the code and the tests will be wrong together.

## The Testing Trophy (over the Pyramid)

The traditional pyramid (many unit → some integration → few E2E) over-emphasizes unit tests. The **Testing Trophy** inverts the weight:

```
        /\
       /E2E\        ← few, for critical paths only
      /------\
     /Integration\  ← the bulk of confidence lives here
    /------------\
   /  Unit Tests  \ ← pure logic only (math, transforms, validators)
  /________________\
  Static/Type Checks ← catch trivial errors for free
```

Integration tests sit at the sweet spot: they test how things work together (closer to user reality) without the full slowness and brittleness of E2E.

## Three Concrete Practices

### 1. Mock at Boundaries, Not Internals

Only mock at system edges — the HTTP layer, the database boundary, the file system. Never mock internal modules or functions.

| Wrong                            | Right                                            |
| -------------------------------- | ------------------------------------------------ |
| Mock `userRepository.findById()` | Use a real test DB (test container or in-memory) |
| Mock internal service method     | Mock the external API call at the boundary       |
| Mock your own module             | Don't — test the real path                       |

The specific mocking tool doesn't matter — `vi.mock()` at boundaries, MSW, VCR, or test doubles are all valid as long as the mock is at a system edge (auth SDK, HTTP call, DB layer). What matters is the **boundary** principle, not the tooling.

### 2. Frame Tests from User Journeys, Not Function Signatures

The framing used to _write_ the test determines what gets tested. Starting from "what does this function do?" tests implementation. Starting from "what does a user do?" tests behavior.

```ts
// Implementation-first (brittle — breaks on refactor)
test('processPayment returns success object when card is valid')

// Journey-first (resilient — survives internal refactors)
test('Given a user with a valid card, when they complete checkout,
      then their order is confirmed and they receive a receipt')
```

The second test survives a complete internal refactor. The first breaks when you rename a field.

### 3. Validate Your Mocks — Don't Just Trust Them

The biggest source of fake tests: mocks that diverge from real API behavior. A mock returning `{ id, name }` when production returns `{ id, firstName, lastName }` creates tests that pass and features that break.

**Contract testing** (Pact.js) records what your code _expects_ from a dependency and verifies that expectation against the real API. Your mock is only as valid as its last contract check.

For test data: use **data factories** that generate realistic shapes. Avoid `{ name: "test", email: "test@test.com" }`. Use `{ name: "María García", email: "m.garcia+test@company.co.uk" }`. Edge cases hide in realistic data: unicode, long strings, null fields, special characters.

## Prioritization Framework

Not all journeys need the same depth:

| Journey Type                                  | Test Level        | Mock Strategy             |
| --------------------------------------------- | ----------------- | ------------------------- |
| Critical path (auth, checkout, core feature)  | Integration + E2E | MSW for external, real DB |
| Secondary feature                             | Integration       | MSW for external, real DB |
| Pure business logic (calculation, validation) | Unit              | No mocks needed           |
| UI layout / simple display                    | Snapshot or skip  | N/A                       |

## Test Quality Checklist

Before merging, ask of each test:

- [ ] **Does the test description describe a user action or outcome?** (not a function name)
- [ ] **Are mocks only at system boundaries?** (HTTP, DB — not internal modules)
- [ ] **Would this test survive a complete internal refactor** that preserves behavior?
- [ ] **Is the test data realistic** enough to catch edge cases?
- [ ] **If this test passes, am I confident the user journey works?**

If the answer to any of these is "no", the test is a candidate for rewrite.

## Coverage Gates

| Area                                     | Minimum | Target                      |
| ---------------------------------------- | ------- | --------------------------- |
| Critical paths (auth, data transactions) | 80%     | 90%+                        |
| Services / business logic                | 70%     | 80%+                        |
| UI components                            | 20%     | test behavior, not coverage |
| Overall codebase                         | 20%     | —                           |

## Mutation Testing

Mutation testing measures test **quality**, not quantity. Tools inject small bugs into your source code (flip `>` to `>=`, delete a return value) and check if any test catches them. If 40% of mutations survive, 40% of real bugs would slip through your tests undetected — even with high coverage.

**Tools:**

- Frontend: [Stryker](https://stryker-mutator.io/) with `@stryker-mutator/vitest-runner`
- Backend: [mutmut](https://github.com/boxed/mutmut)

**Cadence:** Run at milestone completion via `quality-gate.yml` (`workflow_dispatch`). Not every PR — a full run takes 20-40 minutes.

**Threshold:** 60% mutation score minimum. Below this, the quality gate workflow fails.

**Commands:**

```bash
pnpm mutation:frontend   # Stryker — reports in reports/mutation/
pnpm mutation:backend    # mutmut — results in .mutmut-cache/
```

**Reading reports:** Stryker generates an HTML report showing each mutation and whether tests caught it. Surviving mutants = lines your tests execute but don't actually verify. Focus fixes on survived mutants in critical paths (services, API routes).

## Periodic Test Audit

Once per milestone, spend 30 minutes sampling 10-15 tests from recently added files:

1. Run the 4-question checklist (see [PR template](../.github/pull_request_template.md))
2. Check mutation score for the same files — low score = weak assertions
3. Look for systemic patterns ("all hook tests only assert mock calls")

This is a manual process. The mutation score tells you _where_ to look; the checklist tells you _what's wrong_.

## References

- [Kent C. Dodds — The Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Testing Library — Guiding Principles](https://testing-library.com/docs/guiding-principles)
- [MSW — Mock Service Worker](https://mswjs.io/)
- [Pact — Contract Testing](https://pact.io/)
