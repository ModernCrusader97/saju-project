export type Gender = "male" | "female";
export type CalendarType = "solar" | "lunar" | "leap-lunar";

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface SajuPillar {
  gan: string; // 천간 (갑, 을, 병, 정, ...)
  ji: string;  // 지지 (자, 축, 인, 묘, ...)
  ganHanja: string; // 甲, 乙, ...
  jiHanja: string;  // 子, 丑, ...
  ganElement: "wood" | "fire" | "earth" | "metal" | "water";
  jiElement: "wood" | "fire" | "earth" | "metal" | "water";
  ganElementName: string; // 목, 화, 토, 금, 수
  jiElementName: string;
  shipshinGan: string; // 비견, 겁재, 식신, ...
  shipshinJi: string;
}

export interface FiveElementsCount {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
}

export interface SajuAnalysis {
  name: string;
  gender: Gender;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  isUnknownTime: boolean;
  calendarType: CalendarType;
  // Original birth fields above are preserved; pillars use this normalized solar date.
  // Optional to remain compatible with previously saved results.
  solarBirthDate?: CalendarDate;

  // 4주 기둥
  yearPillar: SajuPillar;
  monthPillar: SajuPillar;
  dayPillar: SajuPillar;
  hourPillar?: SajuPillar;

  // 오행 분석
  elementsCount: FiveElementsCount;
  dominantElement: string;
  lackingElement: string;
  dayMaster: string; // 일간 (나를 상징하는 기운, 예: 丙火)
  dayMasterMetaphor: string; // 비유 (예: "따스하게 비추는 태양의 불꽃")

  // 격국 & 용신
  patternName: string; // 격국 이름 (예: 정재격, 식신격)
  yongshin: string; // 용신 (나를 돕고 조화롭게 하는 기운)

  // 대운 수
  daewunNumber: number;
  daewunList: Array<{ age: number; ganji: string }>;
}

export interface FortuneResult {
  id: string;
  createdAt: string;
  analysis: SajuAnalysis;
  category: "overall" | "love" | "match" | "career" | "year" | "daewun" | "consult";
  // Optional for older saved results. New responses always identify their source.
  generation?:
    | { mode: "ai"; provider: "gemini" | "openai" }
    | { mode: "template"; reason: "not_configured" | "provider_unavailable" };
  title: string;
  summary: string;
  metaphor: {
    coreTitle: string;
    description: string;
    natureTheme: string;
  };
  sections: Array<{
    title: string;
    subtitle?: string;
    content: string;
    advice?: string;
  }>;
  luckyAdvice: {
    color: string;
    direction: string;
    mindset: string;
    item: string;
  };
}

export interface GuinPerson {
  id: string;
  name: string;
  relationType: "mentor" | "partner" | "supporter" | "grounding";
  relationTitle: string; // "길을 밝혀주는 등불", "마음을 받쳐주는 든든한 대지" 등
  birthDate?: string;
  calendarType?: CalendarType;
  solarBirthDate?: CalendarDate;
  dayMaster: string;
  elementMatch: string;
  affinityScore: number;
  advice: string;
  isMe?: boolean;
  // 기준서 v0.1: 3D 행성 4기둥 간지 조합
  pillars?: {
    dayKey: string;   // SLOT-D (주 표면 70%)
    monthKey: string; // SLOT-M (보조 표면 30%)
    yearKey: string;  // SLOT-Y (고리)
    hourKey?: string; // SLOT-H (위성)
  };
}

export interface GuinMapData {
  id: string;
  ownerName: string;
  ownerBirth: string;
  ownerCalendarType?: CalendarType;
  ownerSolarBirthDate?: CalendarDate;
  ownerDayMaster: string;
  ownerTheme: string;
  createdAt: string;
  guins: GuinPerson[];
}
