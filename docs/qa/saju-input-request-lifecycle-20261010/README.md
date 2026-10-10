# Saju input request lifecycle

Basis: `61f1a3dbcc3e4d991198b64e0a624c208ccf8b58`, read from the private remote's completed copy-feedback maintenance branch. Independent branch: `fix/saju-input-request-lifecycle-20261010`. The initial remote snapshot is retained in [remote-basis.txt](remote-basis.txt).

Closing the input modal while its POST is pending leaves the request and 900 ms progress timer alive. In the same browser document, a late failure then displays a global alert after cancellation. Reopening a different topic remains on the old loading screen, and a late success can invoke the old result and close callbacks. These pending-close/reopen cases were not covered by the existing mobile-home checks.

The modal now owns its pending request and progress timer. Escape, the close button, the backdrop, an external close, and unmount cancel that work. Late replies cannot alert, publish a result, close a newer visit, or finish a newer request's loading state. Reopening clears the canceled visit's progress while retaining the existing input draft. Active failures still display their existing alert and permit an explicit manual retry.

The product change is confined to `components/SajuInputModal.tsx`. The endpoint, headers and submitted body are unchanged apart from the abort signal; the existing success path, layout, labels and inputs are preserved. Client cancellation does **not** promise rollback of server work that already started.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Real React modal and response reader | 1 pass / 7 fail | 8 pass / 0 fail |
| Built Home/modal with native Chromium events | 2 pass / 2 fail | 4 pass / 0 fail |
| Fresh nonincremental TypeScript check | — | Exit 0 |
| Production build from this worktree | — | Build completion observed; final browser checks use that build |
| Scoped ESLint | 2 errors / 3 warnings | Same diagnostics; new QA scripts have none |
| `git diff --check` | — | Exit 0 |

The same new QA scripts ran before and after the product change. The baseline browser run reused the completed `61f1a3d` worktree's unchanged modal build; the final run used this worktree's own fresh production build. The browser exercises native pointer/input/Escape events at 390 × 844, verifies that cancellation stays in the same document, checks a fresh request in a reopened topic, and retains active failure/manual-successful-retry behavior. It records zero page errors and zero outbound requests. POST replies are synthetic boundary fixtures, and no real `/api/saju` write or external AI call executes.

The React suite uses the actual modal and response reader with controlled progress time and a transport deliberately ignoring abort. It separately verifies timer disposal, preserved drafts, stale failed/successful replies, current-request ownership, unmount and Strict Mode. [validation-summary.json](validation-summary.json), before/after results, screenshots and compressed logs retain the evidence and source hashes. Both reopened screenshots were inspected visually: the old spinner becomes the editable form containing the synthetic draft.

The two existing lint errors concern explicit `any` types, and the three warnings concern unused variables and the existing internal `window.location.assign` call. [lint-comparison.json](lint-comparison.json) compares diagnostic identities and messages, allowing shifted line numbers. ESLint still exits 1 because of those existing errors; no rule is suppressed and no new diagnosis is added.

[preservation.json](preservation.json) compares all 571 preexisting tracked files: 570 are byte identical and only the modal changes. Its JSX is exactly preserved after normalizing the two close bindings. The previous galaxy keyboard and copy-timer fixes retain their recorded hashes, and all existing model assets remain among the unchanged files. The original uncommitted keyboard-QA worktree retains its recorded script hash. Previously completed feature suites were not rerun.

## Reproduction

Use installed repository dependencies plus local jsdom and Playwright installations. Set `SAJU_QA_JSDOM_PATH` to jsdom's `lib/api.js` and `SAJU_QA_PLAYWRIGHT_PATH` to Playwright's `index.mjs`. The native browser script uses `/usr/bin/chromium`.

```sh
node scripts/qa/input-request-dom.mjs
npm run build
node scripts/qa/input-request-browser.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint components/SajuInputModal.tsx scripts/qa/input-request-dom.mjs scripts/qa/input-request-browser.mjs
git diff --check
```

Hosted authentication, server persistence/rollback, Safari, Firefox and physical devices were not tested. Identity and local D1 storage are synthetic and ephemeral. `SHA256SUMS` covers the evidence; immutable commit and normal private push/readback proof are saved separately after the commit exists. Main, PRs, deployment, authorization, payment, permissions and existing model work are outside this change.
