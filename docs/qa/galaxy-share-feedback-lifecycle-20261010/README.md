# Galaxy link-copy feedback lifecycle

Basis: `bad1d8abd9d6b691d7da0b506e763bca53d3c424`, verified from the private remote's completed keyboard-maintenance branch. Independent branch: `fix/galaxy-share-feedback-lifecycle-20261010`.

Copying the galaxy link again before its two-second acknowledgment expires schedules a second timer but leaves the first one active. The first timer then hides the recent acknowledgment too early. Native keyboard reproduction at 390px and 1440px observed the label reset only about **1.05 seconds after the latest copy**. Real React execution also showed a feedback timer remaining after unmount and keyed route replacement.

The page now retains its current feedback deadline, replaces it on each copy, and cancels it during cleanup. The latest copy keeps its existing acknowledgment for two seconds. The product diff is ten added lines and one replaced line in `app/guin/[id]/page.tsx`; clipboard calls, URLs, labels, styles and request handlers are unchanged.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Focused real React lifecycle suite | 3 pass / 5 fail | 8 pass / 0 fail |
| Built Worker, native keyboard and actual browser timers | 3 pass / 2 fail | 5 pass / 0 fail |
| Fresh nonincremental TypeScript check | — | Exit 0 |
| Production build from this worktree | — | Exit 0 |
| Scoped ESLint | 2 errors / 3 warnings | Same diagnostics; new QA scripts have none |
| `git diff --check` | — | Exit 0 |

The React suite verifies single-copy expiry, later-copy duration, burst replacement, unmount, keyed replacement, copying again after expiry, the copied URL/call count, and Strict Mode cleanup. It runs the actual page and response reader with controlled timer, clipboard and HTTP boundaries and visual/navigation stubs. The native browser suite uses actual Chromium keyboard events, `performance.now()` and browser timers; clipboard writes are intercepted without changing permissions. It checks repeated copy and copying after expiry at both widths. Copying initiates no POST requests. Unexpected page errors and outbound requests are zero; four deliberately unsupported-WebGL console messages are expected.

[validation-summary.json](validation-summary.json), before/after results, screenshots and compressed logs retain the evidence and final source hashes. The 390px before/after screenshots were inspected visually. The baseline reused the completed `bad1d8a` worktree's build; the final run used this worktree's own fresh build. The same new QA scripts ran before and after the product change. Previously completed feature suites were not repeated.

The existing lint errors concern two plain `/guin` navigation anchors, and the three warnings concern unused imports. [lint-comparison.json](lint-comparison.json) compares diagnostic identities and messages exactly; this change adds no suppression or new diagnosis. Lint itself still exits 1 because of those existing errors.

[preservation.json](preservation.json) compares all 545 preexisting tracked files: 544 are byte identical. Removing the three explicitly allowed timer-management blocks reproduces the original page exactly. The completed keyboard fix and the original WIP's QA script retain their recorded hashes. All existing model assets are among the unchanged files. The initial friend-request navigation candidate did not reproduce a late alert under actual document navigation; its probe is retained in [unmodified-friend-request-navigation-probe.json](unmodified-friend-request-navigation-probe.json), and those handlers remain unchanged.

## Reproduction

Use installed repository dependencies plus a local jsdom and Playwright installation. Set `SAJU_QA_JSDOM_PATH` to jsdom's `lib/api.js` and `SAJU_QA_PLAYWRIGHT_PATH` to Playwright's `index.mjs`; `SAJU_QA_CHROME` can select the Chromium executable.

```sh
node scripts/qa/share-feedback-lifecycle-dom.mjs
npm run build
node scripts/qa/share-feedback-browser.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint 'app/guin/[id]/page.tsx' scripts/qa/share-feedback-lifecycle-dom.mjs scripts/qa/share-feedback-browser.mjs
git diff --check
```

OS clipboard contents/permissions, Safari, Firefox, physical devices and hosted authentication were not tested. D1 is ephemeral and the identity is synthetic. `SHA256SUMS` covers the evidence; normal private push/readback evidence is saved separately after the immutable commit exists.
