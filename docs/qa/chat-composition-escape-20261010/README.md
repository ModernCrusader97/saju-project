# Chat composition Escape

Basis: `468861672c7a44c9fb96439e7f2031778001c33c`, freshly verified on the private completed element-counts branch. Isolated branch: `fix/chat-composition-escape-20261010`. [remote-basis.txt](remote-basis.txt) records the 45 existing private heads; this branch was absent. Startup checked all existing worktrees and live processes, preserved the keyboard-QA WIP, and found no applicable AGENTS.md or repository `.agents/skills` instructions.

In the actual chat dialog, Escape during Korean text composition reached the window keydown listener with `isComposing: true` and `isTrusted: true`. The existing listener closed the dialog. The initial read-only [probe](initial-probe.json) and the final baseline suite reproduce this independently of sending a chat message.

Only the existing Escape close condition in `components/AskDoryeongModal.tsx` gains `!e.isComposing`. A composing Escape now leaves the dialog and focused input open. Ordinary Escape continues to close. No preventDefault, composition handler, state, request, markup, text, label, style or model change is added.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Actual built-page Chromium suite | 5 pass / 1 fail, exit 1 | 6 pass / 0 fail, exit 0 |
| Active composition and Escape | Dialog closes | Dialog stays open; committed prefix and input focus survive |
| Ordinary Escape | Closes; reopened draft survives | Same |
| Escape after composition commit | Closes; reopened complete question survives | Same |
| Escape after composition cancellation | Closes; reopened committed prefix survives | Same |
| Native close button and backdrop click | Close; reopened draft survives | Same |
| Page/console errors, unexpected API, chat POSTs, outbound calls | Zero | Zero |
| Nonincremental TypeScript | — | Exit 0 |
| Production build | Verified basis build used | Fresh candidate build completed |
| Scoped ESLint | 0 errors / 0 warnings | 0 errors / 0 warnings, including new QA |
| `git diff --check` | — | Exit 0 |

The same new [QA script](../../../scripts/qa/chat-composition-escape.mjs) runs on the basis and candidate builds. It opens the real FortuneCard chat UI, composes through CDP `Input.imeSetComposition`, and presses Escape through Playwright's Chromium keyboard. No DOM keyboard dispatch, direct handler invocation or programmatic submission is used. Composition-start/update and composing input events, and Escape keydown events, have trusted browser event flags. CDP composition commit may report an untrusted `compositionend`; the check requires its presence, the native Escape's `isComposing: false`, actual close behavior and preserved draft, rather than assuming every event phase is trusted.

[Before results](before-results.json), [after results](after-results.json), compressed logs and [validation-summary.json](validation-summary.json) retain events, synthetic GET records and application source hashes. The candidate-only baseline `dist` link was removed before building the corrected app. All four native screenshots were visually inspected: [before composing Escape](before-composing-escape.png) shows the dismissed dialog, while [after composing Escape](after-composing-escape.png) shows the open composer. Healthy [before](before-chat-open.png) and [after](after-chat-open.png) screenshots differ by 44 pixels in the input caret/lower left panel corner area; they are not byte identical.

[Preservation](preservation.json) compares every one of the 744 preexisting tracked files. Exactly 743 are byte identical; only the chat component changes. Removing exactly the composition guard restores the original file bytes. The original keyboard-QA WIP hash still matches. [Lint comparison](lint-comparison.json) records no new diagnostics or suppression. Existing bundle-size and static-route-classification build notices remain.

## Reproduction and limits

With installed repository dependencies and Chromium, set `SAJU_QA_PLAYWRIGHT_PATH` to Playwright's `index.mjs`:

```sh
npm run build
SAJU_QA_PHASE=after node scripts/qa/chat-composition-escape.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint components/AskDoryeongModal.tsx scripts/qa/chat-composition-escape.mjs
git diff --check
```

The browser runs at 390×844. Composition is synthesized through CDP; physical keyboards and OS IMEs, other browsers/devices, screen readers and hosted authentication were not tested. Only valid intercepted synthetic GET responses are used, with ephemeral local D1 and blocked outbound access. No actual user DB, chat POST, external AI or unrelated completed flow is exercised. Saved-detail selection/late responses, input lifecycle, form labels, checkbox overlap, error responses and original model searches were not repeated.

`SHA256SUMS` covers the evidence. The immutable commit, normal private push and all-file remote readback proofs are saved separately after the commit exists. No main merge, PR, deployment, public publish, new authentication or permission change is performed.
