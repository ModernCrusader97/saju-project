# Manse form native label connections

Basis: `410c957e6e82886e45f26ab3d5dcc84c69140efb`, verified from the completed private Home validation-state branch. Independent branch: `fix/manse-form-labels-20261010`. [remote-basis.txt](remote-basis.txt) records the 41 existing remote branches.

The Manse name, year, month, day and hour captions are separate label elements with no associated input. In the actual built page, all five native inputs have empty label collections and no accessible name matching their visible caption. Clicking each caption also fails to focus its input. These form-label checks were absent from the existing QA.

Five existing label/control pairs now receive matching native `for`/`id` attributes. Each input derives its name from the existing caption, and native label activation focuses the intended input. The product change adds ten attributes in `app/manse/page.tsx`; visible text, styles, state handlers, calculation and tab order remain unchanged. No focus-management or keyboard-handler implementation is added.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Native controls named by their captions | 0/5 | 5/5 |
| Native label clicks focus the correct input | 0/5 | 5/5 |
| Focused Chromium suite | 3 pass / 2 fail | 5 pass / 0 fail |
| Tab order, Space toggle and disabled-hour skipping | Pass | Pass |
| Defaults, input bounds and explicit calculation | Pass | Pass |
| Page errors, API requests and outbound calls | Zero | Zero |
| Nonincremental TypeScript check | — | Exit 0 |
| Own production build | — | Exit 0 |
| Scoped ESLint | 0 errors / 4 warnings | Same diagnoses, exit 0; new QA has none |
| `git diff --check` | — | Exit 0 |

The same new QA script runs against the original `410c957` build and the corrected worktree's fresh build, using actual Chromium at 390 × 844. It checks native label collections, purpose-based role lookup, unique IDs, actual pointer activation and native Tab/Shift+Tab/Space events. It also preserves the existing checkbox label, unknown-time disabling, original values and limits, and a real local calculation displaying the synthetic name. [validation-summary.json](validation-summary.json), before/after reports and compressed logs retain source hashes and observations.

The inspected initial-form screenshots are byte identical. [preservation.json](preservation.json) compares all 653 preexisting tracked files: 652 are byte identical and only the Manse page changes. Removing exactly the five `for` and five `id` attributes reproduces the original page. Existing Home/error/modal work, all styles and all model assets remain unchanged. The original keyboard-QA WIP retains its recorded script hash. Previously completed error-state and modal-focus suites were not rerun.

[lint-comparison.json](lint-comparison.json) confirms the four existing unused-icon import warnings are unchanged. No rule or warning is suppressed.

## Remaining observation

A preliminary attempt to uncheck unknown time with a pointer at 390px was intercepted by the disabled hour input. [unmodified-pointer-observation.json](unmodified-pointer-observation.json) retains that original-page trace. This separate interaction was not addressed in this label-only change. The final checkbox regression checks use native keyboard events, and no claim is made that the pointer observation is resolved.

## Reproduction

Use installed repository dependencies plus a local Playwright installation. Set `SAJU_QA_PLAYWRIGHT_PATH` to Playwright's `index.mjs`; the script uses `/usr/bin/chromium`.

```sh
npm run build
node scripts/qa/manse-form-labels.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint app/manse/page.tsx scripts/qa/manse-form-labels.mjs
git diff --check
```

The identity and local D1 are synthetic and ephemeral. No API call, real user DB or external AI call executes. Physical screen readers, hosted authentication, other browsers, physical devices and calendar-calculation accuracy are not tested. `SHA256SUMS` covers the evidence. Immutable commit and normal private push/all-file readback proof are saved separately after the commit exists. Main, PRs, deployment, authentication, payment, permissions, design, model work and original-source searches are outside this change.
