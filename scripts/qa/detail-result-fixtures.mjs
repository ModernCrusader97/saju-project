// Synthetic fixtures shared by the detail lifecycle and production-browser checks.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const output = path.join(root, 'outputs/detail-result-state');
const require = createRequire(import.meta.url);
const { createLoader } = require('./load-ts.cjs');
const loader = createLoader();
const { analyzeSaju } = loader.load('lib/saju/manse.ts');
const { parseSajuInput } = loader.load('lib/saju/input.ts');

export function fullReading(id, version = 'current') {
  return {
    id, createdAt: '2026-01-01T00:00:00.000Z', category: 'overall',
    title: `reading-${id}-${version}`, summary: `summary-${id}-${version}`,
    analysis: analyzeSaju(parseSajuInput({ name: `person-${id}-${version}`, gender: 'male',
      birthYear: 2000, birthMonth: 1, birthDay: 2, birthHour: 12,
      isUnknownTime: false, calendarType: 'solar' })),
    metaphor: { coreTitle: '합성 풀이', description: '합성 테스트 자료', natureTheme: 'fixture' },
    sections: [{ title: '상세', content: `body-${id}-${version}` }],
    luckyAdvice: { color: '초록', direction: '동쪽', mindset: '합성 자료', item: 'fixture' },
  };
}

export const summaries = ['a', 'b'].map(id => ({
  id, createdAt: '2026-01-01T00:00:00.000Z', category: 'overall',
  title: 'select-' + id, summary: 'synthetic-' + id, name: 'person-' + id, dayMaster: '갑목',
}));
