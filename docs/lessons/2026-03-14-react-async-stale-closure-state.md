# React state is stale after async calls — return values instead

**Date:** 2026-03-14
**Context:** `handleNearMe` in `app/page.tsx` read `latitude` and `longitude` from `useGeolocation` state after awaiting `requestLocation()`. Geolocation never worked on first use.

**What happened:** After `await requestLocation()`, the hook called `setLatitude/setLongitude` internally, queuing a re-render. But the current closure still held the pre-render `null` values. The `if (latitude && longitude)` check always failed, so the map redirect never happened.

**Root cause:** React state captured in a closure is frozen at the time the closure was created. `await` suspends the function, but resuming it resumes the same closure — the state variables don't update in-place. Calling a setter schedules a future render; it doesn't mutate the current variable.

**Prevention:** When an async function produces a value the caller needs immediately, return it directly — don't write to state and expect callers to read state. Change `requestLocation: () => Promise<void>` to `requestLocation: () => Promise<Coords | null>`. The caller uses the returned value; state updates are a side effect for UI reactivity.

Rule: **Never read React state immediately after an `await` that triggers a setter for that same state.** Either read state before the await, or have the async function return the value directly.
