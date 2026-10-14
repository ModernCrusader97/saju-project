// Shared parser and local UI calculation; synthetic names only.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createLoader } from './load-ts.mjs';
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
  ['space exposed by a crossing pair is normalized once', '가'.repeat(48) + ' 😀', '가'.repeat(48)],
  ['multiple spaces exposed by a crossing pair are normalized once', '가'.repeat(47) + '  😀', '가'.repeat(47)],
  ['tab exposed by a crossing pair is normalized once', '가'.repeat(48) + '\t😀', '가'.repeat(48)],
  ['line endings exposed by a crossing pair are normalized once', '가'.repeat(47) + '\r\n😀', '가'.repeat(47)],
  ['Unicode spaces exposed by a crossing pair are normalized once', '가'.repeat(47) + '\u00a0\u3000😀', '가'.repeat(47)],
  ['BOM exposed by a crossing pair is normalized once', '가'.repeat(48) + '\ufeff😀', '가'.repeat(48)],
  ['exposed space with trailing text is normalized once', '가'.repeat(48) + ' 😀끝', '가'.repeat(48)],
  ['zero-width space keeps the existing trim semantics', '가'.repeat(48) + '\u200b😀', '가'.repeat(48) + '\u200b'],
  ['internal whitespace remains inside the retained prefix', '가'.repeat(47) + ' 가😀', '가'.repeat(47) + ' 가'],
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

test('all existing trim whitespace stays idempotent when exposed by a crossing pair', () => {
  const whitespace = ['\t', '\n', '\v', '\f', '\r', ' ', '\u00a0', '\u1680',
    ...Array.from({ length: 11 }, (_, index) => String.fromCharCode(0x2000 + index)),
    '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff'];
  for (const unit of whitespace) for (let count = 1; count <= 5; count++) {
    const expected = '가'.repeat(49 - count);
    const input = parseSajuInput({ ...birth, name: expected + unit.repeat(count) + '😀' });
    assert.equal(input.name, expected);
    assert.equal(parseSajuInput(input).name, input.name);
    assert.equal(analyzeSaju(input).name, input.name);
  }
});

test('ordinary 50-unit truncation retains its existing whitespace behavior', () => {
  const raw = '가'.repeat(49) + ' 끝';
  assert.equal(parseSajuInput({ ...birth, name: raw }).name, '가'.repeat(49) + ' ');
  assert.equal(parseSajuInput({ ...birth, name: '  합성  이름  ' }).name, '합성  이름');
});
