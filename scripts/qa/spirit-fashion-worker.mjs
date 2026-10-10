// Exact local production Worker and assets. Disposable synthetic D1 only.
// The controlled rAF clock skips intermediate GPU draws; captured frames draw natively.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = process.cwd(), output = path.join(root, 'outputs/spirit-fashion/worker'); await fs.mkdir(output, { recursive: true });
// Keep failed attempts as evidence when the QA itself needs a correction.
try {
  const previous = JSON.parse(await fs.readFile(path.join(output, 'report.json'), 'utf8'));
  if (previous.status !== 'PASS') await fs.copyFile(path.join(output, 'report.json'), path.join(output, 'failed-' + Date.now() + '.json'));
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), entry = path.join(root, 'dist/server/index.js');
const builtWorkerSHA256 = sha(await fs.readFile(entry)), baseline = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const qaHarnessSHA256 = sha(await fs.readFile(new URL(import.meta.url)));
const runtimeFiles = ['app/planet/page.tsx', 'components/planet/ElementalSpiritCanvas.tsx', 'components/planet/SpiritFashionPanel.tsx',
  'hooks/use-spirit-fashion.ts', 'lib/planet/approved-jade-spirit.ts', 'lib/planet/elemental-spirit.ts', 'lib/planet/spirit-fashion.ts',
  'lib/planet/fashion-surface-projector.ts', 'lib/planet/spirit-fashion-catalog.ts', 'lib/planet/spirit-fashion-storage.ts', 'lib/planet/scene-environment.ts'];
const sourceHashes = Object.fromEntries(await Promise.all(runtimeFiles.map(async file => [file, sha(await fs.readFile(file))])));
const expected = { position: 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b',
  normal: '80706bee870329a0829113e63ed178f0a904029265da2c96c69ad50f9b1f9cec',
  uv: 'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c', index: '934286d3bdd9361657e390c41762923871cec85a48a7d9775b362aee02dc7830',
  morphPosition: '7bf926ae1fd903a4a63d39b32c3c1cdafdcd30bc982138404f38b75f50c4dfde',
  morphNormal: 'cf790aaebf3c4a41cbed597f93c53a82f4ba43f726c178d9504bc30dffd1ffbd' };
const bodySHA256 = '0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84';
assert.equal(sha(await fs.readFile('dist/client/spirits/jade-v002/body.glb')), bodySHA256);
const require = createRequire(path.join(root, 'package.json')), { Miniflare } = require('miniflare');
const { RoomEnvironment } = await import(pathToFileURL(require.resolve('three/addons/environments/RoomEnvironment.js')).href);
const referenceRoom = new RoomEnvironment(), roomBoxes = referenceRoom.children.find(object => object.isInstancedMesh);
const roomMatrixReference = { floatCount: roomBoxes.instanceMatrix.array.length, byteLength: roomBoxes.instanceMatrix.array.byteLength,
  sha256: sha(new Uint8Array(roomBoxes.instanceMatrix.array.buffer)), installedRoomSourceSHA256: sha(await fs.readFile(require.resolve('three/addons/environments/RoomEnvironment.js'))) };
assert.equal(roomMatrixReference.floatCount, 96); assert.equal(roomMatrixReference.byteLength, 384);
roomBoxes.dispose(); referenceRoom.dispose();
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const report = { status: 'RUNNING', baseline, builtWorkerSHA256, qaHarnessSHA256, sourceHashes, bodySHA256, roomMatrixReference, checks: [], cases: [], motion: [], images: [], errors: [], outbound: [],
  timingDefinition: { budgetMs: 300, metric: 'fashion.set wall time minus disjoint harness-added getError/isBuffer call intervals',
    rawInstrumentedBudgetPassed: false, diagnosticControlHarnessSHA256: '02ed5cdfe215620e6971bd630c98207742ccdc9ecf5bd95ddc8219a28dc18216',
    note: 'Bounded exact-Worker control measured 5.6–8.6ms when both added query kinds were disabled only inside set. The full matrix retains every query and records raw, probe and exclusive times; it does not claim a raw300 or physical-device result.' },
  limits: ['Exact local production Worker and dist/client; isolated synthetic D1 and synthetic request headers, no real users or hosted authentication.',
    'Synthetic rAF/performance clock, actual selected native WebGL draws; intermediate frames update motion/effects without GPU draws.',
    'Chromium SwiftShader; no physical device/GPU or full cloth/flame collision simulation.', 'Integrated local Worker verification; final deployment is verified separately.'] };
const assets = new Map(), bodyResponses = new Set(), pendingAssets = [];
const headers = { 'oai-authenticated-user-id': 'fashion-worker-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid' };
const outfit = { head: 'sprout-pin', face: 'round-sunglasses', neck: 'ribbon-bow', back: 'leaf-brooch' };
async function walk(dir) { const files = []; for (const item of await fs.readdir(dir, { withFileTypes: true })) { const file = path.join(dir, item.name); if (item.isDirectory()) files.push(...await walk(file)); else if (/\.m?js$/.test(file)) files.push(file); } return files; }
async function check(name, run) { console.log('RUN ' + name); try { await run(); report.checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); } catch (error) { report.checks.push({ name, status: 'FAIL', error: error.stack }); throw error; } }

function initializeClock() {
  const wallNow = performance.now.bind(performance);
  let now = 1000, sequence = 0, drawEnabled = true; const pending = new Map(), records = [];
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  window.requestAnimationFrame = callback => { const id = ++sequence; pending.set(id, callback); return id; }; window.cancelAnimationFrame = id => pending.delete(id);
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const gl = getContext.call(this, type, ...args);
    if (gl && /^webgl/.test(type) && !records.some(record => record.gl === gl)) {
      const record = { gl, canvas: this, buffers: new Set(), bufferOrigins: new Map(), bufferRows: new Map(), losses: [], contextGeneration: 0,
        created: 0, deleted: 0, draws: 0, skipped: 0, nativeBody: [], bodyPasses: [], blendedPasses: [], accessoryPasses: [], facePasses: [], errors: [], qaProbeMs: 0, qaProbes: {}, qaProbeDepth: 0, nestedProbeCalls: 0 }; records.push(record);
      const probe = (name, run) => { if (record.qaProbeDepth++) record.nestedProbeCalls++; const start = wallNow(); try { return run(); } finally { const ms = wallNow() - start; record.qaProbeDepth--;
        record.qaProbeMs += ms; const details = record.qaProbes[name] ??= { calls: 0, ms: 0 }; details.calls++; details.ms += ms; } };
      const captureError = method => { const error = probe('getError:' + method, () => gl.getError()); if (error && error !== gl.CONTEXT_LOST_WEBGL) record.errors.push({ method, error }); };
      const create = gl.createBuffer.bind(gl), remove = gl.deleteBuffer.bind(gl), nativeIsBuffer = gl.isBuffer.bind(gl), boundBuffers = new Map();
      const isBuffer = buffer => probe('isBuffer', () => nativeIsBuffer(buffer));
      const bind = gl.bindBuffer.bind(gl), upload = gl.bufferData.bind(gl);
      gl.createBuffer = (...values) => { const buffer = create(...values); if (buffer) { const stack = new Error('GPU buffer creation before PMREM/body').stack;
        record.buffers.add(buffer); record.bufferOrigins.set(buffer, stack); record.created++;
        record.bufferRows.set(buffer, { id: record.created, buffer, contextGeneration: record.contextGeneration, byteLength: 0, creationStack: stack, uploads: [], deletes: [] }); } return buffer; };
      gl.bindBuffer = (target, buffer) => { const result = bind(target, buffer); boundBuffers.set(target, buffer); return result; };
      gl.bufferData = (target, data, usage, ...rest) => { const result = upload(target, data, usage, ...rest), row = record.bufferRows.get(boundBuffers.get(target));
        if (row) { row.byteLength = typeof data === 'number' ? data : rest[1] !== undefined ? rest[1] * data.BYTES_PER_ELEMENT : data.byteLength - (rest[0] ?? 0) * (data.BYTES_PER_ELEMENT ?? 1);
          row.uploads.push({ target, usage, type: data?.constructor?.name ?? typeof data, byteLength: row.byteLength,
            floatCount: data instanceof Float32Array ? data.length : null, values: data instanceof Float32Array && data.length === 96 ? [...data] : null,
            nativeLiveAfterUpload: isBuffer(row.buffer), contextGeneration: record.contextGeneration }); } return result; };
      gl.deleteBuffer = buffer => { captureError('before deleteBuffer'); const row = record.bufferRows.get(buffer), lost = gl.isContextLost(), before = lost ? null : isBuffer(buffer);
        const result = remove(buffer), after = lost ? null : isBuffer(buffer); captureError('deleteBuffer');
        if (row) row.deletes.push({ whileContextLost: lost, nativeLiveBefore: before, nativeLiveAfter: after, explicitNativeDelete: !lost && before === true && after === false,
          contextGeneration: record.contextGeneration, stack: new Error('Native deleteBuffer owner').stack });
        if (record.buffers.delete(buffer)) { record.deleted++; record.bufferOrigins.delete(buffer); } return result; };
      const getExtension = gl.getExtension.bind(gl), wrappedLosses = new WeakSet();
      gl.getExtension = name => { const extension = getExtension(name); if (name === 'WEBGL_lose_context' && extension && !wrappedLosses.has(extension)) {
        const lose = extension.loseContext.bind(extension); extension.loseContext = () => { captureError('before forced context loss');
          const rows = [...record.bufferRows.values()].filter(row => row.contextGeneration === record.contextGeneration), alive = rows.filter(row => isBuffer(row.buffer));
          record.losses.push({ reason: record.nextLossReason ?? 'normal-retirement', contextGeneration: record.contextGeneration, created: rows.length,
            explicitDeleted: rows.filter(row => row.deletes.some(deletion => deletion.explicitNativeDelete)).length,
            nativeAlive: alive.map(row => ({ id: row.id, byteLength: row.byteLength })), nativeAliveBytes: alive.reduce((sum, row) => sum + row.byteLength, 0) });
          record.nextLossReason = undefined; return lose(); }; wrappedLosses.add(extension); } return extension; };
      record.lifecycle = async () => { const rows = [...record.bufferRows.values()].filter(row => row.contextGeneration === record.contextGeneration), alive = rows.filter(row => isBuffer(row.buffer));
        const candidates = []; for (const row of rows) for (const upload of row.uploads) if (upload.values) {
          const bytes = new Uint8Array(new Float32Array(upload.values).buffer), digest = await crypto.subtle.digest('SHA-256', bytes);
          const details = { ...upload }; delete details.values; candidates.push({ ...details, id: row.id,
            sha256: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join(''), creationStack: row.creationStack, deletes: row.deletes }); }
        return { contextGeneration: record.contextGeneration, contextLost: gl.isContextLost(), created: rows.length,
          explicitDeleted: rows.filter(row => row.deletes.some(deletion => deletion.explicitNativeDelete)).length,
          nativeAlive: alive.map(row => ({ id: row.id, byteLength: row.byteLength })), nativeAliveBytes: alive.reduce((sum, row) => sum + row.byteLength, 0), roomCandidates: candidates, losses: record.losses }; };
      for (const method of ['deleteFramebuffer', 'deleteRenderbuffer', 'deleteTexture', 'deleteVertexArray', 'deleteProgram']) {
        const remove = gl[method].bind(gl); gl[method] = value => { const result = remove(value); captureError(method); return result; };
      }
      const programs = new Map(), fragmentSources = new WeakMap(), programFragments = new WeakMap(); let active;
      const shaderSource = gl.shaderSource.bind(gl); gl.shaderSource = (shader, source) => {
        if (gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER) fragmentSources.set(shader, source);
        return shaderSource(shader, source);
      };
      const attachShader = gl.attachShader.bind(gl); gl.attachShader = (program, shader) => {
        const source = fragmentSources.get(shader); if (source) programFragments.set(program, source); return attachShader(program, shader);
      };
      const getLocation = gl.getUniformLocation.bind(gl); gl.getUniformLocation = (program, name) => { const location = getLocation(program, name); if (location) {
        const uniforms = programs.get(program) || {}; if (['modelMatrix', 'uStemCoordinateDensity', 'uSajuFields'].includes(name)) uniforms[name] = location;
        if (/^morphTargetInfluences(?:\[0\])?$/.test(name)) uniforms.morph = location; programs.set(program, uniforms);
      } return location; };
      const nativeUseProgram = gl.useProgram.bind(gl); gl.useProgram = program => { active = program; return nativeUseProgram(program); };
      this.addEventListener('webglcontextlost', () => { programs.clear(); boundBuffers.clear(); active = undefined; }, true);
      this.addEventListener('webglcontextrestored', () => { record.contextGeneration++; }, true);
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const draw = gl[method].bind(gl); gl[method] = (...values) => {
          if (!drawEnabled) { record.skipped++; return; }
          const uniforms = programs.get(active); if (uniforms?.modelMatrix && (uniforms.uStemCoordinateDensity || uniforms.uSajuFields)) {
            const weights = uniforms.morph ? gl.getUniform(active, uniforms.morph) : null;
            record.nativeBody.push({ matrix: [...gl.getUniform(active, uniforms.modelMatrix)], morph: weights === null ? null : typeof weights === 'number' ? [weights] : [...weights], live: gl.isProgram(active), current: gl.getParameter(gl.CURRENT_PROGRAM) === active,
              canvas: gl.getParameter(gl.FRAMEBUFFER_BINDING) === null, premultipliedAlpha: /^#define\s+PREMULTIPLIED_ALPHA(?:\s|$)/m.test(programFragments.get(active) || '') });
          }
          record.draws++; const result = draw(...values); captureError(method); return result;
        };
      }
      const clear = gl.clear.bind(gl); gl.clear = (...values) => { if (drawEnabled) return clear(...values); };
    }
    return gl;
  };
  window.fashionWorkerQA = { records, pending, wallNow,
    step(delta, draw = true) { now += delta; drawEnabled = draw; records.forEach(record => { record.nativeBody = []; record.bodyPasses = []; record.blendedPasses = []; record.accessoryPasses = []; record.facePasses = []; }); const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(now)); drawEnabled = true; },
    advance(count, delta) { for (let i = 0; i < count; i++) this.step(delta, i === count - 1); },
  };
}
function bindView() {
  const canvas = document.querySelector('[data-scene="spirit"] canvas');
  for (let element = canvas; element; element = element.parentElement) {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = key && element[key]; fiber; fiber = fiber.return) {
      const refs = []; for (let hook = fiber.memoizedState; hook && typeof hook === 'object'; hook = hook.next) if (hook.memoizedState && Object.hasOwn(hook.memoizedState, 'current')) refs.push(hook.memoizedState);
      const spirit = refs.find(ref => ref.current?.bodyMesh && ref.current?.fashion)?.current, renderer = refs.find(ref => ref.current?.isWebGLRenderer)?.current;
      if (!spirit || !renderer) continue; const index = refs.findIndex(ref => typeof ref.current === 'function'), timeRef = refs[index + 1], renderRef = refs[index];
      if (!timeRef || typeof timeRef.current !== 'number') throw new Error('Actual Canvas motion ref unavailable');
      const record = window.fashionWorkerQA.records.find(record => record.canvas === renderer.domElement); record.spirit = true;
      if (!record.renderObserved) {
        const renderBufferDirect = renderer.renderBufferDirect.bind(renderer);
        renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
          // The production material callback has run before this entry point.
          const pass = { target: renderer.getRenderTarget() === null ? 'canvas' : 'offscreen', premultipliedAlpha: material.premultipliedAlpha,
            transmission: material.transmission ?? 0, blending: material.blending, side: material.side };
          if (object === spirit.bodyMesh && material === spirit.bodyMesh.material) record.bodyPasses.push(pass);
          if (material.type === 'ShadowMaterial') record.blendedPasses.push({ kind: 'ground', ...pass });
          else if (['병', '정'].includes(spirit.mapping.bodyStem) && object.isInstancedMesh && material.type === 'ShaderMaterial') record.blendedPasses.push({ kind: 'fire', ...pass });
          if (material.name?.startsWith('fashion')) record.accessoryPasses.push({ name: material.name, ...pass });
          if (/almond_gaze|small_eye_glint|expressive_brow|quiet_smile/.test(object.name) && [object.material].flat().includes(material))
            record.facePasses.push({name:object.name,transparent:material.transparent,opacity:material.opacity,depthWrite:material.depthWrite,
              forceSinglePass:material.forceSinglePass,castShadow:object.castShadow,receiveShadow:object.receiveShadow,...pass});
          return renderBufferDirect(camera, scene, geometry, material, object, group);
        };
        record.renderObserved = true;
      }
      if (!spirit.fashion.qaSetTimings) {
        spirit.fashion.qaSetTimings = [];
        const set = spirit.fashion.set;
        spirit.fashion.set = selection => { const before = record.qaProbeMs, beforeNested = record.nestedProbeCalls, probes = structuredClone(record.qaProbes), start = window.fashionWorkerQA.wallNow(); set(selection);
          const ms = window.fashionWorkerQA.wallNow() - start, probeMs = record.qaProbeMs - before;
          const probeDetails = Object.fromEntries(Object.entries(record.qaProbes).map(([name, value]) => [name, { calls: value.calls - (probes[name]?.calls ?? 0), ms: value.ms - (probes[name]?.ms ?? 0) }]).filter(([, value]) => value.calls));
          spirit.fashion.qaSetTimings.push({ selection: { ...spirit.fashion.selection }, ms, qaProbeMs: probeMs, excludingQAProbeMs: ms - probeMs, nestedProbeCalls: record.nestedProbeCalls - beforeNested, probeDetails }); };
      }
      window.fashionWorkerQA.view = { spirit, renderer, timeRef, renderRef, record }; return spirit.mapping.bodyStem;
    }
  }
  return null;
}
async function snapshot() {
  const { spirit, renderer, timeRef, record } = window.fashionWorkerQA.view, body = spirit.bodyMesh, geometry = body.geometry, fashion = spirit.fashion, owner = fashion.group.parent;
  const hash = async array => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(array.buffer, array.byteOffset, array.byteLength)))].map(value => value.toString(16).padStart(2, '0')).join('');
  const gl = renderer.getContext(), pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const effects = [], effectMeshes = []; spirit.propGroup.traverse(object => { if (object.isInstancedMesh) effectMeshes.push(object); });
  for (const mesh of effectMeshes) effects.push({ name: mesh.name, count: mesh.count, matrix: await hash(mesh.instanceMatrix.array), particles: mesh.geometry.hasAttribute('aParticle') ? await hash(mesh.geometry.getAttribute('aParticle').array) : null });
  let maxSupportError = 0, minNormalDot = 1; const supports = [];
  for (const item of fashion.group.children) {
    const s = item.userData.support, v = [0, 1, 2].map(j => body.getVertexPosition(geometry.index.getX(s.triangle * 3 + j), body.position.clone()));
    const actual = v.reduce((sum, p, j) => sum.addScaledVector(p, s.barycentric[j]), body.position.clone().set(0, 0, 0)).applyMatrix4(body.matrixWorld);
    const published = body.position.clone().fromArray(s.position).applyMatrix4(fashion.group.matrixWorld);
    const normal = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize().applyNormalMatrix(body.normalMatrix.clone().getNormalMatrix(body.matrixWorld));
    maxSupportError = Math.max(maxSupportError, actual.distanceTo(published)); minNormalDot = Math.min(minNormalDot, body.position.clone().set(0, 0, 1).transformDirection(item.matrixWorld).dot(normal));
    supports.push({ id: item.userData.fashionItemId, triangle: s.triangle, world: item.getWorldPosition(body.position.clone()).toArray() });
  }
  const key = spirit.group.parent.children.find(object => object.isDirectionalLight && object.castShadow);
  return { time: timeRef.current, stem: spirit.mapping.bodyStem, pixels: await hash(pixels), depth: spirit.avatarPivot.scale.z, modelPosition: spirit.avatarPivot.position.toArray(),
    attributes: { position: await hash(geometry.attributes.position.array), normal: await hash(geometry.attributes.normal.array), uv: await hash(geometry.attributes.uv.array), index: await hash(geometry.index.array), morphPosition: await hash(geometry.morphAttributes.position[0].array), morphNormal: await hash(geometry.morphAttributes.normal[0].array) },
    selection: fashion.selection, itemCount: fashion.group.children.length, quality: fashion.group.userData.diagnostics.quality, owner: owner.name, effectsShareOwner: spirit.propGroup.parent === owner,
    maxSupportError, minNormalDot, supports, exclusions: owner.userData.surfaceAttachmentExclusions, regionCenters: owner.userData.surfaceAttachmentExclusions.map(r => body.position.clone().fromArray(r.min).add(body.position.clone().fromArray(r.max)).multiplyScalar(.5).applyMatrix4(owner.matrixWorld).toArray()),
    morph: [...body.morphTargetInfluences], eyeScale: [spirit.eyeLeft.scale.y, spirit.eyeRight.scale.y],
    setTimings: [...fashion.qaSetTimings], bodyMatrix: body.matrixWorld.toArray(), native: record.nativeBody.at(-1), effects, glError: gl.getError(), glErrors: [...record.errors],
    alpha: { context: gl.getContextAttributes().alpha, premultipliedContext: gl.getContextAttributes().premultipliedAlpha,
      bodyTransmission: body.material.transmission ?? 0, bodyPremultiplied: body.material.premultipliedAlpha,
      bodyPasses: [...record.bodyPasses], blendedPasses: [...record.blendedPasses], accessoryPasses: [...record.accessoryPasses],facePasses:[...record.facePasses] },
    memory: { ...renderer.info.memory }, buffers: record.buffers.size, draws: record.draws, shadowSize: key.shadow.mapSize.toArray(), bufferLifecycle: await record.lifecycle(),
    retired: await Promise.all(window.fashionWorkerQA.records.filter(row => row.spirit && row !== record).map(async row => ({ connected: row.canvas.isConnected, contextLost: row.gl.isContextLost(), buffers: row.buffers.size, created: row.created, deleted: row.deleted, errors: row.errors,
      lifecycle: await row.lifecycle(), remainingBuffers: [...row.buffers].map(buffer => ({ origin: row.bufferOrigins.get(buffer), nativeLive: row.gl.isBuffer(buffer) })) }))) };
}
function validRoomMatrix(lifecycle) {
  const matches = lifecycle.roomCandidates.filter(upload => upload.sha256 === roomMatrixReference.sha256 && upload.contextGeneration === lifecycle.contextGeneration);
  assert.equal(matches.length, 1, 'One actual source-matching Room instance matrix per context generation');
  const room = matches[0]; assert.equal(room.type, 'Float32Array'); assert.equal(room.floatCount, 96); assert.equal(room.byteLength, 384);
  assert(room.nativeLiveAfterUpload); assert.equal(room.deletes.length, 1); assert(room.deletes[0].explicitNativeDelete);
  assert.equal(room.deletes[0].whileContextLost, false); assert.equal(room.deletes[0].nativeLiveBefore, true); assert.equal(room.deletes[0].nativeLiveAfter, false);
}
function validNormalRetirement(lifecycle) {
  assert(lifecycle.contextLost); assert.equal(lifecycle.nativeAlive.length, 0); assert.equal(lifecycle.nativeAliveBytes, 0);
  const boundaries = lifecycle.losses.filter(loss => loss.reason === 'normal-retirement' && loss.contextGeneration === lifecycle.contextGeneration);
  assert.equal(boundaries.length, 1); const boundary = boundaries[0];
  assert.equal(boundary.nativeAlive.length, 0, 'Explicit deletion must occur before forced context loss');
  assert.equal(boundary.nativeAliveBytes, 0); assert.equal(boundary.created, boundary.explicitDeleted);
  assert.equal(lifecycle.created, lifecycle.explicitDeleted); validRoomMatrix(lifecycle);
}
function valid(state, day, quality) {
  report.lastState = state;
  assert.equal(state.stem, day[0]); assert.equal(state.quality, quality); assert.equal(state.depth, 1.35); assert.deepEqual(state.modelPosition, [-.42, 0, 0]); assert.deepEqual(state.attributes, expected);
  assert.equal(state.owner, 'ApprovedSpiritMotion'); assert(state.effectsShareOwner); assert(state.maxSupportError < 1e-7 && state.minNormalDot > .99999);
  assert(state.morph[0] >= 0 && state.morph[0] <= .45); assert.equal(state.glError, 0); assert.deepEqual(state.glErrors, []); assert.deepEqual(state.shadowSize, quality === 'high' ? [1024, 1024] : [512, 512]);
  assert(state.native?.live && state.native.current, 'Actual native body draw required'); state.native.matrix.forEach((value, i) => assert(Math.abs(value - state.bodyMatrix[i]) < 2e-6));
  assert(state.alpha.context && state.alpha.premultipliedContext);
  assert.equal(state.alpha.bodyPremultiplied, state.alpha.bodyTransmission > 0);
  if (['임','계'].includes(day[0])) {
    assert.equal(state.alpha.facePasses.length,7,'Every original water facial marker draws once after transmission');
    assert(state.alpha.facePasses.every(p=>p.target==='canvas'&&p.transparent&&p.opacity===1&&p.depthWrite&&p.forceSinglePass&&p.castShadow&&!p.receiveShadow),
      'Original water face shapes/shadows remain and never enter their own refraction target, including dressed wave frames');
  }
  assert(state.alpha.bodyPasses.some(pass => pass.target === 'canvas'));
  for (const pass of state.alpha.bodyPasses) assert.equal(pass.premultipliedAlpha, pass.transmission > 0 && pass.target === 'canvas');
  for (const pass of state.alpha.blendedPasses) { assert.equal(pass.premultipliedAlpha, false); assert.equal(pass.blending, 1); }
  for (const pass of state.alpha.accessoryPasses) { assert.equal(pass.transmission, 0); assert.equal(pass.premultipliedAlpha, false); }
  assert(state.native.canvas); assert.equal(state.native.premultipliedAlpha, state.alpha.bodyTransmission > 0, 'Linked native body fragment shader matches the final canvas alpha convention');
  assert(state.native.morph); state.native.morph.forEach((value, i) => assert(Math.abs(value - state.morph[i]) < 1e-7));
  assert(state.setTimings.every(sample => sample.nestedProbeCalls === 0 && sample.excludingQAProbeMs >= 0 && sample.excludingQAProbeMs < 300),
    'Each actual UI item update meets the 300ms QA-host CPU-work budget excluding disjoint added native queries: ' + JSON.stringify(state.setTimings));
  validRoomMatrix(state.bufferLifecycle);
  for (const retired of state.retired) { assert(!retired.connected && retired.contextLost); assert.equal(retired.buffers, 0, JSON.stringify(retired)); assert.equal(retired.created, retired.deleted); assert.deepEqual(retired.errors, []); validNormalRetirement(retired.lifecycle); }
}
const button = (page, name) => page.getByRole('button', { name, exact: true }).evaluate(element => element.click());
async function ready(page, day) { for (let i = 0; i < 240; i++) { await page.evaluate(() => window.fashionWorkerQA.step(0)); const stem = await page.evaluate(bindView); if (stem === day[0] && await page.locator('[data-scene="spirit"][data-scene-state="ready"]').count()) { await page.locator('[data-scene="spirit"] canvas').scrollIntoViewIfNeeded(); await page.waitForTimeout(80); await page.evaluate(() => window.fashionWorkerQA.step(0)); return; } await page.waitForTimeout(25); } throw new Error('Worker Canvas not ready: ' + day); }
async function select(page, day) { await page.getByLabel('정령과 동반자 · 일주').evaluate((element, day) => { element.value = day; element.dispatchEvent(new Event('change', { bubbles: true })); }, day); await ready(page, day); }
async function equip(page, mask = false) { for (const name of [mask ? '초승달 핀' : '새싹 핀', mask ? '곡면 마스크' : '동그란 선글라스', '작은 리본', '잎사귀 등 장식']) await button(page, name + ' 착용'); await page.waitForFunction(face => window.fashionWorkerQA.view.spirit.fashion.selection.face === face && window.fashionWorkerQA.view.spirit.fashion.group.children.length === 4, mask ? 'fitted-mask' : 'round-sunglasses', { polling: 25 }); }
async function image(page, name, state, fullPage = false) { const file = name + '.png'; if (fullPage) await page.screenshot({ path: path.join(output, file), fullPage: true }); else { const uri = await page.locator('[data-scene="spirit"] canvas').evaluate(canvas => canvas.toDataURL()); await fs.writeFile(path.join(output, file), Buffer.from(uri.split(',')[1], 'base64')); } report.images.push({ file, pixels: state.pixels, wave: state.morph[0], sha256: sha(await fs.readFile(path.join(output, file))) }); }
async function atReferenceTime(page) { await button(page, '정령 정면과 움직임 초기화'); await button(page, '정령 움직임 재생'); await page.evaluate(() => window.fashionWorkerQA.advance(45, 50)); await button(page, '정령 움직임 일시정지'); }
let mf, browser, origin;
function record(page) { page.on('pageerror', error => report.errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); }); page.on('response', response => { if (response.status() !== 200) return; const url = new URL(response.url()); if (url.pathname.endsWith('/body.glb') || /\.m?js$/.test(url.pathname)) pendingAssets.push(response.body().then(bytes => { if (url.pathname.endsWith('/body.glb')) bodyResponses.add(sha(bytes)); else assets.set(url.pathname, sha(bytes)); }).catch(error => report.errors.push('Response hash: ' + error.message))); }); }
async function context(options = {}) { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce', extraHTTPHeaders: headers, ...options }); await c.addInitScript(initializeClock); await c.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue(); report.outbound.push(url.hostname); return route.abort(); }); return c; }
try {
  mf = new Miniflare({ rootPath: root, modulesRoot: 'dist/server', modules: [entry, ...(await walk('dist/server')).filter(file => path.resolve(file) !== entry)].map(file => ({ type: 'ESModule', path: path.resolve(file) })),
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0, cf: false, logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'fashion-worker-synthetic' }, d1Persist: false,
    assets: { directory: path.join(root, 'dist/client'), routerConfig: { has_user_worker: true } }, outboundService: async request => { report.outbound.push(new URL(request.url).hostname); return new Response('QA blocked outbound', { status: 502 }); } });
  const db = await mf.getD1Database('DB'); for (const file of (await fs.readdir('drizzle')).filter(name => name.endsWith('.sql')).sort()) for (const sql of (await fs.readFile(path.join('drizzle', file), 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql.trim()).run();
  origin = (await mf.ready).origin; browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const quality of ['high', 'low']) {
    const c = await context({ viewport: quality === 'high' ? { width: 1280, height: 900 } : { width: 390, height: 844 }, isMobile: quality === 'low', hasTouch: quality === 'low' }), page = await c.newPage(); record(page); page.setDefaultTimeout(20000);
    try {
      await page.goto(origin + '/planet?view=spirit', { waitUntil: 'networkidle' }); await ready(page, '을축'); await page.locator('summary').filter({ hasText: '조합을 직접 둘러보기' }).evaluate(element => element.click());
      for (const day of ['갑자', '을축', '병인', '정묘', '무진', '기사', '경오', '신미', '임신', '계유']) await check(day + ' ' + quality + ': two outfits, same-time default restore, original-wave anchors', async () => {
        await select(page, day); await atReferenceTime(page); const initial = await page.evaluate(snapshot); valid(initial, day, quality); assert.equal(initial.itemCount, 0); assert(Math.abs(initial.time - 2.25) < 1e-10);
        await equip(page); const dressed = await page.evaluate(snapshot); valid(dressed, day, quality); assert.equal(dressed.itemCount, 4); assert.equal(dressed.exclusions.length, 4); assert.notEqual(dressed.pixels, initial.pixels);
        if (quality === 'high' && ['갑자', '병인', '기사', '계유'].includes(day)) await image(page, day + '-sun-front', dressed);
        await equip(page, true); const masked = await page.evaluate(snapshot); valid(masked, day, quality); assert.notEqual(masked.pixels, dressed.pixels); assert.equal(masked.selection.face, 'fitted-mask');
        if (quality === 'low' && day === '갑자') await image(page, 'mobile-ui-four-items-mask', masked, true);
        if (quality === 'high') {
          const box = await page.locator('[data-scene="spirit"] canvas').boundingBox(); await page.mouse.click(box.x + box.width * .48, box.y + box.height * .44); await button(page, '정령 움직임 재생'); await page.evaluate(() => window.fashionWorkerQA.advance(13, 50)); await button(page, '정령 움직임 일시정지');
          const wave = await page.evaluate(snapshot); valid(wave, day, quality); assert(wave.morph[0] > .37); assert.notDeepEqual(wave.regionCenters, masked.regionCenters); assert.notEqual(wave.pixels, masked.pixels); report.motion.push({ day, ...wave });
          if (['갑자', '을축', '병인', '계유'].includes(day)) await image(page, day + '-mask-wave-front', wave);
        }
        await button(page, '장식 모두 벗기'); await page.waitForFunction(() => window.fashionWorkerQA.view.spirit.fashion.group.children.length === 0, undefined, { polling: 25 }); await atReferenceTime(page); const cleared = await page.evaluate(snapshot); valid(cleared, day, quality);
        assert.deepEqual(cleared.effects, initial.effects); assert.equal(cleared.pixels, initial.pixels); assert.equal(cleared.buffers, initial.buffers, 'clearing restores GPU buffer count'); assert.deepEqual(cleared.memory, initial.memory);
        report.cases.push({ day, quality, initial: { pixels: initial.pixels, effects: initial.effects, memory: initial.memory, buffers: initial.buffers }, dressed: { selection: dressed.selection, supports: dressed.supports, pixels: dressed.pixels }, masked: { selection: masked.selection, supports: masked.supports, pixels: masked.pixels }, restored: true, setTimings: cleared.setTimings, retired: cleared.retired });
      });
      await check(quality + ': real UI pause/drag/reset/blink/wave and browser storage recovery', async () => {
        await select(page, '갑자'); await equip(page); await button(page, '얼굴 장식 벗기'); await button(page, '정령 정면과 움직임 초기화'); const initial = await page.evaluate(snapshot);
        const box = await page.locator('[data-scene="spirit"] canvas').boundingBox(); await page.mouse.move(box.x + box.width * .2, box.y + box.height * .45); await page.mouse.down(); await page.mouse.move(box.x + box.width * .2 + Math.PI / 2 / .009, box.y + box.height * .45, { steps: 6 }); await page.mouse.up();
        const side = await page.evaluate(snapshot); valid(side, '갑자', quality); assert.equal(side.time, initial.time); assert.notEqual(side.pixels, initial.pixels); await image(page, quality + '-paused-side', side);
        await button(page, '정령 정면과 움직임 초기화'); assert.equal((await page.evaluate(snapshot)).pixels, initial.pixels); const draws = await page.evaluate(() => window.fashionWorkerQA.view.record.draws); await page.evaluate(() => window.fashionWorkerQA.advance(4, 100)); assert.equal(await page.evaluate(() => window.fashionWorkerQA.view.record.draws), draws);
        await page.mouse.click(box.x + box.width * .48, box.y + box.height * .44); await button(page, '정령 움직임 재생'); await page.evaluate(() => window.fashionWorkerQA.advance(4, 50)); await button(page, '정령 움직임 일시정지'); const blink = await page.evaluate(snapshot); valid(blink, '갑자', quality); assert(blink.eyeScale.every((scale, i) => scale < initial.eyeScale[i] * .5)); await image(page, quality + '-blink', blink);
        await button(page, '정령 움직임 재생'); await page.evaluate(() => window.fashionWorkerQA.advance(9, 50)); await button(page, '정령 움직임 일시정지'); const wave = await page.evaluate(snapshot); valid(wave, '갑자', quality); assert(wave.morph[0] > .37); await image(page, quality + '-raised-wave', wave, quality === 'low');
        await button(page, '곡면 마스크 착용'); await select(page, '경오'); assert.equal((await page.evaluate(snapshot)).itemCount, 0); await select(page, '갑자'); assert.equal((await page.evaluate(snapshot)).selection.face, 'fitted-mask');
        await page.reload({ waitUntil: 'networkidle' }); await ready(page, '갑자'); assert.equal((await page.evaluate(snapshot)).selection.face, 'fitted-mask');
        for (const raw of ['{bad', JSON.stringify({ version: 2, outfits: { 갑: outfit } })]) { await page.evaluate(raw => localStorage.setItem('saju.spirit-fashion.v1', raw), raw); await page.reload({ waitUntil: 'networkidle' }); await ready(page, '갑자'); assert.equal((await page.evaluate(snapshot)).itemCount, 0); }
      });
      await check(quality + ': dressed context restore preserves items, masks and post-restore wave', async () => {
        await equip(page, true); await atReferenceTime(page); const initial = await page.evaluate(snapshot); valid(initial, '갑자', quality);
        const draws = initial.draws;
        await page.evaluate(() => { const { renderer, record } = window.fashionWorkerQA.view;
          window.fashionWorkerQA.loss = renderer.getContext().getExtension('WEBGL_lose_context');
          if (!window.fashionWorkerQA.loss) throw new Error('WEBGL_lose_context unavailable'); record.nextLossReason = 'qa-forced-recovery'; window.fashionWorkerQA.loss.loseContext(); });
        await page.waitForSelector('[data-scene="spirit"][data-scene-state="fallback"]');
        await page.evaluate(() => window.fashionWorkerQA.advance(3, 50)); assert.equal(await page.evaluate(() => window.fashionWorkerQA.view.record.draws), draws);
        await page.evaluate(() => window.fashionWorkerQA.loss.restoreContext()); await page.waitForSelector('[data-scene="spirit"][data-scene-state="ready"]');
        await page.evaluate(bindView); const restored = await page.evaluate(snapshot); valid(restored, '갑자', quality);
        assert.equal(restored.time, initial.time); assert.deepEqual(restored.selection, initial.selection); assert.deepEqual(restored.exclusions, initial.exclusions);
        assert.equal(restored.pixels, initial.pixels); assert.deepEqual(restored.effects, initial.effects);
        assert(restored.draws > draws); const box = await page.locator('[data-scene="spirit"] canvas').boundingBox();
        await page.mouse.click(box.x + box.width * .48, box.y + box.height * .44); await button(page, '정령 움직임 재생');
        await page.evaluate(() => window.fashionWorkerQA.advance(13, 50)); await button(page, '정령 움직임 일시정지');
        const wave = await page.evaluate(snapshot); valid(wave, '갑자', quality); assert(wave.morph[0] > .37); assert.notEqual(wave.pixels, restored.pixels);
        assert.notDeepEqual(wave.regionCenters, restored.regionCenters); await image(page, quality + '-restored-mask-wave', wave);
        report.contextRecovery ??= []; report.contextRecovery.push({ quality, initial, restored, wave });
      });
      await check(quality + ': actual view unmount disposes all body/item GPU buffers', async () => {
        const before = await page.evaluate(snapshot); assert.equal(before.bufferLifecycle.contextLost, false); assert(before.bufferLifecycle.nativeAlive.length > 0);
        await page.evaluate(() => { window.fashionWorkerQA.old = window.fashionWorkerQA.view; }); await button(page, '같은 나의 행성 보기');
        // Playwright's default main-world rAF polling would share our stopped
        // synthetic clock. Numeric polling observes the real React unmount.
        await page.waitForFunction(() => !window.fashionWorkerQA.old.record.canvas.isConnected && window.fashionWorkerQA.old.record.gl.isContextLost(), undefined, { polling: 25 }); await page.evaluate(() => window.fashionWorkerQA.step(0, false));
        const retired = await page.evaluate(async () => { const { spirit, record } = window.fashionWorkerQA.old; return { connected: record.canvas.isConnected, contextLost: record.gl.isContextLost(), items: spirit.fashion.group.children.length, buffers: record.buffers.size, created: record.created, deleted: record.deleted, draws: record.draws, errors: record.errors, lifecycle: await record.lifecycle() }; });
        assert(!retired.connected && retired.contextLost); assert.equal(retired.items, 0); assert.equal(retired.buffers, 0); assert.equal(retired.created, retired.deleted);
        assert.deepEqual(retired.errors, []); validNormalRetirement(retired.lifecycle); await page.evaluate(() => window.fashionWorkerQA.advance(4, 50));
        assert.equal(await page.evaluate(() => window.fashionWorkerQA.old.record.draws), retired.draws, 'unmounted actual fashion canvas never draws');
        report.buffers ??= []; report.buffers.push({ quality, before: before.bufferLifecycle, ...retired });
      }); await Promise.all(pendingAssets);
    } finally { await c.close(); }
  }
  await check('actual browser quota denial keeps equipment usable and reports unsaved local outfit', async () => {
    const c = await context(); await c.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'saju.spirit-fashion.v1') throw new DOMException('QA quota denied', 'QuotaExceededError'); return original.call(this, key, value); }; });
    try { const page = await c.newPage(); record(page); await page.goto(origin + '/planet?view=spirit', { waitUntil: 'networkidle' }); await ready(page, '을축'); await button(page, '작은 리본 착용'); await page.getByText('저장할 수 없어 이번 화면에서만 착용돼요.', { exact: false }).waitFor(); assert.equal((await page.evaluate(snapshot)).selection.neck, 'ribbon-bow'); await Promise.all(pendingAssets); } finally { await c.close(); }
  });
  await check('exact built artifact, served assets and isolated synthetic data boundary', async () => {
    assert.equal(sha(await fs.readFile(entry)), builtWorkerSHA256); assert.deepEqual(report.errors, []); assert.deepEqual(report.outbound, []); assert.deepEqual([...bodyResponses], [bodySHA256]);
    report.servedClientJS = Object.fromEntries(assets); report.servedBodySHA256 = [...bodyResponses]; report.databaseCounts = {};
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all();
    for (const table of tables.results) { assert(/^[a-zA-Z0-9_]+$/.test(table.name)); report.databaseCounts[table.name] = (await db.prepare('SELECT COUNT(*) AS count FROM "' + table.name + '"').first()).count; }
  }); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1; }
finally { await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await mf?.dispose(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, outfits: report.cases.length * 2, motion: report.motion.length, builtWorkerSHA256 })); }
