import type { CalendarDate, CalendarType, Gender } from "./types";
import { SajuInputError } from "./input-error";
import { koreanLunarToSolar } from "./lunar-calendar";
export { SajuInputError } from "./input-error";

export interface SajuInput {
  name: string;
  gender: Gender;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  isUnknownTime: boolean;
  calendarType: CalendarType;
  solarBirthDate: CalendarDate;
}

export function parseInputObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SajuInputError("입력 정보를 올바른 형식으로 보내주세요.");
  }
  return value as Record<string, unknown>;
}

export async function parseJsonBody(request: { json(): Promise<unknown> }) {
  let value: unknown;
  try {
    value = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw new SajuInputError("JSON 입력 형식을 확인해주세요.");
    throw error;
  }
  return parseInputObject(value);
}

function integer(value: unknown, label: string, min: number, max: number): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^\d+$/.test(value.trim()))
  ) {
    throw new SajuInputError(`${label}은(는) ${min}~${max} 사이의 정수로 입력해주세요.`);
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new SajuInputError(`${label}은(는) ${min}~${max} 사이의 정수로 입력해주세요.`);
  }
  return number;
}

export function parseSolarDate(year: unknown, month: unknown, day: unknown) {
  const birthYear = integer(year, "연도", 1900, 2100);
  const birthMonth = integer(month, "월", 1, 12);
  const birthDay = integer(day, "일", 1, 31);
  const daysInMonth = new Date(Date.UTC(birthYear, birthMonth, 0)).getUTCDate();
  if (birthDay > daysInMonth) {
    throw new SajuInputError("존재하지 않는 생년월일입니다. 날짜를 다시 확인해주세요.");
  }
  return { birthYear, birthMonth, birthDay };
}

export function parseSajuInput(value: unknown): SajuInput {
  const input = parseInputObject(value);
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 50) : "";
  if (!name) throw new SajuInputError("이름을 입력해주세요.");

  const gender = input.gender === undefined ? "male" : input.gender;
  if (gender !== "male" && gender !== "female") {
    throw new SajuInputError("성별 입력값을 확인해주세요.");
  }
  const calendarType = input.calendarType === undefined ? "solar" : input.calendarType;
  if (calendarType !== "solar" && calendarType !== "lunar" && calendarType !== "leap-lunar") {
    throw new SajuInputError("달력 구분 입력값을 확인해주세요.");
  }
  let date: { birthYear: number; birthMonth: number; birthDay: number };
  let solarBirthDate: CalendarDate;
  if (calendarType === "solar") {
    date = parseSolarDate(input.birthYear, input.birthMonth, input.birthDay);
    solarBirthDate = { year: date.birthYear, month: date.birthMonth, day: date.birthDay };
  } else {
    // A lunar month has 29 or 30 days, independently of the Gregorian month length.
    date = {
      birthYear: integer(input.birthYear, "연도", 1900, 2100),
      birthMonth: integer(input.birthMonth, "월", 1, 12),
      birthDay: integer(input.birthDay, "일", 1, 30),
    };
    if (date.birthYear * 10000 + date.birthMonth * 100 + date.birthDay > 20501118) {
      throw new SajuInputError("이 앱의 음력 입력은 1900년 1월 1일부터 2050년 11월 18일까지 지원합니다.", 422);
    }
    solarBirthDate = koreanLunarToSolar(
      { year: date.birthYear, month: date.birthMonth, day: date.birthDay },
      calendarType === "leap-lunar"
    );
  }
  if (input.isUnknownTime !== undefined && typeof input.isUnknownTime !== "boolean") {
    throw new SajuInputError("시간 모름 여부는 참 또는 거짓으로 입력해주세요.");
  }
  const isUnknownTime = input.isUnknownTime ?? (input.birthHour === undefined);
  const birthHour = isUnknownTime ? undefined : integer(input.birthHour, "시", 0, 23);
  const birthMinute = isUnknownTime ? undefined : integer(input.birthMinute === undefined ? 0 : input.birthMinute, "분", 0, 59);
  return { name, gender, calendarType, ...date, solarBirthDate, birthHour, birthMinute, isUnknownTime };
}

// Keep the existing fixed 30-minute correction. These are the displayed period starts.
export const HOUR_PERIODS = [
  { branch: "자", hour: 23, minute: 30, label: "자시 (23:30 ~ 01:29)" },
  { branch: "축", hour: 1, minute: 30, label: "축시 (01:30 ~ 03:29)" },
  { branch: "인", hour: 3, minute: 30, label: "인시 (03:30 ~ 05:29)" },
  { branch: "묘", hour: 5, minute: 30, label: "묘시 (05:30 ~ 07:29)" },
  { branch: "진", hour: 7, minute: 30, label: "진시 (07:30 ~ 09:29)" },
  { branch: "사", hour: 9, minute: 30, label: "사시 (09:30 ~ 11:29)" },
  { branch: "오", hour: 11, minute: 30, label: "오시 (11:30 ~ 13:29)" },
  { branch: "미", hour: 13, minute: 30, label: "미시 (13:30 ~ 15:29)" },
  { branch: "신", hour: 15, minute: 30, label: "신시 (15:30 ~ 17:29)" },
  { branch: "유", hour: 17, minute: 30, label: "유시 (17:30 ~ 19:29)" },
  { branch: "술", hour: 19, minute: 30, label: "술시 (19:30 ~ 21:29)" },
  { branch: "해", hour: 21, minute: 30, label: "해시 (21:30 ~ 23:29)" },
] as const;
