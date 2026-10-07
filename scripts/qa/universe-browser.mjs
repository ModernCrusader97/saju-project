import { Miniflare } from 'miniflare';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { evaluateJadeEvolution } from '../../assets/source-reference/saju-b-evolving-light-v002/runtime/saju-jade-evolution.mjs';

const root = process.cwd();
const output = path.join(root, 'outputs/universe-qa');
await fs.mkdir(output, { recursive: true });
const playwrightPath = process.env.SAJU_QA_PLAYWRIGHT_PATH || path.join(root, '.sites-runtime/browser-qa/node_modules/playwright-core/index.mjs');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const executablePath = process.env.SAJU_QA_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const checks = [], errors = [], outbound = [], metrics = [];
async function walk(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\.m?js$/.test(entry.name)) files.push(full);
  }
  return files;
}
const entry = path.join(root, 'dist/server/index.js');
const modules = [entry, ...(await walk(path.join(root, 'dist/server'))).filter(p => p !== entry)].map(p => ({ type: 'ESModule', path: p }));
const mf = new Miniflare({
  rootPath: root, modules, modulesRoot: 'dist/server', compatibilityDate: '2026-05-15',
  compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0, cf: false, logRequests: false,
  telemetry: { enabled: false }, d1Databases: { DB: 'universe-browser-fixtures' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('QA blocks outbound requests', { status: 502 }); },
});
let browser, qaPage, savedGalaxyPath;
let expectedNetworkFailure = false;
const owner = { 'oai-authenticated-user-id': 'universe-browser-fixture', 'oai-authenticated-user-email': 'qa@example.invalid' };
async function check(name, fn) {
  if (process.env.SAJU_QA_SECTION && !name.includes(process.env.SAJU_QA_SECTION)) return;
  const start = Date.now();
  await fn();
  checks.push({ name, ms: Date.now() - start });
  console.log('PASS: ' + name);
}
const init = () => {
  window.__sceneQa = [];
  window.__metrics = { cls: 0, lcp: 0 };
  try {
    new PerformanceObserver(list => { for (const event of list.getEntries()) if (!event.hadRecentInput) window.__metrics.cls += event.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => { for (const event of list.getEntries()) window.__metrics.lcp = event.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const context = original.call(this, type, ...args);
    if (context && /^webgl/.test(type) && !window.__sceneQa.some(record => record.gl === context)) {
      const record = { canvas: this, gl: context, draws: 0, losses: 0, points:new Set() };
      window.__sceneQa.push(record);
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const draw = context[method].bind(context);
        context[method] = (...parameters) => { record.draws++; if(method==='drawArrays'&&parameters[0]===context.POINTS)record.points.add(parameters[2]); return draw(...parameters); };
      }
      this.addEventListener('webglcontextlost', () => record.losses++);
    }
    return context;
  };
};
const picture = async page => page.evaluate(async () => {
  const source = document.querySelector('[data-scene="spirit"] canvas');
  const image = new Image(); image.src = source.toDataURL('image/png'); await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data, selected = [];
  for (let y = Math.floor(canvas.height * .24); y < canvas.height * .72; y += 4)
    for (let x = Math.floor(canvas.width * .2); x < canvas.width * .66; x += 4) {
      const i = (y * canvas.width + x) * 4; selected.push([pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]);
    }
  return selected;
});
async function waitScene(page, name) {
  try { await page.waitForSelector('[data-scene="' + name + '"][data-scene-state="ready"]', { timeout: 30000 }); }
  catch (error) { throw new Error(String(error) + '\n' + JSON.stringify(await page.evaluate(() => ({ url:location.href,text:document.body.innerText,scenes:[...document.querySelectorAll('[data-scene]')].map(el=>[el.dataset.scene,el.dataset.sceneState]) })))); }
  await page.waitForFunction(name => window.__sceneQa.some(r => r.canvas.closest('[data-scene="' + name + '"]') && r.draws > 0), name);
}
const sceneRaster = async (page, scene) => page.evaluate(async scene => {
  const source = document.querySelector('[data-scene="' + scene + '"] canvas');
  const image = new Image(); image.src = source.toDataURL('image/png'); await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image,0,0);
  const data = ctx.getImageData(0,0,canvas.width,canvas.height).data, colors=new Set();
  for(let i=0;i<data.length;i+=68)colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
  return { image:source.toDataURL('image/png'), colors:colors.size };
}, scene);
async function fit(page, width, scene) {
  await page.setViewportSize({ width, height: 920 }); await page.waitForTimeout(200);
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    small: [...document.querySelectorAll('button, .bottom-nav a, .universe-nav a, summary, input:not([type=checkbox]), select')].filter(el => {
      const b = el.getBoundingClientRect(), style = getComputedStyle(el);
      return b.width && b.height && style.visibility !== 'hidden' && style.display !== 'none' && !el.closest('details:not([open])') && (b.width < 43.5 || b.height < 43.5);
    }).map(el => ({ label: el.getAttribute('aria-label') || el.textContent.trim() || el.title, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
    bodySize: getComputedStyle(document.body).fontSize,
    tabs: [...document.querySelectorAll('.bottom-nav a')].map(el => el.textContent.trim()),
  }));
  assert(result.overflow <= 1, JSON.stringify({ width, scene, ...result }));
  assert.deepEqual(result.small, [], JSON.stringify({ width, scene, small: result.small }));
  assert.deepEqual(result.tabs, ['정령', '행성', '은하']);
  assert(Number.parseFloat(result.bodySize) >= 16);
  await page.screenshot({ path: path.join(output, scene + '-' + width + '.png'), fullPage: true });
  metrics.push({ scene, width, ...(await page.evaluate(() => window.__metrics)) });
}
try {
  const d1 = await mf.getD1Database('DB');
  for (const file of (await fs.readdir('drizzle')).filter(file => file.endsWith('.sql')).sort())
    for (const sql of (await fs.readFile('drizzle/' + file, 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await d1.prepare(sql.trim()).run();
  const origin = (await mf.ready).origin;
  console.log('LOCAL QA: ' + origin);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, extraHTTPHeaders: owner, acceptDownloads: true });
  await context.addInitScript(init);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.hostname); return route.abort();
  });
  const page = await context.newPage(); qaPage = page; page.setDefaultTimeout(20000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' && !expectedNetworkFailure) errors.push(msg.text()); });
  await page.goto(origin + (process.env.SAJU_QA_SECTION ? '/planet?view=spirit&name=Fixture%20One&y=2000&m=1&d=1&h=12&minute=30' : '/planet?view=spirit'), { waitUntil: 'networkidle' });
  await waitScene(page, 'spirit');
  await check('four responsive widths; 44px controls; 16px body; three tabs', async () => {
    for (const width of [1440, 768, 390, 320]) await fit(page, width, 'spirit');
  });
  await check('day animal and month background stay separate; mobile front/side composition', async () => {
    const initial=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('saju:universe:v1')));
    await page.setViewportSize({width:1440,height:920});
    await page.getByText('조합을 직접 둘러보기',{exact:true}).click();
    await page.getByLabel('정령과 동반자 · 일주',{exact:true}).selectOption('을축');await waitScene(page,'spirit');
    await page.locator('.identity-facts').getByText('일지 축 · 소',{exact:true}).waitFor();
    const backdrop=await page.locator('.spirit-stage').getAttribute('style');
    await page.getByLabel('배경 · 월령',{exact:true}).selectOption('경자');await waitScene(page,'spirit');
    await page.locator('.identity-facts').getByText('일지 축 · 소',{exact:true}).waitFor();
    assert.notEqual(await page.locator('.spirit-stage').getAttribute('style'),backdrop);
    await page.getByLabel('정령과 동반자 · 일주',{exact:true}).selectOption('을묘');await waitScene(page,'spirit');
    await page.locator('.identity-facts').getByText('일지 묘 · 토끼',{exact:true}).waitFor();
    await page.getByText('동물 펫은 임시 조형이며, 전용 동물 리소스는 준비 중이에요.',{exact:true}).waitFor();
    await page.getByLabel('정령과 동반자 · 일주',{exact:true}).selectOption(initial.dayKey);
    await page.getByLabel('배경 · 월령',{exact:true}).selectOption(initial.monthKey);await waitScene(page,'spirit');
    await page.getByRole('button',{name:'정령 움직임 일시정지',exact:true}).click();
    await page.getByRole('button',{name:'정령 정면과 움직임 초기화',exact:true}).click();
    for(const width of [390,320]){
      await page.setViewportSize({width,height:920});await page.locator('[data-scene="spirit"]').scrollIntoViewIfNeeded();
      await page.getByRole('button',{name:'정령 정면과 움직임 초기화',exact:true}).click();
      await page.screenshot({path:path.join(output,'spirit-depth-front-'+width+'.png'),fullPage:true});
      const box=await page.locator('[data-scene="spirit"] canvas').boundingBox(),x=box.x+box.width*.20,y=box.y+box.height*.48;
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+Math.PI/2/.009,y,{steps:12});await page.mouse.up();
      await page.screenshot({path:path.join(output,'spirit-depth-side-'+width+'.png'),fullPage:true});
    }
    await page.getByRole('button',{name:'정령 정면과 움직임 초기화',exact:true}).click();
    await page.getByRole('button',{name:'정령 움직임 재생',exact:true}).click();
  });
  await check('actual body emission changes locally; pause freezes its image', async () => {
    const before = await picture(page); await page.waitForTimeout(2800); const after = await picture(page);
    let rising = 0, falling = 0;
    before.forEach((a, i) => { const b = after[i]; if (a[3] > 200 && b[3] > 200 && Math.max(a[1] - a[0], b[1] - b[0]) > 15) { if (b[1] - a[1] > 5) rising++; if (a[1] - b[1] > 5) falling++; } });
    assert(rising > 5 && falling > 5, JSON.stringify({ rising, falling }));
    await page.getByRole('button', { name: '정령 움직임 일시정지' }).click();
    const still = await picture(page); await page.waitForTimeout(700); assert.deepEqual(await picture(page), still);
    checks.push({ name: 'body ROI evidence', risingPixels: rising, fallingPixels: falling });
  });
  await check('active scene unmounts; old GPU context and draws stop', async () => {
    await page.evaluate(() => { window.__oldScene = window.__sceneQa.find(r => r.canvas.closest('[data-scene="spirit"]')); });
    await page.getByRole('button', { name: '같은 나의 행성 보기' }).click(); await waitScene(page, 'planet');
    await page.waitForTimeout(100); const first = await page.evaluate(() => window.__oldScene.draws);
    await page.waitForTimeout(500);
    assert(await page.evaluate(draws => !window.__oldScene.canvas.isConnected && window.__oldScene.draws === draws && window.__oldScene.losses > 0, first));
    assert.equal(await page.locator('[data-scene] canvas').count(), 1);
    for (const width of [320, 390, 768, 1440]) await fit(page, width, 'planet');
  });
  await check('GPU RGB atlas, masks and strength-2 composition agree with v002 CPU reference', async () => {
    const glsl = await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/runtime/saju-jade-evolution.glsl', 'utf8');
    const positions = [[0,0,0],[1,1,1],[.13,.71,.41],[.52,.48,.07],[.9,.07,.93],[.25,.35,.65]];
    const samples = positions.flatMap(pos => [0,.75,2,3.2,4,5.6].map(seconds => ({ pos, seconds })));
    const rendered = await page.evaluate(async ({ glsl, samples }) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error('No WebGL2 for runtime atlas verification');
      const shader = (kind, source) => { const s = gl.createShader(kind); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const vs = shader(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}');
      const frag = '#version 300 es\nprecision highp float;\n#define SAJU_TEXTURE texture\n' + glsl + '\nuniform sampler2D uAtlas;uniform vec3 uPos;uniform float uSeconds;uniform int uMode;out vec4 color;void main(){SajuJadeEvolution e=sajuEvaluateJadeEvolution(uAtlas,uPos,uSeconds,false);vec3 v=uMode==0?e.fields:(uMode==1?vec3(e.emissionMask,e.isolationMask,e.reflectiveFraction):sajuComposeLinear(vec3(0.25,0.38,0.19),e)/2.0);color=vec4(v,1.0);}';
      const fs = shader(gl.FRAGMENT_SHADER, frag), program = gl.createProgram();
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const bitmap = await createImageBitmap(await (await fetch('/spirits/jade-v002/fields.png')).blob(), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bitmap); bitmap.close();
      const pos = gl.getUniformLocation(program, 'uPos'), time = gl.getUniformLocation(program, 'uSeconds'), mode = gl.getUniformLocation(program, 'uMode');
      const result = [];
      for (const sample of samples) {
        gl.uniform3fv(pos, sample.pos); gl.uniform1f(time, sample.seconds);
        for (let type = 0; type < 3; type++) { gl.uniform1i(mode, type); gl.drawArrays(gl.TRIANGLES, 0, 3); const pixel = new Uint8Array(4); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel); result.push({ sample, type, rgb: [...pixel].slice(0,3).map(v=>v/255) }); }
      }
      gl.deleteTexture(texture); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); gl.getExtension('WEBGL_lose_context')?.loseContext(); return result;
    }, { glsl, samples });
    const raw = new Uint8Array(await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/runtime/textures/jade_fields_atlas_128.rgba8'));
    let maximumError = 0;
    for (const result of rendered) {
      const expected = evaluateJadeEvolution(raw, result.sample.pos, result.sample.seconds, false);
      const rgb = result.type === 0 ? expected.fields : result.type === 1 ? [expected.emissionMask, expected.isolationMask, expected.reflectiveFraction] : [.25,.38,.19].map((v,i) => (v * expected.reflectiveFraction + expected.emissionRadiance[i])/2);
      result.rgb.forEach((value,i) => { maximumError = Math.max(maximumError, Math.abs(value - rgb[i])); assert(Math.abs(value - rgb[i]) <= 1.1/255, JSON.stringify({ result, rgb })); });
    }
    checks.push({ name: 'GPU numeric evidence', samples: rendered.length, maximumError, tolerance: 1.1/255 });
  });
  await check('repeat inputs; invalid date preserves result; history Back restores preceding result', async () => {
    for (const [label,value] of [['이름','Fixture One'],['연도','2000'],['월','1'],['일','1'],['시','12'],['분','30']]) await page.getByLabel('스튜디오 ' + label, { exact: true }).fill(value);
    await page.getByRole('button', { name: '내 사주 반영하기' }).click();
    const first = await page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')));
    assert.equal(first.birth.name, 'Fixture One'); assert.equal(first.source, 'calculated');
    await page.getByLabel('스튜디오 월', { exact: true }).fill('2'); await page.getByLabel('스튜디오 일', { exact: true }).fill('30');
    await page.getByRole('button', { name: '내 사주 반영하기' }).click();
    await page.getByRole('alert').waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1'))), first);
    await page.getByLabel('스튜디오 일', { exact: true }).fill('3'); await page.getByLabel('스튜디오 이름', { exact: true }).fill('Fixture Two');
    await page.getByRole('button', { name: '내 사주 반영하기' }).click();
    const second = await page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')));
    assert.equal(second.birth.name, 'Fixture Two'); assert.notEqual(second.dayKey, first.dayKey);
    await page.goBack(); await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')).birth.name === 'Fixture One');
    assert.equal(await page.getByLabel('스튜디오 월', { exact: true }).inputValue(), '1');
    await page.getByRole('button', { name: '같은 나의 정령 보기' }).click(); await waitScene(page, 'spirit');
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')).dayKey), first.dayKey);
  });
  await check('galaxy form keeps same birth; saved galaxy tab; readable cards and planet selection', async () => {
    const birth = await page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')).birth);
    await page.goto(origin + '/guin', { waitUntil: 'networkidle' });
    assert.equal(await page.getByLabel('은하 이름').inputValue(), birth.name);
    assert.equal(await page.getByLabel('은하 분', { exact: true }).inputValue(), birth.minute);
    await page.getByRole('button', { name: '귀인 지도 만들기' }).click(); await page.waitForURL(/\/guin\/[a-zA-Z0-9_-]+$/); await waitScene(page, 'galaxy');
    const mapPath = new URL(page.url()).pathname;
    savedGalaxyPath = mapPath;
    assert.equal(await page.evaluate(() => sessionStorage.getItem('saju:galaxy-path')), mapPath);
    const map = await (await page.request.get(origin + '/api' + mapPath)).json();
    const owner = map.guinMap.guins.find(person => person.isMe);
    const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')));
    assert.equal(owner.pillars.dayKey, state.dayKey); assert.equal(owner.pillars.monthKey, state.monthKey);
    await page.request.post(origin + '/api' + mapPath, { data: { friendName:'Fixture Friend',birthYear:1997,birthMonth:3,birthDay:10,birthHour:10,birthMinute:30,isUnknownTime:false } });
    await page.reload({ waitUntil: 'networkidle' }); await waitScene(page, 'galaxy');
    assert.equal(await page.locator('.relationship-card').count(), 2);
    await page.locator('.relationship-card').filter({ hasText: 'Fixture Friend' }).click();
    for (const width of [1440,768,390,320]) await fit(page, width, 'galaxy');
    await page.goto(origin + '/planet?view=planet', { waitUntil: 'networkidle' }); await waitScene(page, 'planet');
    assert.equal(await page.locator('.bottom-nav a').filter({ hasText:'은하' }).getAttribute('href'), mapPath);
    await page.getByLabel('스튜디오 시간 모름').check(); await page.getByRole('button', { name: '내 사주 반영하기' }).click();
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')).birth.unknown), true);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('saju:galaxy-path')), null);
    await page.getByText('시간을 몰라 위성은 쉬고 있어요.').waitFor();
  });
  await check('synchronized home input and Back/Forward keep only the matching galaxy', async () => {
    await page.goto(origin + '/planet?name=Fixture%20A&y=2000&m=1&d=1&h=12&minute=30', { waitUntil:'networkidle' });
    const a = await page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')));
    await page.goto(origin + '/guin', { waitUntil:'networkidle' });
    await page.getByRole('button',{name:'귀인 지도 만들기'}).click(); await page.waitForURL(/\/guin\/[a-zA-Z0-9_-]+$/);
    const pathA = new URL(page.url()).pathname;
    await page.goto(origin + '/', { waitUntil:'networkidle' });
    const homeRequests = [];
    const observeHome = request => { const url=new URL(request.url()); if(request.isNavigationRequest()&&url.pathname==='/planet')homeRequests.push(url); };
    page.on('request',observeHome);
    for (const [label,value] of [['이름 또는 별명','Fixture B'],['연도','2001'],['월','2'],['일','3'],['태어난 시각','9']]) await page.getByLabel(label,{exact:true}).fill(value);
    await page.getByRole('button',{name:'나의 우주 보기'}).click(); await page.waitForURL(/\/planet\?view=/);
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('saju:universe:v1'))?.birth.name === 'Fixture B');
    page.off('request',observeHome);
    assert(homeRequests.some(url=>url.searchParams.get('y')==='2001'&&url.searchParams.get('name')==='Fixture B'),'The legacy home request still sends birth query parameters');
    assert.equal(new URL(page.url()).searchParams.has('y'),false);
    checks.push({name:'Legacy home URL evidence',initialRequestContainsBirthQuery:true,clientReplacesQueryAfterHydration:true});
    const b = await page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')));
    assert.notEqual(a.dayKey,b.dayKey);
    assert.equal(await page.locator('.bottom-nav a').filter({hasText:'은하'}).getAttribute('href'),'/guin','Home B must not link to A');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('saju:galaxy-path')),null);
    await page.goBack(); await page.goBack(); await page.waitForURL(origin + pathA);
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('saju:universe:v1'))?.birth.name === 'Fixture A');
    assert.equal(await page.locator('.bottom-nav a').filter({hasText:'은하'}).getAttribute('href'),pathA);
    await page.goForward(); await page.goForward(); await page.waitForURL(/\/planet\?view=/);
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('saju:universe:v1'))?.birth.name === 'Fixture B');
    assert.equal(await page.locator('.bottom-nav a').filter({hasText:'은하'}).getAttribute('href'),'/guin');
    // Native history entries inside the workspace must reconcile the owner too.
    await page.getByLabel('스튜디오 이름',{exact:true}).fill(a.birth.name);
    for (const field of ['year','month','day','hour','minute']) {
      const label = {year:'연도',month:'월',day:'일',hour:'시',minute:'분'}[field];
      await page.getByLabel('스튜디오 '+label,{exact:true}).fill(a.birth[field]);
    }
    await page.getByRole('button',{name:'내 사주 반영하기'}).click();
    assert.equal(await page.locator('.bottom-nav a').filter({hasText:'은하'}).getAttribute('href'),pathA);
    await page.goBack(); await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('saju:universe:v1'))?.birth.name === 'Fixture B');
    assert.equal(await page.locator('.bottom-nav a').filter({hasText:'은하'}).getAttribute('href'),'/guin');
    await page.goForward(); await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('saju:universe:v1'))?.birth.name === 'Fixture A');
    assert.equal(await page.locator('.bottom-nav a').filter({hasText:'은하'}).getAttribute('href'),pathA);
  });
  await check('synchronized direct galaxy creation, cancelled/failed input and new-tab restoration', async () => {
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(origin + '/guin',{waitUntil:'networkidle'});
    const birthB = {name:'Fixture Direct B',year:'2002',month:'4',day:'5',hour:'6',minute:'17',unknown:false};
    for (const [field,label] of [['name','이름'],['year','연도'],['month','월'],['day','일'],['hour','시'],['minute','분']]) await page.getByLabel('은하 '+label,{exact:true}).fill(birthB[field]);
    await page.getByRole('button',{name:'귀인 지도 만들기'}).click(); await page.waitForURL(/\/guin\/[a-zA-Z0-9_-]+$/);
    const mapPath = new URL(page.url()).pathname;
    const map = (await (await page.request.get(origin + '/api' + mapPath)).json()).guinMap;
    const ownerPillars = map.guins.find(person=>person.isMe).pillars;
    const verify = async target => {
      await target.waitForFunction(() => JSON.parse(sessionStorage.getItem('saju:universe:v1'))?.birth.name === 'Fixture Direct B');
      const snapshot = await target.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')));
      assert.deepEqual(snapshot.birth,birthB); assert.equal(snapshot.source,'calculated');
      for (const field of ['dayKey','monthKey','yearKey','hourKey']) assert.equal(snapshot[field],ownerPillars[field]);
      // Creation writes the session before the new page's navigation hydrates.
      // Await the actual bound link, rather than asserting its initial /guin placeholder.
      await target.waitForFunction(path=>[...document.querySelectorAll('.bottom-nav a')].some(a=>a.getAttribute('href')===path),mapPath);
      assert.equal(await target.locator('.bottom-nav a').filter({hasText:'은하'}).getAttribute('href'),mapPath);
    };
    await verify(page);
    for (const mode of ['spirit','planet']) { await page.goto(origin+'/planet?view='+mode,{waitUntil:'networkidle'}); await verify(page); }
    await page.reload({waitUntil:'networkidle'}); await verify(page);
    const opened=page.waitForEvent('popup'); await page.evaluate(()=>window.open('/planet?view=spirit','_blank'));
    const restored=await opened; await restored.waitForLoadState('networkidle'); await verify(restored);
    await restored.reload({waitUntil:'networkidle'}); await verify(restored); await restored.close();
    await page.goto(origin+'/guin',{waitUntil:'networkidle'});
    await page.getByLabel('은하 이름').fill('Cancelled draft'); await page.getByLabel('은하 연도').fill('2003');
    await page.goto(origin+'/planet?view=spirit',{waitUntil:'networkidle'}); await verify(page);
    await page.goto(origin+'/guin',{waitUntil:'networkidle'});
    const before = await page.evaluate(()=>({snapshot:sessionStorage.getItem('saju:universe:v1'),path:sessionStorage.getItem('saju:galaxy-path'),owner:sessionStorage.getItem('saju:galaxy-owner:v1')}));
    await page.getByLabel('은하 이름').fill('Failed draft'); await page.getByLabel('은하 연도').fill('2003');
    await page.route('**/api/guin',route=>route.fulfill({status:503,json:{success:false,error:'Synthetic save failure'}}));
    expectedNetworkFailure = true;
    const failed=page.waitForEvent('dialog').then(dialog=>dialog.dismiss()); await page.getByRole('button',{name:'귀인 지도 만들기'}).click(); await failed;
    await page.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
    expectedNetworkFailure = false; await page.unroute('**/api/guin');
    assert.deepEqual(await page.evaluate(()=>({snapshot:sessionStorage.getItem('saju:universe:v1'),path:sessionStorage.getItem('saju:galaxy-path'),owner:sessionStorage.getItem('saju:galaxy-owner:v1')})),before);
    await page.getByLabel('은하 월').fill('2'); await page.getByLabel('은하 일').fill('30');
    const invalid=page.waitForEvent('dialog').then(dialog=>dialog.dismiss()); await page.getByRole('button',{name:'귀인 지도 만들기'}).click(); await invalid;
    assert.deepEqual(await page.evaluate(()=>({snapshot:sessionStorage.getItem('saju:universe:v1'),path:sessionStorage.getItem('saju:galaxy-path'),owner:sessionStorage.getItem('saju:galaxy-owner:v1')})),before);
    await page.goto(origin+'/planet?view=planet',{waitUntil:'networkidle'}); await verify(page);
    // Restore the original scene used by the remaining rendering checks.
    await page.getByLabel('스튜디오 시간 모름').check(); await page.getByRole('button',{name:'내 사주 반영하기'}).click(); await waitScene(page,'planet');
  });
  await check('context loss restores actual draws and changing pixels in all three scenes', async () => {
    let galaxyPath = savedGalaxyPath;
    if (!galaxyPath) {
      const result=await (await page.request.post(origin+'/api/guin',{data:{name:'Recovery Fixture',birthYear:2000,birthMonth:1,birthDay:1,birthHour:12,birthMinute:30,isUnknownTime:false}})).json();
      galaxyPath='/guin/'+result.guinMap.id;
    }
    for(const scene of ['spirit','planet','galaxy']) {
      await page.goto(origin+(scene==='galaxy'?galaxyPath:'/planet?view='+scene),{waitUntil:'networkidle'}); await waitScene(page,scene);
      await page.evaluate(scene => { window.__lostRecord=window.__sceneQa.find(r => r.canvas.closest('[data-scene="'+scene+'"]')); window.__lossExtension=window.__lostRecord.gl.getExtension('WEBGL_lose_context'); window.__lossExtension.loseContext(); },scene);
      await page.waitForSelector('[data-scene="'+scene+'"][data-scene-state="fallback"]');
      const stopped=await page.evaluate(()=>window.__lostRecord.draws); await page.waitForTimeout(300); assert.equal(await page.evaluate(()=>window.__lostRecord.draws),stopped);
      await page.evaluate(() => window.__lossExtension.restoreContext());
      await page.waitForSelector('[data-scene="'+scene+'"][data-scene-state="ready"]');
      await page.waitForFunction(stopped=>window.__lostRecord.draws>stopped+5,stopped);
      const first=await sceneRaster(page,scene); assert(first.colors>20,'Recovered '+scene+' must render varied pixels');
      await page.waitForTimeout(600); const second=await sceneRaster(page,scene); assert.notEqual(second.image,first.image,'Recovered '+scene+' must advance its visible frame');
      checks.push({name:'Context recovery pixel/draw evidence',scene,colors:second.colors,drawsAfterRecovery:(await page.evaluate(()=>window.__lostRecord.draws))-stopped});
      await page.screenshot({path:path.join(output,scene+'-restored.png'),fullPage:true});
    }
    await page.goto(origin+'/planet?view=planet',{waitUntil:'networkidle'}); await waitScene(page,'planet');
  });
  await check('default share image contains no birth date/time; existing close interaction', async () => {
    const birth=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('saju:universe:v1')).birth);
    await page.evaluate(() => { window.__shareText=[]; const original=CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.width===1080&&this.canvas.height===1920)window.__shareText.push(String(text));return original.call(this,text,...args);}; });
    await page.getByRole('button', { name: '이미지로 간직하기' }).click();
    await page.getByRole('dialog', { name:'우주 여권' }).waitFor();
    const texts = await page.locator('[role=dialog]').allTextContents();
    assert.equal(await page.locator('[role=dialog] img[src^="data:image/png"]').count(),1,'Share preview must contain the current rendered scene');
    assert(!texts.join(' ').includes(birth.year)); assert(!texts.join(' ').includes(`${birth.hour}:${birth.minute}`));
    const download=page.waitForEvent('download'); await page.getByRole('button',{name:'인스타 스토리용 9:16 카드 저장 (PNG)'}).click(); await (await download).saveAs(path.join(output,'default-share.png'));
    const rasterText=await page.evaluate(()=>window.__shareText); assert(rasterText.length>5); assert(!rasterText.join(' ').includes(birth.year)); assert(!rasterText.join(' ').includes(`${birth.hour}:${birth.minute}`));
    await page.keyboard.press('Escape');
  });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(outbound.length, 0, JSON.stringify(outbound));
  await check('reduced motion starts paused; WebGL unavailable keeps readable results', async () => {
    const reduced = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, extraHTTPHeaders:owner, reducedMotion:'reduce' });
    await reduced.addInitScript(init); const view=await reduced.newPage(); await view.goto(origin+'/planet?view=spirit',{waitUntil:'networkidle'}); await waitScene(view,'spirit');
    await view.getByRole('button',{name:'정령 움직임 재생'}).waitFor(); const before=await picture(view); await view.waitForTimeout(600); assert.deepEqual(await picture(view),before);
    const cdp=await reduced.newCDPSession(view); let box=await view.locator('[data-scene="spirit"] canvas').boundingBox();
    const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
    const x=box.x+box.width*.7,y=box.y+box.height*.75;
    await touch('touchStart',x,y); for(let step=1;step<=6;step++)await touch('touchMove',x,y-step*25); await touch('touchEnd',x,y-150); await view.waitForTimeout(200);
    assert(await view.evaluate(()=>window.scrollY>40),'Vertical scene gesture must scroll the page');
    await view.locator('[data-scene="spirit"]').scrollIntoViewIfNeeded(); await view.waitForTimeout(500);
    box=await view.locator('[data-scene="spirit"] canvas').boundingBox(); const original=await picture(view);
    const hx=box.x+box.width*.35,hy=Math.max(100,box.y+box.height*.4);
    await touch('touchStart',hx,hy); for(let step=1;step<=5;step++){await touch('touchMove',hx+step*16,hy);await view.waitForTimeout(40);} await touch('touchEnd',hx+80,hy); assert.notDeepEqual(await picture(view),original,'Horizontal scene gesture must rotate');
    if(savedGalaxyPath) {
      await view.goto(origin+savedGalaxyPath,{waitUntil:'networkidle'}); await waitScene(view,'galaxy');
      await view.getByRole('button',{name:'움직임 재생',exact:true}).waitFor();
      const galaxyStill=await sceneRaster(view,'galaxy'); await view.waitForTimeout(300); assert.equal((await sceneRaster(view,'galaxy')).image,galaxyStill.image,'Reduced-motion galaxy must be static before gestures');
      box=await view.locator('[data-scene="galaxy"] canvas').boundingBox();
      const gx=box.x+box.width*.6,gy=box.y+box.height*.6;
      await touch('touchStart',gx,gy); for(let step=1;step<=6;step++)await touch('touchMove',gx,gy-step*25); await touch('touchEnd',gx,gy-150); await view.waitForTimeout(200);
      assert(await view.evaluate(()=>window.scrollY>40),'Vertical galaxy gesture must scroll the page');
      await view.locator('[data-scene="galaxy"]').scrollIntoViewIfNeeded(); await view.waitForTimeout(500);
      box=await view.locator('[data-scene="galaxy"] canvas').boundingBox(); const rotatedBefore=await sceneRaster(view,'galaxy');
      const rx=box.x+box.width*.4,ry=Math.max(120,box.y+box.height*.45);
      await touch('touchStart',rx,ry); for(let step=1;step<=5;step++){await touch('touchMove',rx+step*16,ry);await view.waitForTimeout(40);} await touch('touchEnd',rx+80,ry);
      assert.notEqual((await sceneRaster(view,'galaxy')).image,rotatedBefore.image,'Horizontal galaxy gesture must rotate the rendered view');
      const zoomBefore=await sceneRaster(view,'galaxy');
      const pinch=(type,half)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:rx-half,y:ry,id:1},{x:rx+half,y:ry,id:2}]});
      await pinch('touchStart',20); for(let step=1;step<=5;step++){await pinch('touchMove',20+step*10);await view.waitForTimeout(40);} await pinch('touchEnd',70);
      assert.notEqual((await sceneRaster(view,'galaxy')).image,zoomBefore.image,'Galaxy pinch must change the rendered zoom');
      checks.push({name:'Mobile galaxy gesture evidence',verticalScroll:true,horizontalRotation:true,pinchZoom:true,pausedBaseline:true});
      const quality=await view.evaluate(()=>{const r=window.__sceneQa.find(r=>r.canvas.closest('[data-scene="galaxy"]'));return{points:[...r.points],ratio:r.gl.drawingBufferWidth/r.canvas.clientWidth,antialias:r.gl.getContextAttributes().antialias};});
      // The spiral renderer splits its 9,000 stars into 90% arm and 10% core draws.
      assert(quality.points.includes(8100)&&quality.points.includes(900),JSON.stringify(quality)); assert(quality.ratio<=1.26); assert.equal(quality.antialias,false);
      await view.screenshot({path:path.join(output,'galaxy-mobile-coarse.png'),fullPage:true}); checks.push({name:'Mobile quality evidence',...quality});
    }
    await reduced.close();
    const fallback=await browser.newContext({viewport:{width:320,height:844},extraHTTPHeaders:owner});
    await fallback.addInitScript(()=>{ const original=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:original.call(this,type,...args);}; });
    const noGl=await fallback.newPage(); await noGl.goto(origin+'/planet?view=spirit',{waitUntil:'networkidle'});
    await noGl.waitForSelector('[data-scene="spirit"][data-scene-state="fallback"]'); await noGl.getByText('실시간 3D를 사용할 수 없습니다.',{exact:false}).waitFor(); await noGl.getByRole('heading',{name:'을목 · 초록의 분신'}).waitFor();
    await noGl.screenshot({path:path.join(output,'webgl-fallback-320.png'),fullPage:true});
    await noGl.getByRole('button',{name:'같은 나의 행성 보기'}).click(); await noGl.waitForSelector('[data-scene="planet"][data-scene-state="fallback"]'); await noGl.getByText('일주 · 표면 70%',{exact:true}).waitFor();
    if(savedGalaxyPath){await noGl.goto(origin+savedGalaxyPath,{waitUntil:'networkidle'});await noGl.waitForSelector('[data-scene="galaxy"][data-scene-state="fallback"]');assert.equal(await noGl.locator('.relationship-card').count(),2);await noGl.locator('.scene-fallback-list button').filter({hasText:'Fixture Friend'}).click();await noGl.screenshot({path:path.join(output,'galaxy-webgl-fallback-320.png'),fullPage:true});}
    await fallback.close();
  });
  await context.close();
  console.log('BROWSER QA PASSED');
} catch (error) {
  if (qaPage && !qaPage.isClosed()) { await qaPage.screenshot({ path:path.join(output,'failure.png'),fullPage:true }).catch(()=>{}); await fs.writeFile(path.join(output,'failure-text.txt'),await qaPage.locator('body').innerText().catch(()=>'')); }
  errors.push(error.stack || String(error)); process.exitCode=1; console.error(error);
} finally {
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:process.exitCode?'FAIL':'PASS',checks,errors,outbound,metrics,limits:['Desktop Chrome with SwiftShader; no physical mobile GPU or touch device','Synthetic local identity and disposable D1; hosted login not exercised','Lab LCP/CLS only; no field INP or production Web Vitals claim','No deployment or audience changes']},null,2)+'\n');
  await browser?.close(); await mf.dispose();
}
