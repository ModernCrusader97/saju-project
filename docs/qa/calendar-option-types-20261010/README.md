# Calendar option/state type boundary

Basis: `5f70798e27c9dd2474bceb823706cf6d37e5475c`, verified from the completed private input-request lifecycle branch. Independent branch: `maint/saju-calendar-option-types-20261010`. [remote-basis.txt](remote-basis.txt) retains the 38 existing remote branches at the start of this task.

The calendar choices infer their IDs as general strings, and `setCalendarType(item.id as any)` bypasses the state's existing `solar | lunar | leap-lunar` domain. An in-memory typo changing only the option ID `solar` to `solra` produces no TypeScript diagnostic before the change. This is a code-quality defect in the state boundary; all three existing valid choices already work, and no runtime defect is claimed for them.

Three product lines change in `components/SajuInputModal.tsx`: the option array retains its literal IDs with `as const`, and each ID is passed directly to the existing typed setter. The same invalid option now produces TS2345 at that setter. An arbitrary domain cast, lint suppression or rule change is unnecessary.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Invalid option ID rejected by the actual project compiler | Fail: zero diagnostics | Pass: TS2345 at the state setter |
| Native selection, POST value and year range for all three modes | 3/3 pass | 3/3 pass |
| Page errors and outbound calls | Zero | Zero |
| Combined focused QA | 4 pass / 1 fail | 5 pass / 0 fail |
| Nonincremental TypeScript check | — | Exit 0 |
| Own production build | — | Exit 0 |
| Scoped ESLint | 2 errors / 3 warnings | 1 error / 3 warnings |
| `git diff --check` | — | Exit 0 |

The same new QA script runs before and after. Its compiler probe alters only the option ID in a virtual compiler source file, using the actual project configuration and remaining sources. The invalid ID is never written to disk, executed or sent to an endpoint. The native Chromium checks exercise the built Home/modal with pointer/input events at 390 × 844. They scope year-range assertions to the modal and verify `solar` with maximum 2100, and `lunar`/`leap-lunar` with maximum 2050, along with the unchanged synthetic name and birth-date payload. Local POST responses intentionally return 422 to keep the input form available; these three expected alerts are accepted, and no real API write or external AI call executes.

The baseline uses the completed `5f70798` worktree's unchanged build; the final run uses this worktree's own fresh build. [validation-summary.json](validation-summary.json), before/after reports, inspected lunar-selection screenshots and compressed logs retain the evidence and source hashes. Previously completed request-lifecycle and feature suites were not repeated.

[lint-comparison.json](lint-comparison.json) confirms that only the selected explicit-any error disappears. The remaining explicit-any error is the preexisting catch parameter, and the three warnings concern unused variables and the existing internal location assignment. ESLint still exits 1; no rule or diagnosis is suppressed. The new QA script has no lint messages.

[preservation.json](preservation.json) compares all 596 preexisting tracked files: 595 are byte identical. Normalizing only these three calendar type changes reproduces the original component exactly, preserving its completed request-lifecycle fix, layout, labels and submitted payload construction. Existing model files and other completed work are among the unchanged files. The original keyboard-QA WIP retains its recorded script hash.

## Reproduction

Use installed repository dependencies and a local Playwright installation. Set `SAJU_QA_PLAYWRIGHT_PATH` to Playwright's `index.mjs`; the script uses `/usr/bin/chromium`.

```sh
npm run build
node scripts/qa/calendar-option-types.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint components/SajuInputModal.tsx scripts/qa/calendar-option-types.mjs
git diff --check
```

Server calendar calculations, real record persistence, hosted authentication, Safari, Firefox and physical devices are not tested. The browser identity and local D1 are synthetic and ephemeral. `SHA256SUMS` covers the evidence. Normal private push, immutable SHA and all-file readback proof are saved separately after the commit exists. Main, PRs, deployment, authentication, payment, permissions and model work are outside this change.
