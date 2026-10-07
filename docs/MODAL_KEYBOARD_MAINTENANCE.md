# Named dialogs and keyboard focus maintenance

This third increment builds on the separately committed chat-recovery change. It changes the birth-input and reading-conversation overlays only. Art, material behavior, calculation, API/DB routes, authentication, sharing, and payments are unchanged.

## User-facing result

- Both overlays expose a visible, programmatically associated dialog title and `aria-modal` semantics.
- Opening moves keyboard focus into the dialog. Tab and Shift+Tab stay within the currently available controls. Escape dismisses the active dialog and uses the latest close callback.
- Escape during Korean/other IME composition does not dismiss the dialog.
- Closing restores the original trigger when it still exists, without stealing focus from a newer external target.
- If a loading transition removes or disables the focused form control, a scoped observer keeps focus inside the dialog so Tab and Escape continue to work.
- Close buttons have explicit labels and local 44px minimum declarations. Shared CSS already enforced 44px, so this is contract preservation, not a claimed visual enlargement.

The local listener and observer avoid a competing document-wide focus trap. Loading/error states recompute available controls. A changing callback does not restart focus initialization. No browser state or global security setting is changed.

## Verification

`node scripts/qa/modal-accessibility-dom.mjs` tests the actual two components and the focus hook in JSDOM. Three groups pass: birth dialog, chat dialog, and dynamic disabled/removed controls. They cover title linkage, focus entry, forward/backward wrapping, callback replacement, composition Escape, normal Escape, focus restoration, local close-size declarations, and dynamic-control recovery.

The baseline failed the missing-dialog assertion. Independent review reproduced real birth-form submission losing focus to BODY during loading; the scoped recovery fixes this and the dynamic regression passes. The chat-recovery suite remains seven groups passing; the archive lifecycle and API suites are also rerun before publication.

TypeScript passes. Changed-file ESLint has no errors; the existing birth-input `window.location.assign` navigation warning remains because this increment intentionally preserves form-success navigation. The normal build, existing local API/DB integration suite, and approved-art checks are rerun before publication.

JSDOM verifies semantics/events, not actual browser layout, touch ergonomics, or screen-reader output. The existing cloud Chromium Unix-socket limitation remains. No real browser screenshot, hosted login QA, or device-size measurement is claimed. Publication and private-access verification are reported by the separate native deployment receipt.
