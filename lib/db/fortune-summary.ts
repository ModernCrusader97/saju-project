import type { FortuneResult } from '../saju/types';

/** Only the fields rendered/searched by the archive list. Full readings stay in detail. */
export type FortuneSummary = Pick<FortuneResult, 'id' | 'createdAt' | 'category' | 'title' | 'summary'> & {
  name: string;
  dayMaster: string;
};

// Keep the existing owner/date index and owner boundary. Project in D1 so the
// Worker and browser don't transfer or JSON.parse every full saved reading.
export const FORTUNE_SUMMARY_SQL = `SELECT id, created_at AS createdAt,
  COALESCE(json_extract(data, '$.category'), 'overall') AS category,
  json_extract(data, '$.title') AS title,
  json_extract(data, '$.summary') AS summary,
  json_extract(data, '$.analysis.name') AS name,
  COALESCE(json_extract(data, '$.analysis.dayMaster'), '') AS dayMaster
  FROM fortunes WHERE owner_id=? ORDER BY created_at DESC`;
