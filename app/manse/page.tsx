"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import { analyzeSaju } from "@/lib/saju/manse";
import { parseSajuInput } from "@/lib/saju/input";
import { SajuAnalysis, Gender } from "@/lib/saju/types";
import { BookOpen } from "lucide-react";

const ELEMENT_COLORS: Record<string, { bg: string; text: string; bar: string; name: string }> = {
  wood: { bg: "bg-emerald-50 border-emerald-300 text-emerald-800", text: "text-emerald-700", bar: "bg-emerald-500", name: "목(木)" },
  fire: { bg: "bg-rose-50 border-rose-300 text-rose-800", text: "text-rose-700", bar: "bg-rose-500", name: "화(火)" },
  earth: { bg: "bg-amber-50 border-amber-300 text-amber-800", text: "text-amber-700", bar: "bg-amber-500", name: "토(土)" },
  metal: { bg: "bg-slate-100 border-slate-300 text-slate-800", text: "text-slate-700", bar: "bg-slate-500", name: "금(金)" },
  water: { bg: "bg-blue-50 border-blue-300 text-blue-800", text: "text-blue-700", bar: "bg-blue-500", name: "수(水)" },
};

export default function MansePage() {
  const [name, setName] = useState("홍길동");
  const [gender, setGender] = useState<Gender>("male");
  const [year, setYear] = useState("1995");
  const [month, setMonth] = useState("5");
  const [day, setDay] = useState("15");
  const [hour, setHour] = useState("14");
  const [isUnknownTime, setIsUnknownTime] = useState(false);
  const [inputError, setInputError] = useState("");

  const [result, setResult] = useState<SajuAnalysis | null>(() => {
    return analyzeSaju(parseSajuInput({
      name: "홍길동",
      gender: "male",
      birthYear: 1995,
      birthMonth: 5,
      birthDay: 15,
      birthHour: 14,
      isUnknownTime: false,
    }));
  });

  const handleCalc = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError("");
    try {
      const res = analyzeSaju(parseSajuInput({
        name: name.trim() || "방문자",
        gender,
        birthYear: year,
        birthMonth: month,
        birthDay: day,
        birthHour: isUnknownTime ? undefined : hour,
        isUnknownTime,
      }));
      setResult(res);
    } catch (error) {
      setResult(null);
      setInputError(error instanceof Error ? error.message : "입력 정보를 확인해주세요.");
    }
  };

  const totalElements = result
    ? Object.values(result.elementsCount).reduce((acc, c) => acc + c, 0)
    : 8;

  return (
    <div className="min-h-screen pb-20">
      <Header />

      <div className="px-5 pt-2 space-y-6">
        {/* Top Banner */}
        <div className="rounded-[26px] bg-doryeong-navy text-white p-6 shadow-doryeong">
          <div className="flex items-center gap-2 text-doryeong-gold text-xs font-bold mb-2">
            <BookOpen className="h-4 w-4" />
            <span>정통 만세력 계산기</span>
          </div>
          <h2 className="font-serif text-2xl font-bold">내 사주 만세력</h2>
          <p className="mt-1 text-xs text-white/70">
            생년월일시와 성별을 입력하면 정밀 4주 8자와 10년 대운 흐름을 산출합니다.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleCalc} className="p-5 rounded-[24px] bg-white border border-doryeong-border space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-doryeong-border">
            <span className="text-xs font-serif font-bold text-doryeong-navy">사주 명식 입력</span>
            {/* Gender Toggle */}
            <div className="inline-flex rounded-lg bg-doryeong-ivory p-0.5 border border-doryeong-border text-xs">
              <button
                type="button"
                aria-pressed={gender === "male"}
                onClick={() => setGender("male")}
                className={`px-3 py-1 rounded-md font-bold transition-colors ${
                  gender === "male"
                    ? "bg-doryeong-navy text-white shadow-sm"
                    : "text-doryeong-textMuted hover:text-doryeong-textDark"
                }`}
              >
                남성 (乾命)
              </button>
              <button
                type="button"
                aria-pressed={gender === "female"}
                onClick={() => setGender("female")}
                className={`px-3 py-1 rounded-md font-bold transition-colors ${
                  gender === "female"
                    ? "bg-doryeong-navy text-white shadow-sm"
                    : "text-doryeong-textMuted hover:text-doryeong-textDark"
                }`}
              >
                여성 (坤命)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label htmlFor="manse-name" className="text-[10.5px] font-bold text-doryeong-textMuted block mb-1">이름</label>
              <input
                type="text"
                id="manse-name"
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-doryeong-border text-center bg-doryeong-ivory/50 focus:bg-white focus:border-doryeong-gold focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="manse-year" className="text-[10.5px] font-bold text-doryeong-textMuted block mb-1">태어난 년도</label>
              <input
                type="number"
                min={1900}
                max={2100}
                id="manse-year"
                required
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-doryeong-border text-center bg-doryeong-ivory/50 focus:bg-white focus:border-doryeong-gold focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="manse-month" className="text-[10.5px] font-bold text-doryeong-textMuted block mb-1">월</label>
              <input
                type="number"
                min={1}
                max={12}
                id="manse-month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-doryeong-border text-center bg-doryeong-ivory/50 focus:bg-white focus:border-doryeong-gold focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="manse-day" className="text-[10.5px] font-bold text-doryeong-textMuted block mb-1">일</label>
              <input
                type="number"
                min={1}
                max={31}
                id="manse-day"
                required
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-doryeong-border text-center bg-doryeong-ivory/50 focus:bg-white focus:border-doryeong-gold focus:outline-none"
              />
            </div>
          </div>

          {/* Hour & Unknown time */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 flex items-center gap-2">
              <label htmlFor="manse-hour" className="text-[10.5px] font-bold text-doryeong-textMuted shrink-0">태어난 시 (0~23시):</label>
              <input
                type="number"
                min={0}
                max={23}
                disabled={isUnknownTime}
                id="manse-hour"
                required
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="w-20 text-xs font-semibold px-2 py-1.5 rounded-lg border border-doryeong-border text-center bg-doryeong-ivory/50 disabled:opacity-40"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-doryeong-textMuted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isUnknownTime}
                onChange={(e) => setIsUnknownTime(e.target.checked)}
                className="rounded border-doryeong-border text-doryeong-navy"
              />
              <span>시간 모름 (3주만 풀이)</span>
            </label>
          </div>

          {inputError && <p role="alert" className="text-xs text-red-700">{inputError}</p>}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-doryeong-gold to-amber-500 text-doryeong-navy font-bold text-xs shadow-sm hover:brightness-105 active:scale-[0.99] transition-all"
          >
            정통 만세력 계산하기
          </button>
        </form>

        {/* 만세력 원국 표 */}
        {result && (
          <div className="rounded-[24px] bg-white border border-doryeong-border p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-doryeong-border">
              <div>
                <span className="font-serif font-bold text-base text-doryeong-navy block">
                  {result.name}님의 사주 원국표
                </span>
                <span className="text-[11px] text-doryeong-textMuted">
                  {result.gender === "male" ? "건명(乾命 · 남성)" : "곤명(坤命 · 여성)"} · {result.dayMasterMetaphor}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-doryeong-gold font-bold block">
                  일간: {result.dayMaster}
                </span>
                <span className="text-[10px] text-doryeong-textSubtle bg-doryeong-ivory px-2 py-0.5 rounded-full border border-doryeong-border">
                  격국: {result.patternName}
                </span>
              </div>
            </div>

            {/* 4주 8자 컬럼 */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "시주 (時柱)", p: result.hourPillar },
                { label: "일주 (日柱 · 나)", p: result.dayPillar, isDay: true },
                { label: "월주 (月柱)", p: result.monthPillar },
                { label: "연주 (年柱)", p: result.yearPillar },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-2xl border flex flex-col items-center ${
                    item.isDay
                      ? "bg-doryeong-ivory/80 border-doryeong-gold shadow-sm ring-1 ring-doryeong-gold/30"
                      : "bg-white border-doryeong-border"
                  }`}
                >
                  <span className="text-[10px] text-doryeong-textMuted mb-1 font-semibold">{item.label}</span>
                  {item.p ? (
                    <>
                      <div className={`w-full py-2 rounded-xl border text-base font-serif font-bold shadow-xs ${ELEMENT_COLORS[item.p.ganElement]?.bg}`}>
                        {item.p.ganHanja}
                        <span className="text-[10px] block font-sans opacity-75">{item.p.gan} ({item.p.ganElementName})</span>
                      </div>
                      <span className="text-[9.5px] font-medium text-doryeong-textMuted py-0.5">{item.p.shipshinGan}</span>
                      <div className={`w-full py-2 rounded-xl border text-base font-serif font-bold mt-1 shadow-xs ${ELEMENT_COLORS[item.p.jiElement]?.bg}`}>
                        {item.p.jiHanja}
                        <span className="text-[10px] block font-sans opacity-75">{item.p.ji} ({item.p.jiElementName})</span>
                      </div>
                      <span className="text-[9.5px] font-medium text-doryeong-textMuted py-0.5">{item.p.shipshinJi}</span>
                    </>
                  ) : (
                    <div className="py-10 text-xs text-doryeong-textSubtle">시간 미상</div>
                  )}
                </div>
              ))}
            </div>

            {/* 오행 분포 통계 */}
            <div className="pt-3 border-t border-doryeong-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-serif font-bold text-doryeong-navy">오행(五行) 에너지 분포</span>
                <span className="text-[11px] text-doryeong-textMuted">
                  우세: <strong className="text-rose-600 font-bold">{result.dominantElement}</strong> · 부족: <strong className="text-blue-600 font-bold">{result.lackingElement}</strong>
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center text-[11px]">
                {(["wood", "fire", "earth", "metal", "water"] as const).map((elem) => {
                  const count = result.elementsCount[elem];
                  const info = ELEMENT_COLORS[elem];
                  return (
                    <div key={elem} className={`p-2 rounded-xl border ${info.bg}`}>
                      <span className="font-bold block text-xs">{info.name}</span>
                      <span className="font-serif font-bold text-sm block mt-0.5">{count}개</span>
                      <div className="w-full bg-black/10 rounded-full h-1 mt-1 overflow-hidden">
                        <div
                          className={`h-full ${info.bar}`}
                          style={{ width: `${(count / totalElements) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 대운 표 */}
            <div className="pt-3 border-t border-doryeong-border space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-serif text-xs font-bold text-doryeong-navy">
                  10년 주기 대운(大運) 흐름
                </h4>
                <span className="text-[10px] text-doryeong-gold font-bold">
                  대운수 {result.daewunNumber} ({result.gender === "male" ? "건명 순행" : "곤명 역행"})
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                {result.daewunList.map((dw, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-doryeong-ivory/70 border border-doryeong-border hover:border-doryeong-gold/60 transition-colors">
                    <span className="text-[10px] font-bold text-doryeong-gold block">{dw.age}세~</span>
                    <span className="font-serif font-bold text-doryeong-navy text-sm block mt-0.5">{dw.ganji}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
