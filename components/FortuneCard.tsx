"use client";

import React, { useState } from "react";
import { FortuneResult } from "@/lib/saju/types";
import { MessageCircle, Compass } from "lucide-react";
import AskDoryeongModal from "./AskDoryeongModal";

interface FortuneCardProps {
  fortune: FortuneResult;
}

const ELEMENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  wood: { bg: "bg-emerald-100 text-emerald-800 border-emerald-300", text: "text-emerald-700", label: "목(木)" },
  fire: { bg: "bg-rose-100 text-rose-800 border-rose-300", text: "text-rose-700", label: "화(火)" },
  earth: { bg: "bg-amber-100 text-amber-800 border-amber-300", text: "text-amber-700", label: "토(土)" },
  metal: { bg: "bg-slate-100 text-slate-800 border-slate-300", text: "text-slate-700", label: "금(金)" },
  water: { bg: "bg-blue-100 text-blue-800 border-blue-300", text: "text-blue-700", label: "수(水)" },
};

export default function FortuneCard({ fortune }: FortuneCardProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const a = fortune.analysis;

  const pillars = [
    { label: "시주(時柱)", p: a.hourPillar, empty: !a.hourPillar },
    { label: "일주(日柱)", p: a.dayPillar, isDayMaster: true },
    { label: "월주(月柱)", p: a.monthPillar },
    { label: "연주(年柱)", p: a.yearPillar },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 1. 상단 타이틀 & 비유 배너 */}
      <div className="rounded-[28px] bg-gradient-to-br from-doryeong-navy to-doryeong-navyLight text-white p-6 shadow-doryeong relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-doryeong-gold/20 blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <span className="inline-block px-3 py-1 rounded-full bg-doryeong-gold/20 border border-doryeong-gold/40 text-[11px] font-bold text-doryeong-gold mb-3">
            나의 사주 이야기
          </span>
          <h2 className="font-serif text-2xl font-bold leading-tight">
            {fortune.title}
          </h2>
          <p className="mt-3 text-sm text-white/80 leading-relaxed font-serif">
            &quot;{fortune.summary}&quot;
          </p>
        </div>
      </div>

      {/* 2. 만세력 사주 원국표 (4주 8자) */}
      <div className="rounded-[24px] bg-white border border-doryeong-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="min-w-0 font-serif text-base font-bold text-doryeong-navy">
            {a.name}님의 사주팔자 (四柱)
          </h3>
          <span className="text-xs text-doryeong-textMuted">
            {a.birthYear}.{a.birthMonth}.{a.birthDay} ({a.calendarType === "solar" ? "양력" : a.calendarType === "leap-lunar" ? "음력 윤달" : "음력 평달"})
          </span>
        </div>

        {a.calendarType !== "solar" && a.solarBirthDate && (
          <p className="mb-3 text-xs text-doryeong-textMuted">
            양력 환산: {a.solarBirthDate.year}.{a.solarBirthDate.month}.{a.solarBirthDate.day} · 기둥 계산 기준
          </p>
        )}
        {a.calendarType !== "solar" && !a.solarBirthDate && (
          <p role="status" className="mb-3 text-xs text-amber-800">
            이전 음력 결과에는 양력 환산 정보가 없습니다. 정확한 날짜 적용을 위해 다시 계산해주세요.
          </p>
        )}

        <div className="grid grid-cols-4 gap-2 text-center">
          {pillars.map((item, idx) => (
            <div
              key={idx}
              className={`rounded-2xl border p-2 flex flex-col items-center ${
                item.isDayMaster
                  ? "border-doryeong-gold bg-doryeong-ivory shadow-sm ring-1 ring-doryeong-gold/40"
                  : "border-doryeong-border/70 bg-doryeong-ivory/30"
              }`}
            >
              <span className="text-[10px] font-semibold text-doryeong-textMuted mb-1">
                {item.label}
              </span>

              {item.p ? (
                <>
                  {/* 천간 */}
                  <div
                    className={`w-full py-1.5 rounded-lg border text-sm font-serif font-bold ${
                      ELEMENT_COLORS[item.p.ganElement]?.bg
                    }`}
                  >
                    <span className="text-base">{item.p.ganHanja}</span>
                    <span className="text-[10px] block opacity-80">{item.p.gan}</span>
                  </div>

                  <span className="text-[9px] text-doryeong-textMuted py-0.5 font-medium">
                    {item.p.shipshinGan}
                  </span>

                  {/* 지지 */}
                  <div
                    className={`w-full py-1.5 rounded-lg border text-sm font-serif font-bold mt-0.5 ${
                      ELEMENT_COLORS[item.p.jiElement]?.bg
                    }`}
                  >
                    <span className="text-base">{item.p.jiHanja}</span>
                    <span className="text-[10px] block opacity-80">{item.p.ji}</span>
                  </div>

                  <span className="text-[9px] text-doryeong-textMuted py-0.5 font-medium">
                    {item.p.shipshinJi}
                  </span>
                </>
              ) : (
                <div className="py-6 text-xs text-doryeong-textSubtle font-medium">
                  시간 미상
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 오행 분포 바 */}
        <div className="mt-4 pt-4 border-t border-doryeong-border/50">
          <div className="flex items-center justify-between text-xs font-semibold text-doryeong-textDark mb-1.5">
            <span>내 사주의 오행 밸런스</span>
            <span className="text-doryeong-gold font-bold">
              격국: {a.patternName} / 용신: {a.yongshin}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="block font-bold">목(木)</span>
              <span>{a.elementsCount.wood}개</span>
            </div>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
              <span className="block font-bold">화(火)</span>
              <span>{a.elementsCount.fire}개</span>
            </div>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <span className="block font-bold">토(土)</span>
              <span>{a.elementsCount.earth}개</span>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-50 text-slate-800 border border-slate-200">
              <span className="block font-bold">금(金)</span>
              <span>{a.elementsCount.metal}개</span>
            </div>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
              <span className="block font-bold">수(水)</span>
              <span>{a.elementsCount.water}개</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 비유 설명 카드 */}
      <div className="rounded-[24px] bg-[#FAF6EC] border-2 border-doryeong-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-doryeong-gold text-white text-xs font-bold">
            ★
          </span>
          <h4 className="font-serif text-lg font-bold text-doryeong-navy">
            {fortune.metaphor.coreTitle}
          </h4>
        </div>
        <p className="text-sm leading-relaxed text-doryeong-textMuted font-serif">
          {fortune.metaphor.description}
        </p>
      </div>

      {/* 4. 도령의 심층 풀이 섹션들 */}
      <div className="space-y-4">
        {fortune.sections.map((sec, idx) => (
          <div
            key={idx}
            className="rounded-[24px] bg-white border border-doryeong-border p-5 shadow-sm space-y-2"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-serif text-base font-bold text-doryeong-navy">
                  {sec.title}
                </h4>
                {sec.subtitle && (
                  <p className="text-xs text-doryeong-gold font-medium mt-0.5">
                    {sec.subtitle}
                  </p>
                )}
              </div>
            </div>

            <p className="text-sm leading-[1.8] text-doryeong-textDark/90 whitespace-pre-line pt-1">
              {sec.content}
            </p>

            {sec.advice && (
              <div className="mt-3 rounded-xl bg-doryeong-ivoryDark/60 p-3 border-l-4 border-doryeong-gold">
                <p className="text-xs font-serif text-doryeong-textMuted leading-relaxed">
                  💡 <strong className="text-doryeong-navy font-bold">돌아볼 점:</strong> {sec.advice}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 5. 생활 속 개운 처방전 */}
      <div className="rounded-[24px] bg-white border border-doryeong-border p-5 shadow-sm">
        <h4 className="font-serif text-base font-bold text-doryeong-navy mb-3 flex items-center gap-2">
          <Compass className="h-4 w-4 text-doryeong-gold" />
          <span>일상에서 실천하기</span>
        </h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-doryeong-ivory border border-doryeong-border">
            <span className="font-bold text-doryeong-textMuted block">나를 돕는 색상</span>
            <span className="font-semibold text-doryeong-navy mt-1 block">
              {fortune.luckyAdvice.color}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-doryeong-ivory border border-doryeong-border">
            <span className="font-bold text-doryeong-textMuted block">기운을 얻는 방위</span>
            <span className="font-semibold text-doryeong-navy mt-1 block">
              {fortune.luckyAdvice.direction}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-doryeong-ivory border border-doryeong-border col-span-2">
            <span className="font-bold text-doryeong-textMuted block">마음가짐 처방</span>
            <span className="font-semibold text-doryeong-navy mt-1 block">
              &quot;{fortune.luckyAdvice.mindset}&quot;
            </span>
          </div>
        </div>
      </div>

      {/* 6. 도령에게 물어보기 버튼 (질문권 인터랙션) */}
      <div className="pt-2">
        <button
          onClick={() => setIsChatOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isChatOpen}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-doryeong-navy to-doryeong-navyLight text-white font-serif font-bold text-base shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5 text-doryeong-gold" />
          <span>풀이에 관해 더 물어보기</span>
        </button>
        <p className="text-center text-[11px] text-doryeong-textMuted mt-2">
          저장된 풀이를 바탕으로 대화를 이어가세요. 현재 답변은 기본 문구로 제공됩니다.
        </p>
      </div>

      {/* 챗봇 모달 */}
      <AskDoryeongModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        fortune={fortune}
      />
    </div>
  );
}
