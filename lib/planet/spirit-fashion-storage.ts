import { EMPTY_FASHION, FASHION_STEMS, normalizeFashion, type FashionSelection, type FashionStem } from './spirit-fashion-catalog';
export const FASHION_STORAGE_KEY = 'saju.spirit-fashion.v1';
export interface FashionWardrobe { version: 1; outfits: Record<FashionStem, FashionSelection> }
export interface FashionStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function emptyWardrobe(): FashionWardrobe {
  return { version: 1, outfits: Object.fromEntries(FASHION_STEMS.map(stem => [stem, { ...EMPTY_FASHION }])) as FashionWardrobe['outfits'] };
}
export function decodeWardrobe(raw: string | null): FashionWardrobe {
  const wardrobe = emptyWardrobe();
  if (!raw) return wardrobe;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return wardrobe;
    const data = parsed as { version?: unknown; outfits?: unknown };
    // This is the first fashion schema. An unrecognized future/legacy version is
    // safely reset; there is no existing server wardrobe or invented migration.
    if (data.version !== 1 || !data.outfits || typeof data.outfits !== 'object' || Array.isArray(data.outfits)) return wardrobe;
    const outfits = data.outfits as Record<string, unknown>;
    for (const stem of FASHION_STEMS) wardrobe.outfits[stem] = normalizeFashion(outfits[stem]);
  } catch { /* A damaged browser entry must never prevent the studio opening. */ }
  return wardrobe;
}
export function readWardrobe(storage: FashionStorage): FashionWardrobe {
  try { return decodeWardrobe(storage.getItem(FASHION_STORAGE_KEY)); } catch { return emptyWardrobe(); }
}
export function saveWardrobe(storage: FashionStorage, wardrobe: FashionWardrobe): boolean {
  try { storage.setItem(FASHION_STORAGE_KEY, JSON.stringify(decodeWardrobe(JSON.stringify(wardrobe)))); return true; } catch { return false; }
}
