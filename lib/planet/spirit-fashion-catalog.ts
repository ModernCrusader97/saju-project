export const FASHION_SLOTS = ['head', 'face', 'neck', 'back'] as const;
export type FashionSlot = typeof FASHION_SLOTS[number];
export const FASHION_STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
export type FashionStem = typeof FASHION_STEMS[number];
export const FASHION_ITEMS = [
  { id: 'sprout-pin', slot: 'head', label: '새싹 핀' },
  { id: 'crescent-pin', slot: 'head', label: '초승달 핀' },
  { id: 'round-sunglasses', slot: 'face', label: '동그란 선글라스' },
  { id: 'fitted-mask', slot: 'face', label: '곡면 마스크' },
  { id: 'ribbon-bow', slot: 'neck', label: '작은 리본' },
  { id: 'leaf-brooch', slot: 'back', label: '잎사귀 등 장식' },
] as const;
export type FashionItemId = typeof FASHION_ITEMS[number]['id'];
export type FashionSelection = Record<FashionSlot, FashionItemId | null>;
export const EMPTY_FASHION: Readonly<FashionSelection> = Object.freeze({ head: null, face: null, neck: null, back: null });
export const FASHION_SLOT_LABELS: Record<FashionSlot, string> = { head: '머리', face: '얼굴', neck: '목', back: '등' };
export function fashionStem(dayKey: string): FashionStem {
  const first = dayKey.charAt(0);
  return FASHION_STEMS.includes(first as FashionStem) ? first as FashionStem : '갑';
}
/** Unknown items, wrong-slot choices and omitted slots always recover to null. */
export function normalizeFashion(value: unknown): FashionSelection {
  const result = { ...EMPTY_FASHION };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  for (const slot of FASHION_SLOTS) {
    const item = FASHION_ITEMS.find(candidate => candidate.id === input[slot] && candidate.slot === slot);
    result[slot] = item?.id ?? null;
  }
  return result;
}
export function equipFashion(prior: FashionSelection, slot: FashionSlot, item: FashionItemId | null): FashionSelection {
  return normalizeFashion({ ...prior, [slot]: item });
}
export interface FashionPalette { main: string; accent: string; fabric: string; lens: string; metalness: number; roughness: number; label: string }
/** Accessories have their own materials. No body shader or source texture is replaced. */
export const FASHION_PALETTES: Record<FashionStem, FashionPalette> = {
  갑: { main: '#735038', accent: '#b0c578', fabric: '#d1bd91', lens: '#35423a', metalness: .02, roughness: .78, label: '나무와 새싹' },
  을: { main: '#57854a', accent: '#b6d976', fabric: '#e0e8bc', lens: '#344c35', metalness: .02, roughness: .6, label: '덩굴과 잎' },
  병: { main: '#e98240', accent: '#f5cd79', fabric: '#993f35', lens: '#493632', metalness: .12, roughness: .5, label: '불꽃과 금빛' },
  정: { main: '#4d4240', accent: '#d3865d', fabric: '#8a5151', lens: '#39313b', metalness: .08, roughness: .72, label: '숯과 잔불' },
  무: { main: '#be965f', accent: '#e5cba2', fabric: '#b47b55', lens: '#51463a', metalness: 0, roughness: .88, label: '사암과 모래' },
  기: { main: '#48896c', accent: '#b6d6b6', fabric: '#83a493', lens: '#284a41', metalness: .04, roughness: .3, label: '옥과 초록빛' },
  경: { main: '#8199a9', accent: '#e6edf0', fabric: '#617685', lens: '#303d4b', metalness: .78, roughness: .43, label: '브러시드 티타늄' },
  신: { main: '#c3ced5', accent: '#f3e5cb', fabric: '#97a5b4', lens: '#3d414c', metalness: .9, roughness: .2, label: '은빛과 진주' },
  임: { main: '#418398', accent: '#a6dbe5', fabric: '#7caec1', lens: '#24444f', metalness: .12, roughness: .32, label: '흐르는 물' },
  계: { main: '#8ebdc0', accent: '#d4ede2', fabric: '#a2c3be', lens: '#38575b', metalness: .05, roughness: .3, label: '이슬과 유리빛' },
};
