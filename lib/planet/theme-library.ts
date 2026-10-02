export interface GanziThemePreset {
  key: string;             // 예: "갑자", "을축"
  hanja: string;           // 예: "甲子", "乙丑"
  themeName: string;       // 비주얼 테마명 (참고용)
  natureMotive: string;    // 자연물 모티브
  stem: string;            // 천간
  branch: string;          // 지지
  surface: {
    primaryColor: string;    // 주 색상
    secondaryColor: string;  // 보조/악센트 색상
    roughness: number;       // 거칠기 (0.0 ~ 1.0)
    metalness: number;       // 금속성 (0.0 ~ 1.0)
    bumpScale: number;       // 요철 강도 (0.0 ~ 1.0)
    emissive?: string;       // 발광색
    emissiveIntensity?: number;
    patternType: "veins" | "crater" | "crystals" | "strata" | "waves" | "granite";
  };
}

// 60갑자 전체 목록 (순서대로)
export const SIXTY_GANZI_KEYS: Array<{ key: string; hanja: string; stem: string; branch: string }> = [
  { key: "갑자", hanja: "甲子", stem: "갑", branch: "자" },
  { key: "을축", hanja: "乙丑", stem: "을", branch: "축" },
  { key: "병인", hanja: "丙寅", stem: "병", branch: "인" },
  { key: "정묘", hanja: "丁卯", stem: "정", branch: "묘" },
  { key: "무진", hanja: "戊辰", stem: "무", branch: "진" },
  { key: "기사", hanja: "己巳", stem: "기", branch: "사" },
  { key: "경오", hanja: "庚午", stem: "경", branch: "오" },
  { key: "신미", hanja: "辛未", stem: "신", branch: "미" },
  { key: "임신", hanja: "壬申", stem: "임", branch: "신" },
  { key: "계유", hanja: "癸酉", stem: "계", branch: "유" },

  { key: "갑술", hanja: "甲戌", stem: "갑", branch: "술" },
  { key: "을해", hanja: "乙亥", stem: "을", branch: "해" },
  { key: "병자", hanja: "丙子", stem: "병", branch: "자" },
  { key: "정축", hanja: "丁丑", stem: "정", branch: "축" },
  { key: "무인", hanja: "戊寅", stem: "무", branch: "인" },
  { key: "기묘", hanja: "己卯", stem: "기", branch: "묘" },
  { key: "경진", hanja: "庚辰", stem: "경", branch: "진" },
  { key: "신사", hanja: "辛巳", stem: "신", branch: "사" },
  { key: "임오", hanja: "壬午", stem: "임", branch: "오" },
  { key: "계미", hanja: "癸未", stem: "계", branch: "미" },

  { key: "갑신", hanja: "甲申", stem: "갑", branch: "신" },
  { key: "을유", hanja: "乙酉", stem: "을", branch: "유" },
  { key: "병술", hanja: "丙戌", stem: "병", branch: "술" },
  { key: "정해", hanja: "丁亥", stem: "정", branch: "해" },
  { key: "무자", hanja: "戊子", stem: "무", branch: "자" },
  { key: "기축", hanja: "己丑", stem: "기", branch: "축" },
  { key: "경인", hanja: "庚寅", stem: "경", branch: "인" },
  { key: "신묘", hanja: "辛卯", stem: "신", branch: "묘" },
  { key: "임진", hanja: "壬辰", stem: "임", branch: "진" },
  { key: "계사", hanja: "癸巳", stem: "계", branch: "사" },

  { key: "갑오", hanja: "甲午", stem: "갑", branch: "오" },
  { key: "을미", hanja: "乙未", stem: "을", branch: "미" },
  { key: "병신", hanja: "丙申", stem: "병", branch: "신" },
  { key: "정유", hanja: "丁酉", stem: "정", branch: "유" },
  { key: "무술", hanja: "戊戌", stem: "무", branch: "술" },
  { key: "기해", hanja: "己亥", stem: "기", branch: "해" },
  { key: "경자", hanja: "庚子", stem: "경", branch: "자" },
  { key: "신축", hanja: "辛丑", stem: "신", branch: "축" },
  { key: "임인", hanja: "壬寅", stem: "임", branch: "인" },
  { key: "계묘", hanja: "癸卯", stem: "계", branch: "묘" },

  { key: "갑진", hanja: "甲辰", stem: "갑", branch: "진" },
  { key: "을사", hanja: "乙巳", stem: "을", branch: "사" },
  { key: "병오", hanja: "丙午", stem: "병", branch: "오" },
  { key: "정미", hanja: "丁未", stem: "정", branch: "미" },
  { key: "무신", hanja: "戊申", stem: "무", branch: "신" },
  { key: "기유", hanja: "己酉", stem: "기", branch: "유" },
  { key: "경술", hanja: "庚戌", stem: "경", branch: "술" },
  { key: "신해", hanja: "辛亥", stem: "신", branch: "해" },
  { key: "임자", hanja: "壬子", stem: "임", branch: "자" },
  { key: "계축", hanja: "癸丑", stem: "계", branch: "축" },

  { key: "갑인", hanja: "甲寅", stem: "갑", branch: "인" },
  { key: "을묘", hanja: "乙卯", stem: "을", branch: "묘" },
  { key: "병진", hanja: "丙辰", stem: "병", branch: "진" },
  { key: "정사", hanja: "丁巳", stem: "정", branch: "사" },
  { key: "무오", hanja: "戊午", stem: "무", branch: "오" },
  { key: "기미", hanja: "己未", stem: "기", branch: "미" },
  { key: "경신", hanja: "庚申", stem: "경", branch: "신" },
  { key: "신유", hanja: "辛酉", stem: "신", branch: "유" },
  { key: "임술", hanja: "壬戌", stem: "임", branch: "술" },
  { key: "계해", hanja: "癸亥", stem: "계", branch: "해" },
];

// 천간별 기본 색조 및 기본 물성 프로파일
const STEM_BASE_PROFILES: Record<string, { primary: string; secondary: string; roughness: number; metalness: number; pattern: GanziThemePreset["surface"]["patternType"] }> = {
  갑: { primary: "#174E42", secondary: "#9CCB83", roughness: 0.85, metalness: 0.05, pattern: "veins" },
  을: { primary: "#1C7769", secondary: "#C6E887", roughness: 0.75, metalness: 0.05, pattern: "veins" },
  병: { primary: "#A82E20", secondary: "#FFC76B", roughness: 0.45, metalness: 0.20, pattern: "crater" },
  정: { primary: "#721E43", secondary: "#F89E88", roughness: 0.55, metalness: 0.15, pattern: "crater" },
  무: { primary: "#9D6338", secondary: "#EDD09C", roughness: 0.90, metalness: 0.08, pattern: "strata" },
  기: { primary: "#665342", secondary: "#DBC57D", roughness: 0.80, metalness: 0.05, pattern: "granite" },
  경: { primary: "#465D78", secondary: "#DAE8F3", roughness: 0.35, metalness: 0.75, pattern: "crystals" },
  신: { primary: "#6C9AA8", secondary: "#F0FCFF", roughness: 0.20, metalness: 0.85, pattern: "crystals" },
  임: { primary: "#173873", secondary: "#78AEEE", roughness: 0.30, metalness: 0.25, pattern: "waves" },
  계: { primary: "#176D85", secondary: "#B6EFDF", roughness: 0.40, metalness: 0.15, pattern: "waves" },
};

// 10천간이 시각적 바탕, 지지가 색감/지형/물성을 변주합니다. 모든 기둥이 공유합니다.
export const STEM_VISUAL_NAMES: Record<string, string> = {
  갑: "비취 대륙", 을: "청록 덩굴", 병: "태양 용암", 정: "홍옥 불씨",
  무: "황금 사암", 기: "호박 퇴적층", 경: "백금 단층", 신: "서리 결정",
  임: "남빛 소용돌이", 계: "청옥 물결",
};

// 지지별 질감 변조 계수 (지지의 한난조습 및 밀도 반영)
const BRANCH_MODIFIERS: Record<string, { roughMod: number; metalMod: number; bumpScale: number; emissive?: string }> = {
  자: { roughMod: -0.15, metalMod: 0.05, bumpScale: 0.4, emissive: "#0A2540" },
  축: { roughMod: 0.10, metalMod: 0.00, bumpScale: 0.6 },
  인: { roughMod: 0.05, metalMod: -0.05, bumpScale: 0.7 },
  묘: { roughMod: -0.05, metalMod: -0.05, bumpScale: 0.5 },
  진: { roughMod: 0.08, metalMod: 0.05, bumpScale: 0.65 },
  사: { roughMod: -0.10, metalMod: 0.10, bumpScale: 0.55, emissive: "#551A00" },
  오: { roughMod: -0.12, metalMod: 0.15, bumpScale: 0.7, emissive: "#881100" },
  미: { roughMod: 0.15, metalMod: -0.05, bumpScale: 0.8 },
  신: { roughMod: -0.20, metalMod: 0.20, bumpScale: 0.6 },
  유: { roughMod: -0.25, metalMod: 0.25, bumpScale: 0.5, emissive: "#223344" },
  술: { roughMod: 0.12, metalMod: 0.05, bumpScale: 0.75 },
  해: { roughMod: -0.15, metalMod: 0.00, bumpScale: 0.4 },
};

// 60종 테마 프리셋 맵 생성
const THEME_PRESET_MAP: Record<string, GanziThemePreset> = {};

SIXTY_GANZI_KEYS.forEach(({ key, hanja, stem, branch }) => {
  const base = STEM_BASE_PROFILES[stem] || STEM_BASE_PROFILES["갑"];
  const mod = BRANCH_MODIFIERS[branch] || BRANCH_MODIFIERS["자"];

  const roughness = Math.max(0.1, Math.min(0.95, base.roughness + mod.roughMod));
  const metalness = Math.max(0.0, Math.min(0.95, base.metalness + mod.metalMod));

  THEME_PRESET_MAP[key] = {
    key,
    hanja,
    themeName: `${STEM_VISUAL_NAMES[stem]} · ${key}`,
    natureMotive: `${STEM_VISUAL_NAMES[stem]}에 ${branch}의 지형과 물성을 더한 표면`,
    stem,
    branch,
    surface: {
      primaryColor: base.primary,
      secondaryColor: base.secondary,
      roughness: Number(roughness.toFixed(2)),
      metalness: Number(metalness.toFixed(2)),
      bumpScale: mod.bumpScale,
      emissive: mod.emissive,
      emissiveIntensity: mod.emissive ? 0.35 : 0.0,
      patternType: base.pattern,
    },
  };
});

export function getThemePreset(ganziKey: string): GanziThemePreset {
  if (THEME_PRESET_MAP[ganziKey]) {
    return THEME_PRESET_MAP[ganziKey];
  }
  // 기본값 (갑자)
  return THEME_PRESET_MAP["갑자"];
}

export function getAllThemePresets(): GanziThemePreset[] {
  return Object.values(THEME_PRESET_MAP);
}
