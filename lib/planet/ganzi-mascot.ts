import manifest from './ganzi-mascot-manifest.json';
import { SIXTY_GANZI_KEYS } from './theme-library';
import { TEN_STEM_SPIRITS, ZODIAC_FEATURES, type ZodiacBranch } from './spirit-profiles';

export const MASCOT_ASSET_VERSION = manifest.version;
export const MASCOT_ASSET_INTAKE_COMPLETE = manifest.complete;
const assets = new Map(manifest.entries.map(asset => [asset.key, asset]));
const pillars = new Map(SIXTY_GANZI_KEYS.map(pillar => [pillar.key, pillar]));
const elementNames = {wood:'목', fire:'화', earth:'토', metal:'금', water:'수'} as const;

/** Exact whole-key lookup. Missing or invalid keys never borrow another portrait. */
export function getGanziMascot(key: string | undefined) {
  const pillar = key ? pillars.get(key) : undefined;
  const asset = key ? assets.get(key) : undefined;
  if (!pillar || !asset) return undefined;
  const profile = TEN_STEM_SPIRITS[pillar.stem];
  const animal = ZODIAC_FEATURES[pillar.branch as ZodiacBranch];
  return {...asset, ...pillar, element:profile.element, polarity:profile.polarity,
    animal:animal.animal, animalLabel:animal.label,
    title:`${pillar.key} · ${elementNames[profile.element]}의 ${animal.label}`,
    alt:`${pillar.key} ${elementNames[profile.element]} 원소 ${animal.label} 마스코트`};
}

export function collectGanziKeys(keys: Array<string | undefined>) {
  return new Set(keys.filter((key): key is string => typeof key === 'string' && pillars.has(key)));
}
