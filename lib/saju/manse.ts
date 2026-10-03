import { Gender, CalendarType, SajuPillar, FiveElementsCount, SajuAnalysis } from "./types";
import { parseSajuInput, parseSolarDate } from "./input";

const HEAVENLY_STEMS = [
  { ko: "갑", hanja: "甲", element: "wood" as const, elemKo: "목", yinYang: "yang" },
  { ko: "을", hanja: "乙", element: "wood" as const, elemKo: "목", yinYang: "yin" },
  { ko: "병", hanja: "丙", element: "fire" as const, elemKo: "화", yinYang: "yang" },
  { ko: "정", hanja: "丁", element: "fire" as const, elemKo: "화", yinYang: "yin" },
  { ko: "무", hanja: "戊", element: "earth" as const, elemKo: "토", yinYang: "yang" },
  { ko: "기", hanja: "己", element: "earth" as const, elemKo: "토", yinYang: "yin" },
  { ko: "경", hanja: "庚", element: "metal" as const, elemKo: "금", yinYang: "yang" },
  { ko: "신", hanja: "辛", element: "metal" as const, elemKo: "금", yinYang: "yin" },
  { ko: "임", hanja: "壬", element: "water" as const, elemKo: "수", yinYang: "yang" },
  { ko: "계", hanja: "癸", element: "water" as const, elemKo: "수", yinYang: "yin" },
];

const EARTHLY_BRANCHES = [
  { ko: "자", hanja: "子", element: "water" as const, elemKo: "수", animal: "쥐", yinYang: "yang" },
  { ko: "축", hanja: "丑", element: "earth" as const, elemKo: "토", animal: "소", yinYang: "yin" },
  { ko: "인", hanja: "寅", element: "wood" as const, elemKo: "목", animal: "호랑이", yinYang: "yang" },
  { ko: "묘", hanja: "卯", element: "wood" as const, elemKo: "목", animal: "토끼", yinYang: "yin" },
  { ko: "진", hanja: "辰", element: "earth" as const, elemKo: "토", animal: "용", yinYang: "yang" },
  { ko: "사", hanja: "巳", element: "fire" as const, elemKo: "화", animal: "뱀", yinYang: "yin" },
  { ko: "오", hanja: "午", element: "fire" as const, elemKo: "화", animal: "말", yinYang: "yang" },
  { ko: "미", hanja: "未", element: "earth" as const, elemKo: "토", animal: "양", yinYang: "yin" },
  { ko: "신", hanja: "申", element: "metal" as const, elemKo: "금", animal: "원숭이", yinYang: "yang" },
  { ko: "유", hanja: "酉", element: "metal" as const, elemKo: "금", animal: "닭", yinYang: "yin" },
  { ko: "술", hanja: "戌", element: "earth" as const, elemKo: "토", animal: "개", yinYang: "yang" },
  { ko: "해", hanja: "亥", element: "water" as const, elemKo: "수", animal: "돼지", yinYang: "yin" },
];

// 일간 비유 사전
const DAY_MASTER_METAPHORS: Record<string, { title: string; desc: string }> = {
  갑: {
    title: "곧게 뻗은 아름드리 당산나무",
    desc: "뿌리 깊고 정직하며, 우직하게 성장하여 주변 사람들에게 시원한 그늘과 기댈 곳을 내어주는 큰 나무의 기운입니다.",
  },
  을: {
    title: "바람에 흔들려도 꺾이지 않는 푸른 들꽃과 덩굴",
    desc: "유연하고 강인한 생명력으로 척박한 바위틈도 푸르게 채우며, 주변과 조화롭게 어울리며 피어나는 봄꽃의 기운입니다.",
  },
  병: {
    title: "온 세상을 따스하게 비추는 찬란한 태양",
    desc: "가식이 없고 솔직하며, 숨김없이 온기를 나누고 스스로 빛을 발하여 주변의 어둠을 밝혀주는 태양의 기운입니다.",
  },
  정: {
    title: "어두운 밤길을 밝혀주는 따뜻한 등불과 촛불",
    desc: "겉으로는 은은하지만 내면에 강한 열정을 품고 있으며, 타인을 세심하게 비추고 마음을 녹여주는 온화한 등불의 기운입니다.",
  },
  무: {
    title: "모든 것을 품어 안는 장엄하고 굳건한 태산",
    desc: "쉽게 흔들리지 않는 묵직한 신뢰감과 무게감으로, 온갖 생명을 품어주고 넉넉하게 지켜주는 대지의 기운입니다.",
  },
  기: {
    title: "만물을 싹틔우고 보듬는 비옥한 전답과 정원",
    desc: "부드럽고 포용력이 넘치며, 세심한 손길로 사람들의 재능과 마음을 소중하게 길러내는 영양가 높은 흙의 기운입니다.",
  },
  경: {
    title: "단단하고 결단력 있는 바위산과 거대한 원석",
    desc: "결단력과 의리가 돋보이며, 불의에 굴하지 않고 뚝심 있게 단련하여 세상을 바꿀 명검으로 거듭나는 기운입니다.",
  },
  신: {
    title: "섬세하고 예리하게 빛나는 눈부신 보석",
    desc: "남다른 감각과 예리한 통찰력을 지녔으며, 정교하고 순수한 완성도를 추구하는 아름다운 보석의 기운입니다.",
  },
  임: {
    title: "유유히 흘러 바다로 향하는 깊고 너른 강물",
    desc: "끝없는 지혜와 유연한 사고력을 지녔으며, 어떤 장애물도 에둘러 포용하며 큰 뜻을 향해 나아가는 대양의 기운입니다.",
  },
  계: {
    title: "만물을 촉촉이 적시는 맑은 이슬비와 옹달샘",
    desc: "조용히 스며들어 타인의 갈증을 채워주고, 섬세한 영감과 순수한 온기로 사람의 마음을 맑게 씻어주는 이슬의 기운입니다.",
  },
};

// 십신 계산
function getShipshin(dayStemKo: string, targetStemKo: string): string {
  const day = HEAVENLY_STEMS.find((s) => s.ko === dayStemKo)!;
  const target = HEAVENLY_STEMS.find((s) => s.ko === targetStemKo)!;

  const elementsOrder = ["wood", "fire", "earth", "metal", "water"];
  const dayIdx = elementsOrder.indexOf(day.element);
  const targetIdx = elementsOrder.indexOf(target.element);
  const diff = (targetIdx - dayIdx + 5) % 5;
  const isSameYinYang = day.yinYang === target.yinYang;

  if (diff === 0) return isSameYinYang ? "비견" : "겁재";
  if (diff === 1) return isSameYinYang ? "식신" : "상관";
  if (diff === 2) return isSameYinYang ? "편재" : "정재";
  if (diff === 3) return isSameYinYang ? "편관" : "정관";
  if (diff === 4) return isSameYinYang ? "편인" : "정인";
  return "비견";
}

function getBranchMainStem(branchKo: string): string {
  const branchStems: Record<string, string> = {
    자: "계",
    축: "기",
    인: "갑",
    묘: "을",
    진: "무",
    사: "병",
    오: "정",
    미: "기",
    신: "경",
    유: "신",
    술: "무",
    해: "임",
  };
  return branchStems[branchKo] || "갑";
}

// 율리우스 일수(Julian Day) 기반 정확한 일주 계산 (1900년 ~ 2100년 완전 지원)
function getJulianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

// 일주 계산: 기준일 (2000-01-01 = 戊午 / 54번째 갑자)
function calculateDayPillar(year: number, month: number, day: number): { stemIdx: number; branchIdx: number } {
  const jd = getJulianDay(year, month, day);
  // 2000-01-01 JD = 2451544.5, 戊(4) 午(6)
  const baseJd = 2451544.5;
  const diffDays = Math.round(jd - baseJd);
  
  const stemIdx = (((4 + diffDays) % 10) + 10) % 10;
  const branchIdx = (((6 + diffDays) % 12) + 12) % 12;
  return { stemIdx, branchIdx };
}

// 월주 계산 (절기 대략 기준: 2월4일경 입춘 기준)
function calculateMonthPillar(year: number, month: number, day: number, yearStemIdx: number): { stemIdx: number; branchIdx: number } {
  // 절기 입절 대략 날짜 (1월 소한 1.6, 2월 입춘 2.4, 3월 경칩 3.6, 4월 청명 4.5, ...)
  const solarTermDays = [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7];
  let solarMonth = month;
  if (day < solarTermDays[month - 1]) {
    solarMonth -= 1;
  }
  if (solarMonth === 0) solarMonth = 12;

  // 월 지지: 2월(입춘)=인(寅, idx 2), 3월=묘(3), ... 1월=축(1), 12월=자(0)
  // 인월(2) = 1번째 월
  const monthBranchIdx = (solarMonth % 12); // 인월은 solarMonth=2일 때 인(2), 3일 때 묘(3) ...

  // 월간 도출 (연두법: 甲己년 -> 丙寅월 시작, 乙庚년 -> 戊寅월 시작 등)
  const baseMonthStemByYearStem = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0]; // 갑/기=병, 을/경=무, 병/신=경, 정/임=임, 무/계=갑
  const monthOffset = (solarMonth >= 2 ? solarMonth - 2 : solarMonth + 10);
  const monthStemIdx = (baseMonthStemByYearStem[yearStemIdx] + monthOffset) % 10;

  return { stemIdx: monthStemIdx, branchIdx: monthBranchIdx };
}

// 시주 계산 (일두법 + 한국 동경 127.5도 진태양시 30분 시차 보정)
function calculateHourPillar(
  dayStemIdx: number,
  hour: number,
  minute: number = 0,
  applyKoreaTimezoneCorrection: boolean = true
): { stemIdx: number; branchIdx: number } {
  const totalMinutes = hour * 60 + minute;
  let branchIdx = 0;
  let effectiveDayStemIdx = dayStemIdx;

  if (applyKoreaTimezoneCorrection) {
    // 한국 표준시(동경 135도)와 서울 실제 태양시(동경 127.5도) 사이의 30분 시차 보정
    // 자시(23:30 ~ 01:29), 축시(01:30 ~ 03:29), 인시(03:30 ~ 05:29) ... 해시(21:30 ~ 23:29)
    if (totalMinutes >= 23 * 60 + 30) {
      branchIdx = 0; // 자시 (야자시)
      effectiveDayStemIdx = (dayStemIdx + 1) % 10; // 23:30 이후는 다음날 일간의 자시 기운 적용
    } else if (totalMinutes < 1 * 60 + 30) {
      branchIdx = 0; // 자시 (조자시)
    } else {
      const adjusted = totalMinutes - 90; // 01:30 -> 0분 기준
      branchIdx = Math.floor(adjusted / 120) + 1;
      branchIdx = Math.min(11, Math.max(0, branchIdx));
    }
  } else {
    // 미보정 일반 2시간 분할
    branchIdx = Math.floor(((hour + 1) % 24) / 2);
  }

  // 일두법: 갑기일 -> 갑자시, 을경일 -> 병자시, 병신일 -> 무자시, 정임일 -> 경자시, 무계일 -> 임자시
  const baseHourStem = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
  const stemIdx = (baseHourStem[effectiveDayStemIdx] + branchIdx) % 10;
  return { stemIdx, branchIdx };
}

export function analyzeSaju(params: {
  name: string;
  gender: Gender;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  isUnknownTime?: boolean;
  calendarType?: CalendarType;
}): SajuAnalysis {
  const {
    name,
    gender,
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    birthMinute,
    isUnknownTime = false,
    calendarType = "solar",
    solarBirthDate,
  } = parseSajuInput(params);
  const { year: solarYear, month: solarMonth, day: solarDay } = solarBirthDate;

  // 1. 연주 계산 (2월 4일 입춘 이전 출생이면 전년도 간지 적용)
  let sajuYear = solarYear;
  if (solarMonth < 2 || (solarMonth === 2 && solarDay < 4)) {
    sajuYear -= 1;
  }
  // 1984년 = 갑자년 (stem: 0, branch: 0)
  const yearOffset = sajuYear - 1984;
  const yearStemIdx = (((yearOffset % 10) + 10) % 10);
  const yearBranchIdx = (((yearOffset % 12) + 12) % 12);

  // 2. 월주 계산
  const { stemIdx: monthStemIdx, branchIdx: monthBranchIdx } = calculateMonthPillar(
    solarYear,
    solarMonth,
    solarDay,
    yearStemIdx
  );

  // 3. 일주 계산
  const { stemIdx: dayStemIdx, branchIdx: dayBranchIdx } = calculateDayPillar(
    solarYear,
    solarMonth,
    solarDay
  );

  const dayStem = HEAVENLY_STEMS[dayStemIdx];
  const dayBranch = EARTHLY_BRANCHES[dayBranchIdx];

  // 기둥 객체 빌더
  const makePillar = (stemI: number, branchI: number): SajuPillar => {
    const s = HEAVENLY_STEMS[stemI];
    const b = EARTHLY_BRANCHES[branchI];
    return {
      gan: s.ko,
      ji: b.ko,
      ganHanja: s.hanja,
      jiHanja: b.hanja,
      ganElement: s.element,
      jiElement: b.element,
      ganElementName: s.elemKo,
      jiElementName: b.elemKo,
      shipshinGan: getShipshin(dayStem.ko, s.ko),
      shipshinJi: getShipshin(dayStem.ko, getBranchMainStem(b.ko)),
    };
  };

  const yearPillar = makePillar(yearStemIdx, yearBranchIdx);
  const monthPillar = makePillar(monthStemIdx, monthBranchIdx);
  const dayPillar = makePillar(dayStemIdx, dayBranchIdx);

  let hourPillar: SajuPillar | undefined = undefined;
  if (!isUnknownTime && birthHour !== undefined) {
    const { stemIdx: hStem, branchIdx: hBranch } = calculateHourPillar(
      dayStemIdx,
      birthHour,
      birthMinute || 0,
      true
    );
    hourPillar = makePillar(hStem, hBranch);
  }

  // 4. 오행 카운트
  const elementsCount: FiveElementsCount = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const pillars = [yearPillar, monthPillar, dayPillar];
  if (hourPillar) pillars.push(hourPillar);

  pillars.forEach((p) => {
    elementsCount[p.ganElement] += 1;
    elementsCount[p.jiElement] += 1;
  });

  const elementNames: Record<string, string> = { wood: "목(木)", fire: "화(火)", earth: "토(土)", metal: "금(金)", water: "수(水)" };
  let maxCount = -1;
  let dominantKey = "fire";
  let minCount = 99;
  let lackingKey = "water";

  (Object.keys(elementsCount) as Array<keyof FiveElementsCount>).forEach((k) => {
    if (elementsCount[k] > maxCount) {
      maxCount = elementsCount[k];
      dominantKey = k;
    }
    if (elementsCount[k] < minCount) {
      minCount = elementsCount[k];
      lackingKey = k;
    }
  });

  // 격국 & 용신 간단 도출
  const monthShipshin = monthPillar.shipshinJi;
  const patternName = monthShipshin ? `${monthShipshin}격` : "정인격";
  const yongshin = elementNames[lackingKey] || "수(水)";

  // 대운 수 (1~10 대략 계산)
  const daewunNumber = ((solarDay % 9) + 1);
  const daewunList = Array.from({ length: 8 }).map((_, i) => {
    const age = daewunNumber + i * 10;
    const gIdx = (monthStemIdx + (gender === "male" ? i + 1 : -(i + 1)) + 20) % 10;
    const bIdx = (monthBranchIdx + (gender === "male" ? i + 1 : -(i + 1)) + 24) % 12;
    return {
      age,
      ganji: `${HEAVENLY_STEMS[gIdx].ko}${EARTHLY_BRANCHES[bIdx].ko}(${HEAVENLY_STEMS[gIdx].hanja}${EARTHLY_BRANCHES[bIdx].hanja})`,
    };
  });

  const metaphor = DAY_MASTER_METAPHORS[dayStem.ko] || {
    title: `${dayStem.ko}의 기운`,
    desc: "자신만의 고유한 빛깔로 세상과 소통하는 귀한 기운입니다.",
  };

  return {
    name,
    gender,
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    birthMinute,
    isUnknownTime,
    calendarType,
    solarBirthDate,
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar,
    elementsCount,
    dominantElement: elementNames[dominantKey],
    lackingElement: elementNames[lackingKey],
    dayMaster: `${dayStem.hanja}${dayBranch.hanja} (${dayStem.ko}${dayBranch.ko})`,
    dayMasterMetaphor: metaphor.title,
    patternName,
    yongshin,
    daewunNumber,
    daewunList,
  };
}

// 오늘의 일진(日辰) 계산 함수
export function getDailyPillar(year: number, month: number, day: number) {
  parseSolarDate(year, month, day);
  const { stemIdx, branchIdx } = calculateDayPillar(year, month, day);
  const stem = HEAVENLY_STEMS[stemIdx];
  const branch = EARTHLY_BRANCHES[branchIdx];
  return {
    gan: stem.ko,
    ji: branch.ko,
    ganHanja: stem.hanja,
    jiHanja: branch.hanja,
    element: stem.element,
    elemKo: stem.elemKo,
    name: `${stem.ko}${branch.ko} (${stem.hanja}${branch.hanja})`,
  };
}
