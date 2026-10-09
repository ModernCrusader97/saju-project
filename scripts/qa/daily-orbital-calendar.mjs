// Synthetic clocks and relationship fixtures; actual calendar code and TZ conversions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = fileURLToPath(import.meta.url);
const output = path.join(root, 'outputs/galaxy-day-calendar');
const baselineSHA = '073a71ec2120537332c489cec8b3ae07903ce5a6';
const phase = process.env.SAJU_QA_PHASE === 'before' ? 'before' : 'after';
const zones = ['Etc/UTC', 'Asia/Seoul', 'America/New_York', 'Europe/Berlin',
  'Australia/Lord_Howe', 'Pacific/Kiritimati', 'Pacific/Honolulu', 'Asia/Kathmandu'];
const stems = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const branches = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유'];
const require = createRequire(import.meta.url);
const { createLoader } = require('./load-ts.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const key = (year, month, day) => `${year}-${month}-${day}`;

function commonDates() {
  const dates = new Map();
  const add = (year, month, day) => dates.set(key(year, month, day), { year, month, day, common: true });
  for (const date of [[1900, 2, 28], [1900, 3, 1], [2000, 1, 1], [2000, 2, 28], [2000, 2, 29],
    [2000, 3, 1], [2024, 2, 28], [2024, 2, 29], [2024, 3, 1], [2100, 2, 28], [2100, 3, 1],
    [2023, 12, 31], [2024, 1, 1], [2024, 12, 31], [2025, 1, 1], [2025, 12, 31], [2026, 1, 1], [2026, 10, 9]]) add(...date);
  for (const year of [2024, 2026]) for (let month = 1; month <= 12; month++) {
    add(year, month, 1);
    add(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
  }
  return dates;
}

function person(index, isMe = false) {
  return Object.freeze({ id: (isMe ? 'owner-' : 'friend-') + index, name: '합성 ' + index, isMe,
    birthDate: '2000.1.1', relationType: 'supporter', relationTitle: '합성 관계',
    dayMaster: stems[index] + '목', elementMatch: '합성', affinityScore: [100, 90, 80][index % 3], advice: '합성 문구',
    pillars: Object.freeze({ dayKey: stems[index] + branches[index], monthKey: '병인', yearKey: '을축' }) });
}

if (process.argv.includes('--tz-worker')) {
  const NativeDate = Date;
  const clock = { now: new NativeDate(2026, 0, 1, 12).getTime() };
  class ClockDate extends NativeDate {
    constructor(...args) { if (args.length) super(...args); else super(clock.now); }
    static now() { return clock.now; }
  }
  const loader = createLoader({ three: require('three') }, { Date: ClockDate });
  const { getDailyPillar, analyzeSaju } = loader.load('lib/saju/manse.ts');
  const { calculateDailyOrbitalWeather: workingTree } = loader.load('lib/saju/daily-orbital.ts');
  const { buildGalaxyNodes } = loader.load('lib/planet/galaxy-helper.ts');
  const original = execFileSync('git', ['show', baselineSHA + ':lib/saju/daily-orbital.ts'], { cwd: root, encoding: 'utf8' });
  const compiled = ts.transpileModule(original, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, module: { exports }, Date: ClockDate,
    require: specifier => { throw new Error('Unexpected baseline dependency: ' + specifier); } });
  const previous = exports.calculateDailyOrbitalWeather;
  const current = phase === 'before' ? previous : workingTree;
  const previousGalaxySource = execFileSync('git', ['show', baselineSHA + ':lib/planet/galaxy-helper.ts'], { cwd: root, encoding: 'utf8' });
  const previousGalaxy = {};
  const previousDependencies = { three: require('three'), '@/lib/saju/manse': loader.load('lib/saju/manse.ts'),
    '@/lib/saju/input': loader.load('lib/saju/input.ts'), './spiral-galaxy': loader.load('lib/planet/spiral-galaxy.ts') };
  vm.runInNewContext(ts.transpileModule(previousGalaxySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: previousGalaxy, module: { exports: previousGalaxy }, Date: ClockDate,
    require: specifier => { assert(Object.hasOwn(previousDependencies, specifier)); return previousDependencies[specifier]; } });
  const checks = [], dates = commonDates(), transitions = [], samples = [];
  const owner = person(0, true), friends = [person(1)];
  function check(name, run) {
    try { run(); checks.push({ name, status: 'PASS' }); }
    catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
  }
  for (let month = 1; month <= 12; month++) {
    const last = new NativeDate(2026, month, 0).getDate();
    for (let day = 1; day <= last; day++) {
      const start = new NativeDate(2026, month - 1, day);
      const next = new NativeDate(2026, month - 1, day + 1);
      const hours = (next - start) / 3600000;
      if (hours !== 24) {
        transitions.push({ year: 2026, month, day, hours });
        for (const date of [start, next]) {
          const year = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
          if (!dates.has(key(year, m, d))) dates.set(key(year, m, d), { year, month: m, day: d, common: false });
        }
      }
    }
  }
  check('existing application day-pillar anchor is unchanged', () => {
    const day = getDailyPillar(2000, 1, 1);
    assert.equal(day.gan, '무'); assert.equal(day.ji, '오');
  });
  for (const date of dates.values()) {
    const { year, month, day } = date;
    const reference = getDailyPillar(year, month, day);
    const expected = `오늘의 우주 기운 [${reference.gan}·${reference.element.toUpperCase()}] 영향권`;
    const observations = [0, 12, 23].map(hour => {
      clock.now = new NativeDate(year, month - 1, day, hour, 30).getTime();
      return { hour, localDate: key(new ClockDate().getFullYear(), new ClockDate().getMonth() + 1, new ClockDate().getDate()),
        previous: previous(owner, friends)[0].elementStatus, current: current(owner, friends)[0].elementStatus };
    });
    samples.push({ date: key(year, month, day), common: date.common, expected, observations });
    check('same local date matches daily and birth analysis: ' + key(year, month, day), () => {
      for (const observation of observations) {
        assert.equal(observation.localDate, key(year, month, day));
        assert.equal(observation.current, expected);
      }
      for (const time of [{ isUnknownTime: true }, { isUnknownTime: false, birthHour: 0, birthMinute: 0 },
        { isUnknownTime: false, birthHour: 23, birthMinute: 30 }]) {
        const analysis = analyzeSaju({ name: '합성 일주', gender: 'male', birthYear: year, birthMonth: month, birthDay: day, ...time });
        assert.equal(analysis.dayPillar.gan + analysis.dayPillar.ji, reference.gan + reference.ji);
      }
    });
  }
  for (const transition of transitions) check('one calendar-day step across DST: ' + key(transition.year, transition.month, transition.day), () => {
    const start = new NativeDate(transition.year, transition.month - 1, transition.day, 12);
    const next = new NativeDate(transition.year, transition.month - 1, transition.day + 1, 12);
    const a = getDailyPillar(start.getFullYear(), start.getMonth() + 1, start.getDate());
    const b = getDailyPillar(next.getFullYear(), next.getMonth() + 1, next.getDate());
    assert.equal(stems.indexOf(b.gan), (stems.indexOf(a.gan) + 1) % 10);
    for (const date of [start, next]) {
      clock.now = date.getTime();
      const ref = getDailyPillar(date.getFullYear(), date.getMonth() + 1, date.getDate());
      assert.equal(current(owner, friends)[0].elementStatus, `오늘의 우주 기운 [${ref.gan}·${ref.element.toUpperCase()}] 영향권`);
    }
  });
  clock.now = NativeDate.parse('2026-01-01T00:15:00Z');
  const instant = new ClockDate();
  const local = getDailyPillar(instant.getFullYear(), instant.getMonth() + 1, instant.getDate());
  const instantSample = { instant: '2026-01-01T00:15:00Z', localDate: key(instant.getFullYear(), instant.getMonth() + 1, instant.getDate()),
    expected: `오늘의 우주 기운 [${local.gan}·${local.element.toUpperCase()}] 영향권`, current: current(owner, friends)[0].elementStatus };
  check('same instant respects this TZ local date rather than imposing UTC', () => assert.equal(instantSample.current, instantSample.expected));
  check('relationship fields/order/input and galaxy nodes retain existing results', () => {
    const withoutDailyLabel = rows => plain(rows).map(({ elementStatus, ...rest }) => { assert(elementStatus); return rest; });
    for (let index = 0; index < 10; index++) {
      const owner = person(index, true);
      const friendList = Object.freeze([owner, ...stems.map((_, i) => person(i)),
        Object.freeze({ ...person(0), id: 'fallback', pillars: undefined })]);
      const beforeInput = JSON.stringify({ owner, friendList });
      const beforeNodes = plain(previousGalaxy.buildGalaxyNodes(friendList));
      assert.deepEqual(withoutDailyLabel(current(owner, friendList)), withoutDailyLabel(previous(owner, friendList)));
      assert.equal(current(owner, friendList).length, 11, 'Owner is excluded and friend ordering is retained');
      assert.equal(JSON.stringify({ owner, friendList }), beforeInput);
      assert.deepEqual(plain(buildGalaxyNodes(friendList)), beforeNodes);
    }
  });
  console.log(JSON.stringify({ zone: process.env.TZ, status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL',
    checks, samples, transitions, instantSample, relationshipPairs: 110 }));
} else {
  await fs.mkdir(output, { recursive: true });
  const results = [];
  for (const zone of zones) {
    const worker = spawnSync(process.execPath, [script, '--tz-worker'], { cwd: root, env: { ...process.env, TZ: zone }, encoding: 'utf8', timeout: 30000 });
    if (worker.status !== 0) throw new Error(zone + ' worker failed: ' + worker.stderr);
    results.push(JSON.parse(worker.stdout));
  }
  const checks = [];
  try {
    for (const date of commonDates().keys()) {
      const labels = results.map(result => result.samples.find(sample => sample.date === date).observations.map(row => row.current));
      assert.equal(new Set(labels.flat()).size, 1, 'Same calendar date differs by TZ: ' + date);
    }
    assert(new Set(results.map(result => result.instantSample.localDate)).size > 1, 'Same-instant fixture must exercise different local dates');
    for (const zone of ['America/New_York', 'Europe/Berlin', 'Australia/Lord_Howe']) {
      assert.equal(results.find(result => result.zone === zone).transitions.length, 2, 'DST fixture coverage: ' + zone);
    }
    checks.push({ name: 'common dates are TZ invariant; instant and full/half-hour DST fixtures are meaningful', status: 'PASS' });
  } catch (error) { checks.push({ name: 'cross-TZ invariants', status: 'FAIL', error: error.message }); }
  const report = { status: results.every(result => result.status === 'PASS') && checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL',
    baselineSHA, candidate: phase === 'before' ? baselineSHA : 'working-tree', zones: results, checks, limits: ['Synthetic clocks only; no user records or external services',
      'Preserves existing application day-pillar anchor and local civil-date contract; no independent astrology-policy validation'] };
  await fs.writeFile(path.join(output, 'calendar-' + phase + '-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, zones: results.map(result => ({ zone: result.zone, status: result.status,
    dates: result.samples.length, checks: result.checks.length, failures: result.checks.filter(check => check.status === 'FAIL').length,
    transitions: result.transitions, instant: result.instantSample })), checks,
    firstMismatch: results[0].samples.find(sample => sample.observations.some(row => row.current !== sample.expected)) }, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
}
