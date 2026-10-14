# Existing Lint Root Causes Implementation Plan

> **For agentic workers:** Execute inline using superpowers:executing-plans. The user explicitly authorized continued implementation and normal commit/push every five independently verified causes.

**Goal:** Resolve active-source lint errors at 31563a1 without concealing historical diagnostics or changing app, database or model contracts.

**Architecture:** Preserve the original four-file WIP in its existing checkout and fix only the separate branch. Diagnose with the unchanged npm lint command, and keep historical QA snapshots immutable. Separate independent causes in the ledger; five verified causes share one normal commit and push.

**Tech Stack:** TypeScript 5.9, React 19, Node 22, ESLint 9, existing offline QA loader and native Chromium.

**Spec:** /workspace/saju-lint-539-evidence-20261014/request-and-scope.md

## Global Constraints
- Baseline exact HEAD: 31563a1f7cf23a6109b1935c4f3be75fd5f284b0, 539 errors, 20740 warnings.
- 36 active-source errors, 461 historical generated bundle errors, 42 historical source snapshot errors.
- No rule disabling, new eslint-disable, any replacement/casts, blanket autofix, misleading clean-lint claim, old evidence rewrite, main/PR/deploy, auth/payment/permission/DB changes or dragon editing/rendering.
- Five independent causes, not five diagnostics, per normal commit/push; retain fewer-than-five verified WIP.
- New owner-only Drive artifacts, full bytes/SHA/CRC/new-directory recovery, no credentials/contact metadata.

## Review Focus
- Catch narrowing must preserve DataStoreError/SajuInputError response status and body.
- Calendar options must remain the same three literal values and selected behavior.
- JSX escaping must preserve visible quotes and text, including dynamic content.
- Const bindings must preserve mutation of Three vectors and surface projection results.
- QA migration must retain synchronous loader API, offline dependency guard and every caller; browser tests must avoid real DB/AI requests.

### Task 1: Unknown catch types
Files: app/api/guin/[id]/route.ts, app/api/guin/route.ts, app/api/saju/[id]/route.ts, app/api/saju/[id]/chat/route.ts, components/SajuInputModal.tsx.
- [ ] Read six existing no-explicit-any failures from baseline.
- [ ] Replace only catch type annotations with unknown.
- [ ] Compare erased TypeScript runtime output before/after; require byte equality. Run targeted lint for this rule and types at batch gate.

### Task 2: Calendar literal domain
File: components/SajuInputModal.tsx.
- [ ] Read literal options cast failure.
- [ ] Infer the three options as a readonly literal array; remove any cast.
- [ ] Require identical erased runtime output and targeted no-explicit-any lint; existing calendar/name fixtures at batch gate.

### Task 3: JSX quotes
Files: components/FortuneCard.tsx, app/daily/page.tsx.
- [ ] Read six unescaped JSX quote failures.
- [ ] Escape exactly the affected quotes as &quot;.
- [ ] Compare transpiled JSX string values before/after; require equality, then targeted lint and existing text/calendar regression.

### Task 4: Fixed object bindings
Files: components/planet/FiveElementFormStudy.tsx, PorcelainHeroStudy.tsx, lib/planet/mesh-surface.ts.
- [ ] Read five prefer-const diagnostics and trace assignment versus object mutation.
- [ ] Make only the unreassigned bindings const; keep vector mutation and other reassignments unchanged.
- [ ] Targeted prefer-const lint, typecheck and static geometry/loader fixtures; no rendering or model generation.

### Task 5: Native QA modules
Files: scripts/qa/load-ts.cjs, spirit-vertex-colors.cjs and six existing callers found by rg.
- [ ] Preserve CommonJS originals and read eight no-require-imports failures.
- [ ] Migrate helper and vertex QA to native .mjs imports, update every current caller, preserve createLoader(mocks, globals) and VM module guard.
- [ ] Run offline name/session/calendar/detail fixtures and static vertex-color QA, plus targeted lint.
- [ ] Batch tasks 1–5: typecheck, production build without asset sync, full unchanged lint and immutable archive/WIP guards. Independent read-only review, then normal commit/push and exact remote SHA.

### Task 6: Internal links
Files: components/Header.tsx, app/guin/[id]/page.tsx.
- [ ] Reproduce three native-anchor errors.
- [ ] Use next/link only for those current internal links.
- [ ] Native browser navigation, error page and keyboard checks with external requests blocked; retain original unrelated WIP checkout bytes.

### Task 7: Renderer status lifecycle
Files: the five diagnosed components/planet renderer study/canvas components.
- [ ] Trace seven effect failures and resource ownership before selecting a change.
- [ ] Separate external canvas status and reduced-motion subscription from redundant synchronous effect resets; preserve cancellation, failure, retry and ready states.
- [ ] Add focused native DOM lifecycle regression before implementation, deliberately fail old code for the redundant-reset behavior, then verify retry/selection/cleanup; no WebGL draws or dragon/model changes.

### Historical scope decision
- [ ] Keep all 503 original evidence diagnostics and hashes visible. Scope routing remains pending user preference; do not change the global ignore list or rewrite archives without resolving the requested interpretation.
- [ ] Preserve any final under-five bundle as WIP and continue only genuine remaining causes.
