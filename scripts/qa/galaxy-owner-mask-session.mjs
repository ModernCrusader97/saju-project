// Real calculation, owner binding and restore with synthetic session storage.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url), { createLoader } = require('./load-ts.cjs');
function harness() {
  const values = new Map();
  return createLoader({ three: require('three') }, {
    sessionStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) },
    window: { dispatchEvent() {} }, Event: class {},
  }).load('lib/universe-state.ts');
}
const birth = { name: '합성 소유자', year: '2000', month: '1', day: '1', hour: '12', minute: '30', unknown: false };
const mapFor = s => ({ id: 'gm_synthetic', ownerName: s.birth.name, ownerBirth: '2000.1.1',
  ownerSolarBirthDate: { year: 2000, month: 1, day: 1 }, guins: [{ isMe: true,
    pillars: { dayKey: s.dayKey, monthKey: s.monthKey, yearKey: s.yearKey, hourKey: s.hourKey } }] });
for (const maskStyle of ['pangaea', 'archipelago', 'tectonic', 'bands', 'vortices']) test(`same bound owner preserves later ${maskStyle} preference and view on restore`, () => {
  const state = harness(), original = state.calculateUniverse(birth), map = mapFor(original);
  state.saveGalaxyUniverse(original, map);
  const selected = { ...original, maskStyle, mode: 'planet' };
  state.saveUniverseSession(selected);
  const restored = state.restoreGalaxyUniverse(map);
  assert.equal(restored?.maskStyle, maskStyle); assert.equal(restored?.mode, 'planet');
  assert.equal(state.readUniverseSession().maskStyle, maskStyle); assert.equal(state.readGalaxyPath(), '/guin/gm_synthetic');
});
test('unbound legacy map cannot use a current session mask', () => {
  const state = harness(), snapshot = { ...state.calculateUniverse(birth), maskStyle: 'archipelago' };
  state.saveUniverseSession(snapshot); assert.equal(state.restoreGalaxyUniverse(mapFor(snapshot)), null);
  assert.equal(state.readUniverseSession().maskStyle, 'archipelago');
});
for (const change of [{ name: '다른 소유자' }, { minute: '31' }]) test(`restore excludes a different owner key: ${JSON.stringify(change)}`, () => {
  const state = harness(), original = state.calculateUniverse(birth), map = mapFor(original);
  state.saveGalaxyUniverse(original, map);
  state.saveUniverseSession({ ...original, birth: { ...birth, ...change }, maskStyle: 'archipelago' });
  const restored = state.restoreGalaxyUniverse(map);
  assert.equal(restored?.maskStyle, original.maskStyle); assert.equal(restored?.birth.minute, original.birth.minute);
  assert.equal(restored?.birth.name, original.birth.name);
});
test('a different map id returns null and does not inherit the owner mask', () => {
  const state = harness(), snapshot = { ...state.calculateUniverse(birth), maskStyle: 'archipelago' }, map = mapFor(snapshot);
  state.saveGalaxyUniverse(snapshot, map);
  assert.equal(state.restoreGalaxyUniverse({ ...map, id: 'gm_other' }), null);
});
test('map owner/pillars must still match the saved binding', () => {
  const state = harness(), snapshot = state.calculateUniverse(birth), map = mapFor(snapshot);
  state.saveGalaxyUniverse(snapshot, map);
  assert.equal(state.restoreGalaxyUniverse({ ...map, ownerName: '다른 합성' }), null);
  assert.equal(state.restoreGalaxyUniverse({ ...map, guins: [{ isMe: true, pillars: { ...map.guins[0].pillars, dayKey: '갑자' } }] }), null);
});
