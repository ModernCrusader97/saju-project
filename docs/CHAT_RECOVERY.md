# Chat history and interrupted-send recovery

Base: Site v26 (`cd288af75cd2a2eb294cd5e6e4a375d5737e2fe9`) / private GitHub `90b92db056b1fa9728ae5da3d232c22a28540e94`.

## Bounded change

The conversation modal now waits for history before enabling send, shows history failures with an inline retry, and cancels dismissed history reads. Late history responses cannot overwrite a newer visit. A fortune-ID key isolates messages and drafts when a different reading is selected.

A synchronous in-flight guard prevents two same-tick submits from producing two POST requests. The typed question stays in the input until a successful server acknowledgment. An uncertain error does not automatically retry the POST or append a phantom unsaved exchange. It asks the user to read the authoritative history first; a pending question found among newly loaded rows is recognized as saved. If no match is found, ordinary sending remains gated with an explicit warning that the previous request can still finish later. Only a separate duplicate-aware resend choice can send again. A saved-question notice keeps a history-refresh control available for a possibly pending reply. Failed-send recovery controls stay next to the composer, outside long scrollable transcripts.

Confirmed exchanges display the user question and reply once, then refresh history. Closing/reopening while a request is pending does not launch a competing history load. A response to an unmounted/previous fortune cannot alter the current conversation.

## Important boundary

This is client-side duplicate prevention and reconciliation, not durable server-side idempotency. The existing POST API can save a question before its reply is received by the browser. A missing question in one history snapshot does not prove that the original server request can never finish later. No automatic resend, background polling, provider change, billing change, or database migration is added. Durable exactly-once behavior across devices, reloads, or explicit repeated requests would require a separately designed server request-ID contract.

## Verification

- Regression first failed against v26 because send was enabled before the initial history arrived.
- `scripts/qa/chat-recovery-dom.mjs` uses the real modal and response reader with synthetic API boundaries in JSDOM. Seven groups cover history loading/error/retry; same-tick double submit; retained drafts; no automatic resend; history reconciliation; acknowledged exchanges; canceled/late history; fortune isolation; close/reopen during success/network failure; late POST completion on a previous fortune; and recovery controls outside the transcript scroller.
- Independent review reproduced interruption cases, found the long-transcript recovery placement issue and an overly confident absent-history notice, and reviewed their corrections.
- TypeScript and changed-file ESLint pass.
- The normal checksum-prepared build and existing 23 local API/DB integration checks pass. These use a disposable synthetic database and intercepted outbound calls; no real paid model call was made.
- The approved material CPU suite remains 10/10 passing. Art, model depth, day-branch pet mapping, all three universe views, auth, sharing, runtime environment, and schema are unchanged.

JSDOM does not establish real browser navigation, layout, touch behavior, or rendering. The existing cloud Chromium Unix-socket limitation remains; no screenshot or real hosted sign-in verification is claimed. Publication status is reported separately by its native deployment receipt. Prior private versions remain available for rollback.
