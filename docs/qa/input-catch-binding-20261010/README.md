# Input modal unused catch binding

Basis: `8d7760e0565f25be02ab6180c0d817040a4c8e88`, verified from the completed private calendar-option maintenance branch. Independent branch: `maint/saju-input-catch-binding-20261010`. [remote-basis.txt](remote-basis.txt) records the 39 preexisting remote branches.

The remaining explicit-any lint error is `catch (err: any)` in `SajuInputModal`. Its variable is never read: the handler selects the existing generic network alert solely from its owned request's abort signal. The unused binding also produces a no-unused-vars warning. Keeping an unused, unconstrained exception value serves no purpose; an optional catch binding directly expresses the handler's behavior without assigning a misleading exception type.

One product line changes to `catch {`. The catch body, alert text, cancellation guard and finally cleanup remain exactly unchanged. This is a code-quality improvement, and no existing runtime defect is claimed. No narrowing, exception-message rendering, suppression or rule change is introduced.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Focused real React exception-value checks | 7 pass / 0 fail | 7 pass / 0 fail |
| Recorded failure behavior | Generic alert, draft retained, timer disposed | Exactly identical observations |
| Scoped ESLint | 1 error / 3 warnings, exit 1 | 0 errors / 2 warnings, exit 0 |
| Nonincremental TypeScript check | — | Exit 0 |
| Own production build | — | Exit 0 |
| `git diff --check` | — | Exit 0 |

The same new QA script executes the actual modal, React DOM and API response reader before and after. It checks Error, string and null rejections; an object whose message getter would throw; an active rejection merely named AbortError; malformed response JSON; and an invalid JSON shape. Every case preserves the generic alert and synthetic name draft, releases its progress timer, leaves the active signal un-aborted, and triggers no success or close callback. The message getter is never accessed. [validation-summary.json](validation-summary.json), before/after reports and compressed logs retain the source hashes and exact observations.

[lint-comparison.json](lint-comparison.json) confirms that only the explicit-any error and unused catch-variable warning disappear. The existing unused Loader2 import and internal location-assignment warning remain; the new QA script has no lint messages. This is a scoped lint result, not a claim that the entire repository has no diagnostics.

[preservation.json](preservation.json) compares all 615 preexisting tracked files: 614 are byte identical and only the modal changes. Restoring its one original catch line reproduces the original component exactly. The completed calendar types, request lifecycle, layout, payload construction and all existing model assets are preserved. The original uncommitted keyboard-QA script retains its recorded hash. Previously completed feature suites were not rerun.

## Reproduction

Use installed repository dependencies and a local jsdom installation. Set `SAJU_QA_JSDOM_PATH` to jsdom's `lib/api.js`.

```sh
node scripts/qa/input-catch-values.mjs
node_modules/.bin/eslint components/SajuInputModal.tsx scripts/qa/input-catch-values.mjs
node_modules/.bin/tsc --noEmit --incremental false
npm run build
git diff --check
```

Alert, HTTP and progress-time boundaries are controlled; no real API write, external AI call or user DB is involved. Native-browser interaction, hosted authentication and other browsers are not tested for this one-line change. `SHA256SUMS` covers the evidence. The immutable commit and normal private push/all-file readback proof are saved separately after the commit exists. Main, PRs, deployment, authentication, payment, permissions, model changes and original-source searches are outside this change.
