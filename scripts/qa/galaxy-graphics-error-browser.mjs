// Reuses the unchanged built-Worker regression runner, adding WebGL failure and
// trusted WEBGL_lose_context events only at browser boundaries.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const output = path.join(process.cwd(), 'outputs/galaxy-graphics-errors');
await fs.mkdir(output, { recursive: true });
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'exact inherited browser boundary: ' + before);
  return source.replace(before, after);
}
let source = await fs.readFile('scripts/qa/galaxy-background-browser.mjs', 'utf8');
source = replaceOnce(source, "'outputs/galaxy-resume'", "'outputs/galaxy-graphics-errors/browser'");
source = replaceOnce(source, 'const checks = [], observations = [], outbound = [], errors = [];',
  'const checks = [], observations = [], outbound = [], errors = [], consoleErrors = [];');
source = replaceOnce(source, 'let browser, browserVersion, origin, mapPath;',
  'let browser, browserVersion, origin, mapPath, fixtureData;');
source = replaceOnce(source, '  assert.equal(friend.status, 200);', `  assert.equal(friend.status, 200);
  // The real API deliberately creates random friend IDs and sample scores.
  // Pin only its disposable D1 fixture so separate before/after renders have
  // the same input seed, orbital placement and label text.
  const fixtureMap = (await friend.json()).guinMap;
  assert.equal(fixtureMap.guins.length, 2);
  fixtureMap.createdAt = '2026-10-10T00:00:00.000Z';
  Object.assign(fixtureMap.guins[1], { id: 'galaxy-graphics-synthetic-friend', affinityScore: 91,
    relationTitle: '체험용 예시 · 합성 친구' });
  const fixtureUpdate = await db.prepare('UPDATE guin_maps SET data=? WHERE id=?').bind(JSON.stringify(fixtureMap), fixtureMap.id).run();
  assert.equal(fixtureUpdate.meta.changes, 1);
  const fixtureReadback = await fetch(origin + '/api' + mapPath, { headers });
  assert.equal(fixtureReadback.status, 200);
  const observedFixture = (await fixtureReadback.json()).guinMap;
  assert.deepEqual(observedFixture.guins, fixtureMap.guins);
  fixtureData = { people: observedFixture.guins, createdAt: observedFixture.createdAt,
    persist: false, source: 'real API followed by an isolated synthetic D1 fixture update' };`);
source = replaceOnce(source, "async function view(width = 390, reducedMotion = 'no-preference') {",
  "async function view(width = 390, reducedMotion = 'no-preference', webglSupported = true) {");
source = replaceOnce(source, 'await context.addInitScript(init);', `await context.addInitScript(init);
  if (!webglSupported) await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /^webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });`);
source = replaceOnce(source, "page.on('pageerror', error => errors.push(error.message));",
  "page.on('pageerror', error => errors.push(error.message));\n  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });");
source = replaceOnce(source, `await page.waitForSelector('[data-scene="galaxy"][data-scene-state="ready"]');`,
  `await page.waitForSelector('[data-scene="galaxy"][data-scene-state="' + (webglSupported ? 'ready' : 'fallback') + '"]');`);
source = replaceOnce(source, 'await v.page.waitForTimeout(100); await v.step(16);', `await v.page.waitForFunction(expectedWidth => {
          const canvas = document.querySelector('[data-scene="galaxy"] canvas');
          return innerWidth === expectedWidth && canvas &&
            canvas.clientWidth === canvas.parentElement.clientWidth &&
            canvas.clientHeight === canvas.parentElement.clientHeight;
        }, width, { polling: 20 });
        await v.step(16);`);
source = replaceOnce(source,
  "  await check('browser errors and outbound requests remain empty', async () => { assert.deepEqual(errors, []); assert.deepEqual(outbound, []); });", `
  for (const width of [390, 1440]) await check('built WebGL unavailable fallback and person selection at ' + width + 'px', async () => {
    const v = await view(width, 'no-preference', false);
    try {
      const message = await v.page.locator('[data-scene="galaxy"] [role="status"] strong').textContent();
      assert.equal(message, '3D 화면을 사용할 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.');
      const people = await v.page.locator('.scene-fallback-list button').allTextContents();
      assert.deepEqual(people, ['합성 복귀 검증 (나)', '합성 복귀 친구']);
      await v.page.locator('.scene-fallback-list button').nth(1).evaluate(button => button.click());
      await v.page.locator('[title="4기둥 행성 슬롯 상세 보기"]').evaluate(button => button.click());
      assert.equal(await v.page.getByText('합성 복귀 친구님의 사주 행성 구성', { exact: true }).count(), 1);
      const state = await v.page.evaluate(() => ({ pendingFrames: window.__resumeQa.pendingCount,
        state: document.querySelector('[data-scene="galaxy"]').dataset.sceneState,
        contexts: window.__resumeQa.records.length, overflow: document.documentElement.scrollWidth - innerWidth }));
      assert.equal(state.pendingFrames, 0); assert.equal(state.contexts, 0); assert(state.overflow <= 1);
      observations.push({ scenario: 'WebGL unavailable', width, message, people, ...state });
      await v.page.screenshot({ path: path.join(output, 'fallback-' + width + '.png') });
    } finally { await v.close(); }
  });
  await check('trusted native WebGL loss and restore keep fallback and resume drawing', async () => {
    const v = await view();
    try {
      await v.step(16); const before = await v.snapshot(); assert(before.draws > 0);
      await v.page.evaluate(() => {
        const record = window.__resumeQa.records.find(record => record.canvas.closest('[data-scene="galaxy"]'));
        const extension = record.gl.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WEBGL_lose_context unavailable');
        record.contextLossExtension = extension;
        extension.loseContext();
      });
      await v.page.waitForSelector('[data-scene="galaxy"][data-scene-state="fallback"]');
      assert.equal(await v.page.locator('[data-scene="galaxy"] [role="status"] strong').textContent(),
        '3D 연결이 잠시 끊겼어요. 복구를 기다려주세요.');
      await v.step(16); const lost = await v.snapshot(); assert.equal(lost.draws, before.draws);
      await v.page.evaluate(() => {
        const record = window.__resumeQa.records.find(record => record.canvas.closest('[data-scene="galaxy"]'));
        record.contextLossExtension.restoreContext();
      });
      await v.page.waitForSelector('[data-scene="galaxy"][data-scene-state="ready"]');
      for (let i = 0; i < 6; i++) await v.step(16);
      const restored = await v.snapshot(); assert(restored.draws > before.draws);
      assert.equal(restored.pendingCount, 1); assert.equal(restored.ready, 'ready');
      const events = await v.page.evaluate(() => window.__resumeQa.events.filter(event => event.type === 'webglcontextlost'));
      assert(events.some(event => event.isTrusted));
      observations.push({ scenario: 'native context loss/restore', beforeDraws: before.draws, lostDraws: lost.draws,
        restoredDraws: restored.draws, pendingFrames: restored.pendingCount, events });
      await fs.writeFile(path.join(output, 'context-restored.png'), Buffer.from(restored.image.split(',')[1], 'base64'));
    } finally { await v.close(); }
  });
  await check('browser errors and outbound requests remain empty', async () => {
    assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
    assert.equal(consoleErrors.length, 2);
    assert(consoleErrors.every(message => message === 'THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.'));
  });`);
source = replaceOnce(source, 'checks, observations, errors, outbound,',
  'checks, observations, errors, outbound, consoleErrors, fixtureData, applicationSourceSHA256: sha(await fs.readFile(path.join(root, "components/planet/GalaxyCanvas.tsx"))),');
const fixture = path.join(output, 'graphics-browser-fixture.mjs');
await fs.writeFile(fixture, source);
await import(pathToFileURL(fixture).href);
