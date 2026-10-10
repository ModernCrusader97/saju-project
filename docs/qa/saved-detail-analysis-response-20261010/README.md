# Saved detail analysis response guard

Basis: `dd6fff0fe9701e3a190d14694ace10d517ca4a29`, freshly verified on the completed private checkbox branch. Independent branch: `fix/saved-detail-analysis-response-20261010`. [remote-basis.txt](remote-basis.txt) records the 43 existing private heads; the new branch was absent. Startup checks found no duplicate jobs or new WIP. No repository AGENTS.md or `.agents/skills` instructions were present.

The selected defect is a successful detail response whose `fortune.id` matches the requested reading but whose required `analysis` is absent or is not an object. The existing response reader checks the envelope, and the Saved page checks the reading ID. Such a response therefore reaches `FortuneCard`, where accessing `analysis.hourPillar` or `analysis.elementsCount` throws. In the actual built page, the framework catches the render error and replaces the app with “This page couldn’t load”; the existing detail retry control and archive navigation disappear. This is separate from the previously corrected late-response lifecycle.

The page now reads `data.fortune.analysis` and rejects missing/null, primitive and array values before storing a selected detail. The existing error message, alert and retry handler receive the failure. Retry requests the same selected ID and a valid response displays that reading. The product diff is one new variable plus the extended existing conditional in `app/saved/page.tsx`. No error component, UI text, styling, state handler, API or retry feature is added.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Actual built-page Chromium suite | 3 pass / 6 fail, exit 1 | 9 pass / 0 fail, exit 0 |
| Missing/null/string/number/boolean/array analysis, matching ID and HTTP 200 | Framework render fallback; no detail retry | Existing detail error; native retry recovers to selected B |
| Unknown birth time with valid analysis and null hour pillar | Pass | Pass |
| Legacy lunar result without optional solar conversion | Pass | Pass |
| Related real React/card detail regression | — | 9/9; rapid route changes, delayed bodies, failures, retry, unmount and Strict Mode |
| Unexpected API requests/outbound calls | Zero | Zero |
| Page and caught console errors in corrected scenarios | — | Zero |
| Nonincremental TypeScript check | — | Exit 0 |
| Own production build | Completed basis build reused for reproduction | Fresh candidate build, exit 0 |
| Scoped ESLint | 0 errors / 0 warnings | 0 errors / 0 warnings, including new QA |
| `git diff --check` | — | Exit 0 |

The same final new QA script runs against the verified basis build and the candidate's own build. It first displays valid A, uses the real client router to select B, supplies the malformed matching-ID body, verifies the existing detail error, clicks the actual retry button and confirms valid B replaces the error without stale A. [before-results.json](before-results.json) retains the framework's caught TypeError traces; [after-results.json](after-results.json), compressed logs and [validation-summary.json](validation-summary.json) retain all scenarios, source hashes and GET request records. The candidate-only baseline build symlink was removed before the corrected production build.

The actual [before fallback](before-invalid-analysis.png), [corrected error](after-invalid-analysis.png) and [retry recovery](after-recovered-reading.png) were visually inspected. The healthy A reading screenshots are byte identical before and after. [detail-dom-regression.json](detail-dom-regression.json) uses the real Saved page, FortuneCard, response reader and pinned calculation code; deferred API/router boundaries are synthetic. That existing suite was rerun because this guard changes the same detail response path. Completed input-modal, galaxy late-GET, share-timer, modal-focus and UniverseNav work was not repeated or modified.

[preservation.json](preservation.json) compares all 698 preexisting tracked files: 697 are byte identical, and normalizing only the new guard restores the original Saved page bytes. This preserves all prior fixes, original scripts, styles, API/storage code and model assets. The original keyboard-QA WIP hash also matches. [lint-comparison.json](lint-comparison.json) confirms no lint error/warning or suppression. Existing build bundle-size and static-route-classification notices remain outside this guard.

## Reproduction and limits

Use installed repository dependencies and local Playwright/JSDOM installations. Set `SAJU_QA_PLAYWRIGHT_PATH` to Playwright's `index.mjs` and `SAJU_QA_JSDOM_PATH` to JSDOM's `lib/api.js`. The native suite uses `/usr/bin/chromium`.

```sh
npm run build
node scripts/qa/saved-detail-analysis-response.mjs
node scripts/qa/detail-result-state-dom.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint app/saved/page.tsx scripts/qa/saved-detail-analysis-response.mjs
git diff --check
```

This small guard addresses only absent or non-object required analysis; it is not a full validator for every nested `FortuneResult` field. API bodies are synthetic intercepted GET responses, and no claim is made that actual private user records are corrupted. Identity/local D1 are synthetic and ephemeral; no actual user DB, API write, chat or external AI runs. Physical devices, screen readers, other browsers, hosted authentication and calendar accuracy are not tested. `SHA256SUMS` covers the evidence. Immutable commit and normal private push/all-file readback proof are saved separately after the commit exists. Main, PRs, deployment, authentication, payment, permissions, new features, design expansion, models and original-source searches are outside this change.
