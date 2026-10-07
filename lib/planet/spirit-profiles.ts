import { getThemePreset, SIXTY_GANZI_KEYS } from "./theme-library";

export interface ElementalSpiritData {
  stem: string;
  element: "wood" | "fire" | "earth" | "metal" | "water";
  polarity: "yang" | "yin";
  name: string;
  speciesTitle: string;
  conceptDesc: string;
  personalityTraits: string[];
  primaryColor: string;
  secondaryColor: string;
  emissiveColor: string;
  roughness: number;
}

const PROFILES: Record<string, [ElementalSpiritData["element"], string, string, string, string[]]> = {
  갑: ["wood", "갑목 · 숲의 분신", "곧게 자라는 숲의 기운", "단단한 수피와 층층이 자란 잎을 두른 원소 분신.", ["우직함", "개척", "생명력"]],
  을: ["wood", "을목 · 초록의 분신", "유연하게 뻗는 가지의 기운", "섬세한 가지와 부드러운 숲의 결을 지닌 원소 분신.", ["유연함", "친화력", "끈기"]],
  병: ["fire", "병화 · 불의 분신", "환하게 타오르는 불의 기운", "움직이는 용암의 빛과 위로 피어나는 불꽃을 지닌 원소 분신.", ["활력", "솔직함", "열정"]],
  정: ["fire", "정화 · 온기의 분신", "깊고 은은한 불의 기운", "따뜻한 빛을 간직하고 차분하게 타오르는 원소 분신.", ["온기", "통찰", "섬세함"]],
  무: ["earth", "무토 · 대지의 분신", "단단하게 받쳐 주는 대지의 기운", "모래와 지층의 결을 입고 안정감 있게 선 원소 분신.", ["신뢰", "포용", "뚝심"]],
  기: ["earth", "기토 · 흙의 분신", "생명을 품는 흙의 기운", "흙빛 도자와 고운 토양의 결을 지닌 원소 분신.", ["다정함", "배려", "돌봄"]],
  경: ["metal", "경금 · 강철의 분신", "곧고 선명한 금속의 기운", "티타늄 단층이 빛을 반사하는 견고한 원소 분신.", ["의리", "결단", "정직"]],
  신: ["metal", "신금 · 은빛의 분신", "정교하게 빛나는 금속의 기운", "유려한 액체 금속의 결을 지닌 세련된 원소 분신.", ["정교함", "감각", "명료함"]],
  임: ["water", "임수 · 물결의 분신", "크고 자유로운 물의 기운", "깊은 물빛과 흐르는 파도의 몸짓을 지닌 원소 분신.", ["지혜", "자유", "유연함"]],
  계: ["water", "계수 · 이슬의 분신", "맑고 섬세한 물의 기운", "잔잔한 물결과 밝은 반사를 지닌 원소 분신.", ["공감", "다정함", "적응력"]],
};

/** Spirit materials are stem-only. The branch changes animal features, not the
 * body material seed/properties; planet presets and their four-pillar rules stay intact. */
export function getSpiritStemPreset(stemOrKey:string) {
  const stem=stemOrKey.charAt(0);
  return getThemePreset(SIXTY_GANZI_KEYS.find(item=>item.stem===stem)?.key ?? "갑자");
}

/** Identity copy only. Every color and physical property comes from the common
 * shared preset/material pipeline. Spirit pillar roles are separate from planets. */
export const TEN_STEM_SPIRITS: Record<string, ElementalSpiritData> = Object.fromEntries(
  Object.entries(PROFILES).map(([stem, [element,name,speciesTitle,conceptDesc,personalityTraits]], index) => {
    const key=SIXTY_GANZI_KEYS.find(item=>item.stem===stem)!.key;
    const preset=getThemePreset(key);
    return [stem,{stem,element,polarity:index%2===0?"yang":"yin",name,speciesTitle,conceptDesc,personalityTraits,
      primaryColor:preset.surface.primaryColor,secondaryColor:preset.surface.secondaryColor,
      emissiveColor:preset.surface.emissive ?? "#000000",roughness:preset.surface.roughness}];
  }),
);

/** Exact day-branch identity for the 12 animal companions. */
export const ZODIAC_FEATURES = {
  자: { branch: "자", animal: "rat", label: "쥐", silhouette: "round-ears" },
  축: { branch: "축", animal: "ox", label: "소", silhouette: "outward-horns" },
  인: { branch: "인", animal: "tiger", label: "호랑이", silhouette: "rounded-ears-and-stripes" },
  묘: { branch: "묘", animal: "rabbit", label: "토끼", silhouette: "long-ears" },
  진: { branch: "진", animal: "dragon", label: "용", silhouette: "forked-horns" },
  사: { branch: "사", animal: "snake", label: "뱀", silhouette: "scaled-crown" },
  오: { branch: "오", animal: "horse", label: "말", silhouette: "leaf-ears-and-mane" },
  미: { branch: "미", animal: "sheep", label: "양", silhouette: "curled-horns" },
  신: { branch: "신", animal: "monkey", label: "원숭이", silhouette: "cupped-ears" },
  유: { branch: "유", animal: "rooster", label: "닭", silhouette: "scalloped-crest" },
  술: { branch: "술", animal: "dog", label: "개", silhouette: "floppy-ears" },
  해: { branch: "해", animal: "pig", label: "돼지", silhouette: "pointed-ears" },
} as const;

export type ZodiacBranch = keyof typeof ZODIAC_FEATURES;
