import { SIXTY_GANZI_KEYS } from './planet/theme-library';
import type { MaskStyle } from './planet/uv-mask';
import { analyzeSaju } from './saju/manse';
import { parseSajuInput } from './saju/input';

export const UNIVERSE_SESSION_KEY = 'saju:universe:v1';
export const UNIVERSE_CHANGE_EVENT = 'saju:universe-change';
export const GALAXY_SESSION_KEY = 'saju:galaxy-path';
export type UniverseMode = 'spirit' | 'planet';
export interface UniverseBirth {
  name: string; year: string; month: string; day: string; hour: string; minute: string; unknown: boolean;
}
export interface UniverseSnapshot {
  version: 1; birth: UniverseBirth; dayKey: string; monthKey: string;
  yearKey: string; hourKey: string; maskStyle: MaskStyle; mode: UniverseMode;
  source: 'example' | 'calculated';
}
export const EXAMPLE_UNIVERSE: UniverseSnapshot = {
  version: 1, birth: { name: '나', year: '1996', month: '7', day: '20', hour: '14', minute: '0', unknown: false },
  dayKey: '을축', monthKey: '병인', yearKey: '을축', hourKey: '계유',
  maskStyle: 'pangaea', mode: 'spirit', source: 'example',
};
const validKeys = new Set(SIXTY_GANZI_KEYS.map(item => item.key));
const validMasks = new Set(['pangaea', 'archipelago', 'tectonic', 'bands', 'vortices']);

export function decodeUniverse(value: unknown): UniverseSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as UniverseSnapshot;
  if (s.version !== 1 || !s.birth || !['spirit', 'planet'].includes(s.mode)
    || !['example', 'calculated'].includes(s.source) || !validMasks.has(s.maskStyle)
    || ![s.dayKey, s.monthKey, s.yearKey, s.hourKey].every(key => validKeys.has(key))) return null;
  if (typeof s.birth.name !== 'string' || s.birth.name.length > 40 || typeof s.birth.unknown !== 'boolean'
    || !['year', 'month', 'day', 'hour', 'minute'].every(key => {
      const field = s.birth[key as keyof UniverseBirth];
      return typeof field === 'string' && field.length <= 8;
    })) return null;
  return { version: 1, birth: { name: s.birth.name, year: s.birth.year, month: s.birth.month,
    day: s.birth.day, hour: s.birth.hour, minute: s.birth.minute, unknown: s.birth.unknown },
    dayKey: s.dayKey, monthKey: s.monthKey, yearKey: s.yearKey, hourKey: s.hourKey,
    maskStyle: s.maskStyle, mode: s.mode, source: s.source };
}

export function calculateUniverse(birth: UniverseBirth, current = EXAMPLE_UNIVERSE): UniverseSnapshot {
  const result = analyzeSaju(parseSajuInput({ name: birth.name.trim() || '나', gender: 'male',
    birthYear: birth.year, birthMonth: birth.month, birthDay: birth.day,
    birthHour: birth.unknown ? undefined : birth.hour, birthMinute: birth.unknown ? undefined : birth.minute,
    isUnknownTime: birth.unknown, calendarType: 'solar' }));
  return { ...current, birth, source: 'calculated',
    dayKey: result.dayPillar.gan + result.dayPillar.ji,
    monthKey: result.monthPillar.gan + result.monthPillar.ji,
    yearKey: result.yearPillar.gan + result.yearPillar.ji,
    hourKey: result.hourPillar ? result.hourPillar.gan + result.hourPillar.ji : '갑자' };
}

export function resolveUniverseQuery(params: URLSearchParams, prior = EXAMPLE_UNIVERSE): UniverseSnapshot {
  let next = prior;
  if (params.has('y') || params.has('m') || params.has('d')) {
    next = calculateUniverse({ name: params.get('name') || '나', year: params.get('y') || '',
      month: params.get('m') || '', day: params.get('d') || '', hour: params.get('h') || '12',
      minute: params.get('minute') || '0', unknown: params.get('unknown') === 'true' }, prior);
  }
  const mode = params.get('view');
  return mode === 'spirit' || mode === 'planet' ? { ...next, mode } : next;
}

export function readUniverseSession(): UniverseSnapshot | null {
  try { return decodeUniverse(JSON.parse(sessionStorage.getItem(UNIVERSE_SESSION_KEY) || 'null')); }
  catch { return null; }
}
export function saveUniverseSession(snapshot: UniverseSnapshot): void {
  try { sessionStorage.setItem(UNIVERSE_SESSION_KEY, JSON.stringify(snapshot)); } catch { /* Storage may be blocked. */ }
  window.dispatchEvent(new Event(UNIVERSE_CHANGE_EVENT));
}
export function readGalaxyPath(): string {
  try { const path = sessionStorage.getItem(GALAXY_SESSION_KEY); return path && /^\/guin\/[a-zA-Z0-9_-]+$/.test(path) ? path : '/guin'; }
  catch { return '/guin'; }
}
export function rememberGalaxyPath(path: string): void {
  if (!/^\/guin\/[a-zA-Z0-9_-]+$/.test(path)) return;
  try { sessionStorage.setItem(GALAXY_SESSION_KEY, path); } catch { /* Storage may be blocked. */ }
  window.dispatchEvent(new Event(UNIVERSE_CHANGE_EVENT));
}
