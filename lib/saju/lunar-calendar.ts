import KoreanLunarCalendar from "korean-lunar-calendar";
import { SajuInputError } from "./input-error";
import type { CalendarDate } from "./types";

// Pinned korean-lunar-calendar 0.4.0 data bounds. Conversion is entirely offline.
// These are conversion-table bounds, not the application's wider solar input range.
export const KOREAN_CALENDAR_RANGE = {
  lunarMin: { year: 1000, month: 1, day: 1 },
  lunarMax: { year: 2050, month: 11, day: 18 },
  solarMin: { year: 1000, month: 2, day: 13 },
  solarMax: { year: 2050, month: 12, day: 31 },
} as const;

const dateValue = (date: CalendarDate) => date.year * 10000 + date.month * 100 + date.day;

function validateDateParts(date: CalendarDate, maxDay: number) {
  if (!date || !Number.isInteger(date.year) || !Number.isInteger(date.month) ||
      !Number.isInteger(date.day) || date.month < 1 || date.month > 12 ||
      date.day < 1 || date.day > maxDay) {
    throw new SajuInputError("달력 변환 날짜를 올바른 정수로 입력해주세요.");
  }
}

export function koreanLunarToSolar(date: CalendarDate, isLeapMonth: boolean): CalendarDate {
  validateDateParts(date, 30);
  if (typeof isLeapMonth !== "boolean") throw new SajuInputError("윤달 여부를 확인해주세요.");
  if (dateValue(date) < dateValue(KOREAN_CALENDAR_RANGE.lunarMin) ||
      dateValue(date) > dateValue(KOREAN_CALENDAR_RANGE.lunarMax)) {
    throw new SajuInputError("음력 변환은 1000년 1월 1일부터 2050년 11월 18일까지 지원합니다.", 422);
  }
  const calendar = new KoreanLunarCalendar();
  if (!calendar.setLunarDate(date.year, date.month, date.day, isLeapMonth)) {
    throw new SajuInputError("존재하지 않는 음력 날짜 또는 윤달입니다. 평달·윤달과 날짜를 확인해주세요.");
  }
  const lunar = calendar.getLunarCalendar();
  if (lunar.year !== date.year || lunar.month !== date.month || lunar.day !== date.day ||
      Boolean(lunar.intercalation) !== isLeapMonth) {
    throw new SajuInputError("요청한 음력 날짜를 정확하게 변환할 수 없습니다.");
  }
  const { year, month, day } = calendar.getSolarCalendar();
  return { year, month, day };
}

export function koreanSolarToLunar(date: CalendarDate): CalendarDate & { isLeapMonth: boolean } {
  validateDateParts(date, 31);
  if (dateValue(date) < dateValue(KOREAN_CALENDAR_RANGE.solarMin) ||
      dateValue(date) > dateValue(KOREAN_CALENDAR_RANGE.solarMax)) {
    throw new SajuInputError("양력에서 음력으로의 변환은 1000년 2월 13일부터 2050년 12월 31일까지 지원합니다.", 422);
  }
  const calendar = new KoreanLunarCalendar();
  if (!calendar.setSolarDate(date.year, date.month, date.day)) {
    throw new SajuInputError("존재하지 않는 양력 날짜입니다.");
  }
  const { year, month, day, intercalation } = calendar.getLunarCalendar();
  return { year, month, day, isLeapMonth: Boolean(intercalation) };
}
