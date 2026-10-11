# UI maintenance batch three - Joseph - 2026-10-11

Five new fixes on a separate branch from 05b1e047. Previous ten completed fixes and 25 QA directories are excluded; previous completed suites rerun: zero.

1. guin-known-time-required-field-focus - Require known-hour/minute fields in relationship create/manual-join forms so native missing-field validation focuses the input before submission. Existing strict parser already rejects blanks; preserve valid known and unknown-time flows.
2. guin-create-map-id-type - Require a string ID matching the already supported map-path characters before persisting or navigating after creation. Missing/null/numeric IDs retain the draft and follow the existing error alert.
3. chat-modal-native-keyboard-boundary - Name the conversation pane as a modal dialog, focus its existing close control, contain native Tab/Shift+Tab during normal/pending history and restore the opener. Existing close/history/send logic stays unchanged.
4. saju-input-choice-selection-state - Expose selected gender and calendar using aria-pressed on the existing five buttons; preserve pointer selection and native Space/Enter without form submission.
5. ai-post-result-json-record - Show an explicit visible result-format error for POST null/primitives/arrays instead of accepting them or silently hiding null. Preserve valid/error JSON objects and one explicit request without auto-retry; existing GET status validator is unchanged.

Current batch before: 18/46 PASS, 28 FAIL, no page errors. Focused checks: 46/46 PASS. Requested current-batch final native Chrome regression: 46/46 PASS at 390x844 and 1440x1000. No real backend/DB/provider requests.
Types and production build PASS. Existing product lint: 4 errors and 7 warnings retained; new product/QA diagnostics: zero. No lint rules/config/suppression changes.
Normal controls: 16 raw captures reviewed, 13 byte/pixel-identical, 3 with 43 changed edge pixels total (maximum channel delta 5/255). CSS and affected fixture observations are identical. Native raster variance is inferred, not an independently established Chrome mechanism. All originals, diagnostics and the earlier strict guard failure are retained. Changed/error UI is inspected directly.

Known-time blanks are already rejected by the existing strict parser. Fix 1 adds native required-field validation and focus; no midnight miscalculation or real invalid database persistence is claimed. Initial harness noise/incorrect hypothesis is retained with the correction record.

Branch: fix/ui-maintenance-batch-three-20261011-joseph
Basis SHA: 05b1e0471755121137f130227a16b62b870f069a

At 1/5, WIP and evidence were preserved as a new owner-only Drive ZIP without commit/push. One ordinary commit/nonforce push is allowed only after this five-fix batch passes gates. Preserve all 61 previous remote branches, legacy WIP, five art checkouts, other eleven designs and defaults.

- Production relationship create/join known-time fields, create map ID type, Chat modal focus boundary, Saju choice states and AI POST JSON record display. Actual native Chrome React/Tailwind at 390x844 and 1440x1000 with fictional intercepted APIs. Fixed Next/host/navigation landing fixtures, only GalaxyCanvas blank. Pure calculation prepares fictional matching owner/pillars; no correctness claim for calculation, storage ownership or existing GET/status/send validators. No real API/DB/Gemini/user storage/clipboard/3D/hosted/physical device claim. Previous completed suites excluded.
- Existing integer parser rejects empty known-time strings; no midnight miscalculation or real invalid-value persistence is claimed. This fix is native missing-field focus/validation in relationship create/manual-join only; other forms/calculation/server behavior stay unchanged.
- Create ID type/character check only; prior ownership/pillar matching and friend-map GET/POST schema validators are unchanged and not rerun. No real record creation or persistence acceptance.
- Chat only tests dialog semantics and normal/pending-history Tab/Shift+Tab/opener focus. Prior history row/reply/uncertain-send/IME suites are neither rerun nor counted.
- Saju gender/calendar button selection semantics only; no calendar calculation, submission or prior input modal keyboard/date/request lifecycle suite is rerun.
- AI POST top-level JSON record display only, preserving object/error-object display; configured GET validator/provider behavior/cap/auth/billing are unchanged and not retested. Exactly one fictional POST per explicit native input; no actual Gemini calls.
- Current-batch focused tests are followed by the requested current-batch final regression. Prior completed UI/model suites/fixes are excluded.
- First harness noise and false midnight hypothesis are retained with a correction record. Valid before-v2 uses unchanged products and the same v2 assertions/harness as all focused/final checks.
- Sixteen normal UI captures reviewed: thirteen byte/pixel-identical, three with 43 total differing edge pixels and maximum channel difference 5/255. CSS and affected fixture observations are identical; desktop before/final variants cross-match. Native raster variance is an inference; exact mechanism was not independently established. Direct inspection found no content/layout regression. All originals and the failed strict byte guard are retained. Changed focus/error UI is inspected directly; screenshots are unedited, not generated images or 3D renders.
- Build inputs removed by sparse branch switch were restored only from exact pre-switch same-file bytes, zero existing overwrites. Eight inputs and five runtime outputs are byte-identical after gates. No raw hosting values, credentials, model bytes or database contents are packaged.
- Existing lint diagnostics are preserved without config/rule/suppression changes. New evidence scope treats raw logs/bundles/native snapshots as binary diffs to preserve exact bytes; product/QA whitespace and lint checks remain enabled.
- Drive unshared single-owner/size metadata is verified; uploaded remote bytes are not independently downloaded/rehashed. Local ZIP CRC/entry/native bytes are verified.

evidence/ retains raw FAIL/PASS, screenshots, lint/build/type logs, native source snapshots and byte proofs. authoring/ retains original and corrected scripts; assemble_batch_three_reviewed.mjs is the reviewed assembler. SHA256SUMS covers this scope. All task outputs are in approved D:/Codex/Work, Results and Scratch roots.
