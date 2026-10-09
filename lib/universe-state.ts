import { SIXTY_GANZI_KEYS } from './planet/theme-library';
import type { MaskStyle } from './planet/uv-mask';
import { analyzeSaju } from './saju/manse';
import { parseSajuInput } from './saju/input';
import type { GuinMapData } from './saju/types';

export const UNIVERSE_SESSION_KEY = 'saju:universe:v1';
export const UNIVERSE_CHANGE_EVENT = 'saju:universe-change';
export const GALAXY_SESSION_KEY = 'saju:galaxy-path';
const GALAXY_OWNER_SESSION_KEY = 'saju:galaxy-owner:v1';
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
  if (typeof s.birth.name !== 'string' || s.birth.name.length > 50 || typeof s.birth.unknown !== 'boolean'
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
  const input = parseSajuInput({ name: birth.name.trim() || '나', gender: 'male',
    birthYear: birth.year, birthMonth: birth.month, birthDay: birth.day,
    birthHour: birth.unknown ? undefined : birth.hour, birthMinute: birth.unknown ? undefined : birth.minute,
    isUnknownTime: birth.unknown, calendarType: 'solar' });
  const result = analyzeSaju(input);
  return { ...current, birth: { ...birth, name: input.name }, source: 'calculated',
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
// Viewing mode and surface masks do not change who owns a galaxy. Birth fields
// and all four displayed pillars do; unbound legacy paths cannot prove ownership.
function universeOwnerKey(snapshot: UniverseSnapshot): string | null {
  if (snapshot.source !== 'calculated') return null;
  const b = snapshot.birth;
  return JSON.stringify([b.name.trim() || '나', Number(b.year), Number(b.month), Number(b.day), b.unknown,
    ...(b.unknown ? [] : [Number(b.hour), Number(b.minute)]),
    snapshot.dayKey, snapshot.monthKey, snapshot.yearKey, b.unknown ? null : snapshot.hourKey]);
}
function readGalaxyOwner(): { path: string; snapshot: UniverseSnapshot } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(GALAXY_OWNER_SESSION_KEY) || 'null');
    const snapshot = decodeUniverse(saved?.snapshot);
    return snapshot && universeOwnerKey(snapshot) && /^\/guin\/[a-zA-Z0-9_-]+$/.test(saved?.path)
      ? { path: saved.path, snapshot } : null;
  } catch { return null; }
}
export function saveUniverseSession(snapshot: UniverseSnapshot): void {
  const galaxy = readGalaxyOwner();
  try {
    sessionStorage.setItem(UNIVERSE_SESSION_KEY, JSON.stringify(snapshot));
    if (galaxy && universeOwnerKey(galaxy.snapshot) === universeOwnerKey(snapshot)) sessionStorage.setItem(GALAXY_SESSION_KEY, galaxy.path);
    else sessionStorage.removeItem(GALAXY_SESSION_KEY);
  } catch { /* Storage may be blocked. */ }
  window.dispatchEvent(new Event(UNIVERSE_CHANGE_EVENT));
}
export function readGalaxyPath(): string {
  const snapshot = readUniverseSession(), galaxy = readGalaxyOwner();
  return snapshot && galaxy && universeOwnerKey(snapshot) === universeOwnerKey(galaxy.snapshot) ? galaxy.path : '/guin';
}
function galaxyMatchesSnapshot(map: GuinMapData, snapshot: UniverseSnapshot): boolean {
  const birth = snapshot.birth, pillars = map.guins.find(person => person.isMe)?.pillars;
  const date = map.ownerSolarBirthDate;
  const ownerDate = date ? [date.year, date.month, date.day] : map.ownerBirth.split('.').map(Number);
  return snapshot.source === 'calculated' && map.ownerName === (birth.name.trim() || '나')
    && ownerDate.join('.') === [Number(birth.year), Number(birth.month), Number(birth.day)].join('.')
    && !!pillars && pillars.dayKey === snapshot.dayKey && pillars.monthKey === snapshot.monthKey
    && pillars.yearKey === snapshot.yearKey
    && (birth.unknown ? !pillars.hourKey : pillars.hourKey === snapshot.hourKey);
}
export function saveGalaxyUniverse(snapshot: UniverseSnapshot, map: GuinMapData): void {
  const path = `/guin/${map.id}`;
  if (!/^\/guin\/[a-zA-Z0-9_-]+$/.test(path) || !galaxyMatchesSnapshot(map, snapshot)) throw new Error('지도의 사주 결과를 확인하지 못했습니다.');
  try { sessionStorage.setItem(GALAXY_OWNER_SESSION_KEY, JSON.stringify({ path, snapshot })); } catch { /* Storage may be blocked. */ }
  saveUniverseSession(snapshot);
}
export function restoreGalaxyUniverse(map: GuinMapData): void {
  const saved = readGalaxyOwner();
  // GET cannot recover an exact birth time: reuse only the snapshot that was
  // bound on successful creation, and verify it against the actual map owner.
  if (saved?.path === `/guin/${map.id}` && galaxyMatchesSnapshot(map, saved.snapshot)) saveUniverseSession(saved.snapshot);
}
