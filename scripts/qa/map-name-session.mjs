// Frontend session binding only; real calculation and synthetic storage boundary.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createLoader } = require('./load-ts.cjs');
function harness() {
  const values = new Map();
  const loader = createLoader({ three: require('three') }, {
    sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    window: { dispatchEvent() {} }, Event: class Event {},
  });
  return loader.load('lib/universe-state.ts');
}
const birth = name => ({ name, year: '2000', month: '1', day: '1', hour: '12', minute: '30', unknown: false });
const mapFor = (snapshot, name) => ({ id: 'gm_synthetic', ownerName: name,
  ownerBirth: '2000.1.1', ownerSolarBirthDate: { year: 2000, month: 1, day: 1 },
  guins: [{ isMe: true, pillars: { dayKey: snapshot.dayKey, monthKey: snapshot.monthKey,
    yearKey: snapshot.yearKey, hourKey: snapshot.hourKey } }] });

for (const [label, raw, expected] of [
  ['ordinary form name', '합성 이름', '합성 이름'],
  ['outer whitespace', ' \t합성 이름\n ', '합성 이름'],
  ['internal spaces', '  합성  이름  ', '합성  이름'],
  ['ordinary cut retains trailing space', '가'.repeat(49) + ' x', '가'.repeat(49) + ' '],
  ['space exposed by crossing pair', '가'.repeat(48) + ' 😀', '가'.repeat(48)],
  ['crossing pair', '가'.repeat(49) + '😀', '가'.repeat(49)],
  ['pair fitting at 50 units', '가'.repeat(48) + '😀', '가'.repeat(48) + '😀'],
]) test('map owner can persist and restore: ' + label, () => {
  const state = harness(), input = birth(raw), before = JSON.stringify(input);
  const snapshot = state.calculateUniverse(input);
  assert.equal(JSON.stringify(input), before, 'Calculation must preserve the draft object');
  assert.equal(snapshot.birth.name, expected);
  state.saveGalaxyUniverse(snapshot, mapFor(snapshot, expected));
  assert.equal(state.readUniverseSession().birth.name, expected);
  assert.equal(state.readGalaxyPath(), '/guin/gm_synthetic');
  state.restoreGalaxyUniverse(mapFor(snapshot, expected));
  assert.equal(state.readUniverseSession().birth.name, expected);
  assert.equal(state.readGalaxyPath(), '/guin/gm_synthetic');
});

for (const [label, change] of [['different name', { name: '다른 합성' }], ['different minute', { minute: '31' }]]) {
  test('owner binding still distinguishes ' + label, () => {
    const state = harness();
    const snapshot = state.calculateUniverse(birth('합성 이름'));
    state.saveGalaxyUniverse(snapshot, mapFor(snapshot, '합성 이름'));
    state.saveUniverseSession({ ...snapshot, birth: { ...snapshot.birth, ...change } });
    assert.equal(state.readGalaxyPath(), '/guin');
  });
}

test('oversized untrusted session name remains rejected', () => {
  const state = harness(), snapshot = state.calculateUniverse(birth('합성 이름'));
  assert.equal(state.decodeUniverse({ ...snapshot, birth: { ...snapshot.birth, name: '가'.repeat(51) } }), null);
});

test('map binding rejects a name different from the first parser result', () => {
  const state = harness();
  const snapshot = state.calculateUniverse(birth('가'.repeat(49) + ' x'));
  assert.throws(() => state.saveGalaxyUniverse(snapshot, mapFor(snapshot, '가'.repeat(49))),
    error => error.message === '지도의 사주 결과를 확인하지 못했습니다.');
});

test('owner binding distinguishes retained cut whitespace from a shorter name', () => {
  const state = harness();
  const snapshot = state.calculateUniverse(birth('가'.repeat(49) + ' x'));
  // This represents the first parser result already bound by a successful POST.
  state.saveGalaxyUniverse(snapshot, mapFor(snapshot, snapshot.birth.name));
  state.saveUniverseSession(state.calculateUniverse(birth('가'.repeat(49))));
  assert.equal(state.readGalaxyPath(), '/guin');
});
