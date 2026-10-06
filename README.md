> **All selected source bytes are preserved; one original asset requires restoration after checkout.**
> `public/models/porcelain-hero-blink-v1.glb` is preserved losslessly as `preservation-archives/porcelain-hero-blink-v1.glb.gz` because the connector could not upload the original 13,700,928-byte binary directly and browser upload stalled. The runtime path is absent until you run `python3 scripts/restore-preserved-assets.py` from the repository. The script verifies both archive and original SHA-256 values and refuses to overwrite different content. This is not a ready-to-run checkout claim. Standalone B art has not been integrated into the runtime, and no new Site publication occurred.

# 사주도령 전체 비공개 테스트

Full original experience ported to Sites Workers: home, daily view, manse calculator, planet/avatar studio, saved fortunes and conversations, guin map creation/detail, and the retained material comparison lab.

## Privacy and persistence

- Owner-private Sites access remains enabled.
- Every stored record is scoped to the authenticated ChatGPT user ID. Anonymous API calls are rejected.
- This deployment starts with a new D1 database. Original JSON data, environment files and credentials were not imported.
- Normal fortune generation and conversation stay template-only. A separate /ai-test screen uses the owner-configured GEMINI_API_KEY secret for fixed fictional fixtures only, capped at six calls per UTC day. It never reads saved personal records; no credential is stored in source.
- Relationship scores remain visibly labeled arbitrary demo values. Precise solar-term and daewun work is incomplete; this is not a verified professional fortune service.

## Runtime

Vinext/React on Cloudflare Workers, D1 prepared SQL behind lib/db/store.ts, Drizzle schema-only migrations. No fs-based storage or runtime table creation. The original application source remains separately preserved.

## Checks

Run npm run build, then node scripts/integration-preview.mjs for local synthetic-data integration tests. Miniflare uses a fresh in-memory D1 database, explicit built ES modules and loopback-only transport. All Worker outbound requests are intercepted rather than sent externally. The harness checks template creation, persistence, chat, invalid inputs, anonymous rejection, cross-user isolation, concurrent friend additions, all page HTML and representative static assets. It also mocks Gemini to check fixed-fixture fact validation, rejection of extra personal-data fields, and the six-call daily cap. Current local integration result: 23 checks passed; this does not constitute a live Gemini test.

These checks do not validate browser WebGL, touch behavior, or hosted sign-in. The planet/avatar GLSL previously passed native EGL compilation/linkage; actual device appearance still needs feedback.

## Independent visual redesign (2026-10-03)
Replaced the benchmark marketplace homepage, fictitious prices/tickets and legacy persona with a personal-universe workspace, responsive four-destination navigation, ink/aqua/cool-white design tokens, and one generated conceptual cover illustration. The image is labeled as conceptual art, not a render of the live 3D scene. Working title remains 나의 우주 pending the owner’s brand selection. All existing routes and seven reading categories remain accessible. No payment, provider, quota or data-permission changes.

## Controlled material prototype (2026-10-03)
/lab now opens a 5-pair ten-stem real-PBR comparison on equal geometry, camera, lights and clock. Sphere and torus-knot surfaces are available; optional sphere-only vine/fire/dew geometry is clearly separate from the material-only test. This is not a finished customizable avatar, rig, seasonal scene or pet system. Original planet/avatar view is retained as a separate tab. The older avatar vertex-color attribute omission is repaired independently; its rejected design is not thereby approved. Reference image is the user-refined v2 concept. No AI provider, user records, sharing or billing changes.
