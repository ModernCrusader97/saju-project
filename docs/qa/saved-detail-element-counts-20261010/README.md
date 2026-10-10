# Saved detail required element counts

Basis: `637d93cc60ae4cf8d8096dae478eb3eb7cca1f9d`, freshly verified on the completed private analysis-response branch. Independent branch: `fix/saved-detail-element-counts-20261010`. [remote-basis.txt](remote-basis.txt) records all 44 existing private heads; the new branch was absent. Startup checks found no duplicate jobs or new WIP. No repository AGENTS.md or `.agents/skills` instructions were present.

This is the requested narrow follow-up to the analysis-container guard. `FortuneCard` directly reads `analysis.elementsCount.wood`, then the other four element counts. A matching-ID HTTP 200 detail with an object analysis but missing/null `elementsCount` passes the previous guard. The actual built page throws a TypeError reading `wood` and the framework replaces the app with “This page couldn’t load”. The existing archive/detail retry controls disappear.

Only `elementsCount === undefined` and `elementsCount === null` checks are appended to the existing Saved detail conditional. The failure now reaches the same existing message, alert and retry handler. Native retry requests the selected B again, and a valid response restores B without stale A. No schema utility, component, state handler, API, UI text, style or individual-count validation is added. Other non-null values keep the previous behavior.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Focused actual built-page Chromium suite | 2 pass / 2 fail, exit 1 | 4 pass / 0 fail, exit 0 |
| Missing/null element-counts container, matching ID, HTTP 200 | Framework fallback; no detail retry | Existing detail error; native retry recovers B |
| Present counts object with numeric zero wood | Displays `0개` | Same |
| Previous analysis-response Chromium suite | — | 9/9; previous guard, unknown hour, legacy lunar optional date preserved |
| Real React/card detail loading regression | — | 9/9; route changes, delayed bodies, failures, retry, unmount, Strict Mode |
| Corrected page/caught console errors; unexpected API/outbound calls | — | Zero |
| Nonincremental TypeScript check | — | Exit 0 |
| Own production build | Completed basis build reused for reproduction | Fresh candidate build, exit 0 |
| Scoped ESLint | 0 errors / 0 warnings | 0 errors / 0 warnings, including new QA |
| `git diff --check` | — | Exit 0 |

The same new native script runs against the verified basis build and the candidate's own build. It displays valid A, selects B with the actual client router, supplies only the missing/null container variation, verifies the existing detail error, clicks the actual retry control and confirms B. [before-results.json](before-results.json) retains the caught `wood` TypeErrors; [after-results.json](after-results.json), compressed logs and [validation-summary.json](validation-summary.json) retain results, source hashes and synthetic GET records. The candidate-only baseline build link was removed before the corrected production build.

The actual [before fallback](before-missing-element-counts.png), [corrected error](after-missing-element-counts.png) and [retry recovery](after-recovered-reading.png) were visually inspected. Healthy A screenshots are byte identical before and after. [analysis-browser-regression.json](analysis-browser-regression.json) and [detail-dom-regression.json](detail-dom-regression.json) cover the same response path affected by this guard; the latter uses the real Saved page, FortuneCard, response reader and pinned calculation code with deferred synthetic boundaries. Unrelated input-modal, galaxy, share-timer, modal-focus and UniverseNav suites were not repeated.

[preservation.json](preservation.json) compares all 720 preexisting tracked files: 719 are byte identical and only the Saved page changes. Removing exactly the two nullish checks restores the original bytes. Previous protections, original scripts, API/storage code, styles and model assets remain unchanged. The original keyboard-QA WIP hash matches. [lint-comparison.json](lint-comparison.json) confirms no diagnostics or suppression. Existing build bundle-size and static-route-classification notices remain outside this fix.

## Reproduction and limits

Use installed repository dependencies and local Playwright/JSDOM installations. Set `SAJU_QA_PLAYWRIGHT_PATH` to Playwright's `index.mjs` and `SAJU_QA_JSDOM_PATH` to JSDOM's `lib/api.js`. Browser scripts use `/usr/bin/chromium`.

```sh
npm run build
node scripts/qa/saved-detail-element-counts.mjs
node scripts/qa/saved-detail-analysis-response.mjs
node scripts/qa/detail-result-state-dom.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint app/saved/page.tsx scripts/qa/saved-detail-element-counts.mjs
git diff --check
```

The guard addresses only absence/null of the required `analysis.elementsCount` container. It does not validate individual counts, other nested fields or the complete result schema. Synthetic intercepted GETs reproduce the failure; no claim is made about actual private record corruption. Identity/local D1 are synthetic and ephemeral. No actual user DB, API write, chat or external AI runs. Physical devices, screen readers, other browsers, hosted authentication and calendar accuracy are not tested. `SHA256SUMS` covers the evidence. Immutable commit and normal private push/all-file readback proof are saved separately after the commit exists. Main, PRs, deployment, authentication, payment, permissions, new features, design expansion, model changes and original-source searches remain outside this change.
