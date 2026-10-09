// Shared parser and local UI calculation; synthetic names only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createLoader } = require('./load-ts.cjs');
const loader = createLoader();
const { parseSajuInput, SajuInputError } = loader.load('lib/saju/input.ts');
const { analyzeSaju } = loader.load('lib/saju/manse.ts');
const birth = { gender: 'male', birthYear: 2000, birthMonth: 1, birthDay: 1,
  birthHour: 12, birthMinute: 30, isUnknownTime: false, calendarType: 'solar' };

const cases = [
  ['ordinary Korean name and trim', ' \t합성 이름\n ', '합성 이름'],
  ['ordinary Latin name and internal spaces', '  Synthetic Name  ', 'Synthetic Name'],
  ['exactly 50 BMP units', '가'.repeat(50), '가'.repeat(50)],
  ['over 50 BMP units', '가'.repeat(51), '가'.repeat(50)],
  ['emoji pair fits exactly at the limit', '가'.repeat(48) + '😀', '가'.repeat(48) + '😀'],
  ['emoji pair crosses the limit', '가'.repeat(49) + '😀', '가'.repeat(49)],
  ['trim before a crossing emoji', '  ' + '가'.repeat(49) + '😀  ', '가'.repeat(49)],
  ['crossing pair with trailing text removes just the cut unit', '가'.repeat(49) + '😀끝', '가'.repeat(49)],
  ['emoji starts after the limit', '가'.repeat(50) + '😀', '가'.repeat(50)],
  ['25 emoji still use 50 UTF-16 units', '😀'.repeat(25), '😀'.repeat(25)],
  ['26 emoji do not become a 50-code-point policy', '😀'.repeat(26), '😀'.repeat(25)],
  ['non-emoji supplementary character crosses the limit', '가'.repeat(49) + '𐐀', '가'.repeat(49)],
  ['combining marks keep the existing unit policy', '가'.repeat(49) + 'e\u0301', '가'.repeat(49) + 'e'],
  ['joined emoji keep the existing unit policy', '가'.repeat(48) + '😀\u200d😀', '가'.repeat(48) + '😀'],
];

for (const [label, raw, expected] of cases) {
  test(label, () => {
    assert(raw.isWellFormed(), 'Fixture must start as valid UTF-16');
    const actual = parseSajuInput({ ...birth, name: raw }).name;
    assert.equal(actual, expected);
    assert(actual.isWellFormed(), 'Normalization must not split a surrogate pair');
    assert(actual.length <= 50, 'The limit remains UTF-16 units');
    assert.equal(parseSajuInput({ ...birth, name: actual }).name, actual);
  });
}

test('empty and non-string names retain the existing validation error', () => {
  for (const name of ['', ' \t\n ', undefined, null, 42, false, {}]) {
    assert.throws(() => parseSajuInput({ ...birth, name }), error =>
      error instanceof SajuInputError && error.status === 400 && error.message === '이름을 입력해주세요.');
  }
});

test('existing malformed input is not given a new sanitization policy', () => {
  for (const name of ['합성\ud800', '합성\udc00', '가'.repeat(49) + '\ud800', '가'.repeat(49) + '\ud800끝']) {
    assert.equal(parseSajuInput({ ...birth, name }).name, name.slice(0, 50));
  }
});

test('client-side analysis reuses the same normalized name', () => {
  const name = '가'.repeat(49) + '😀';
  const input = parseSajuInput({ ...birth, name });
  assert.equal(input.name, '가'.repeat(49));
  assert.equal(analyzeSaju(input).name, input.name);
  assert.equal(analyzeSaju({ ...birth, name }).name, input.name);
});
