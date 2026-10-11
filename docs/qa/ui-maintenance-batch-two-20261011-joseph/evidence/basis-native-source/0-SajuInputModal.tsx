"use client";

import { readApiResponse } from "@/lib/http-client";


import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";

import { HOUR_PERIODS } from "@/lib/saju/input";
import { FortuneResult } from "@/lib/saju/types";

interface SajuInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: string;
  categoryTitle?: string;
  onSuccess?: (fortune: FortuneResult) => void;
}

export default function SajuInputModal({
  isOpen,
  onClose,
  category = "overall",
  categoryTitle = "내 사주 풀이",
  onSuccess,
}: SajuInputModalProps) {
  
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendarType, setCalendarType] = useState<"solar" | "lunar" | "leap-lunar">("solar");
  const [birthYear, setBirthYear] = useState("1995");
  const [birthMonth, setBirthMonth] = useState("5");
  const [birthDay, setBirthDay] = useState("15");
  const [birthHour, setBirthHour] = useState("13");
  const [isUnknownTime, setIsUnknownTime] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    setLoading(true);
    setLoadingStep(1); // 1. 만세력 사주팔자 계산 중

    const timer = setTimeout(() => {
      setLoadingStep(2); // 2. 도령 청명이가 비유로 풀어내는 중
    }, 900);

    try {
      const res = await fetch("/api/saju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          calendarType,
          birthYear: Number(birthYear),
          birthMonth: Number(birthMonth),
          birthDay: Number(birthDay),
          birthHour: isUnknownTime ? undefined : Number(birthHour),
          birthMinute: isUnknownTime ? undefined : 30,
          isUnknownTime,
          category,
          customQuestion: customQuestion.trim() || undefined,
        }),
      });

      const data = await readApiResponse(res);

      if (data.success && data.fortune) {
        if (onSuccess) {
          onSuccess(data.fortune);
        } else {
          window.location.assign(`/saved?id=${data.fortune.id}`);
        }
        onClose();
      } else {
        alert(data.error || "풀이 중 문제가 발생했습니다.");
      }
    } catch (err: any) {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setLoadingStep(0);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-doryeong-ivory rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-doryeong-border flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-doryeong-border/60">
          <div>
            <span className="text-[11px] font-bold text-doryeong-gold tracking-widest uppercase">
              나의 사주 정보
            </span>
            <h2 className="text-xl font-serif font-bold text-doryeong-navy">
              {categoryTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-doryeong-textMuted hover:bg-black/5 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Body / Loading State */}
        {loading ? (
          <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full border-4 border-doryeong-gold/30 border-t-doryeong-navy animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-doryeong-navy">
                <Sparkles className="h-6 w-6 text-doryeong-gold animate-pulse" />
              </div>
            </div>
            <h3 className="font-serif text-lg font-bold text-doryeong-navy">
              {loadingStep === 1
                ? "사주 4주와 오행을 정밀하게 계산하고 있습니다..."
                : "입력한 사주 구성으로 해석을 정리하고 있어요."}
            </h3>
            <p className="mt-2 text-xs text-doryeong-textMuted">
              조금만 기다려주시면 마음에 남는 풀이를 전해드립니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-4 space-y-4">
            {/* 이름 & 성별 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                  이름 (또는 닉네임)
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-doryeong-border bg-white text-sm focus:outline-none focus:border-doryeong-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                  성별
                </label>
                <div className="grid grid-cols-2 gap-1 bg-doryeong-ivoryDark p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setGender("male")}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      gender === "male"
                        ? "bg-white text-doryeong-navy shadow-sm"
                        : "text-doryeong-textMuted"
                    }`}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("female")}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      gender === "female"
                        ? "bg-white text-doryeong-navy shadow-sm"
                        : "text-doryeong-textMuted"
                    }`}
                  >
                    여성
                  </button>
                </div>
              </div>
            </div>

            {/* 양력 / 음력 구분 */}
            <div>
              <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                달력 구분
              </label>
              <div className="grid grid-cols-3 gap-2 bg-doryeong-ivoryDark p-1 rounded-xl text-xs font-bold">
                {[
                  { id: "solar", label: "양력" },
                  { id: "lunar", label: "음력 (평달)" },
                  { id: "leap-lunar", label: "음력 (윤달)" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCalendarType(item.id as any)}
                    className={`py-1.5 rounded-lg transition-all ${
                      calendarType === item.id
                        ? "bg-white text-doryeong-navy shadow-sm"
                        : "text-doryeong-textMuted"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-doryeong-textMuted">
                {calendarType === "solar"
                  ? "양력 입력: 1900~2100년"
                  : "한국 음력 입력: 1900.1.1~2050.11.18 · 윤달은 해당 연도에 실제로 있는 달만 선택해주세요."}
              </p>
            </div>

            {/* 생년월일 */}
            <div>
              <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                생년월일
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center rounded-xl border border-doryeong-border bg-white px-2 py-2">
                  <input
                    type="number"
                    required
                    min="1900"
                    max={calendarType === "solar" ? 2100 : 2050}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="w-full text-center text-sm font-semibold focus:outline-none"
                  />
                  <span className="text-xs text-doryeong-textMuted ml-1">년</span>
                </div>
                <div className="flex items-center rounded-xl border border-doryeong-border bg-white px-2 py-2">
                  <input
                    type="number"
                    required
                    min="1"
                    max="12"
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className="w-full text-center text-sm font-semibold focus:outline-none"
                  />
                  <span className="text-xs text-doryeong-textMuted ml-1">월</span>
                </div>
                <div className="flex items-center rounded-xl border border-doryeong-border bg-white px-2 py-2">
                  <input
                    type="number"
                    required
                    min="1"
                    max={calendarType === "solar" ? 31 : 30}
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className="w-full text-center text-sm font-semibold focus:outline-none"
                  />
                  <span className="text-xs text-doryeong-textMuted ml-1">일</span>
                </div>
              </div>
            </div>

            {/* 태어난 시간 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-doryeong-textDark">
                  태어난 시간
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-doryeong-textMuted">
                  <input
                    type="checkbox"
                    checked={isUnknownTime}
                    onChange={(e) => setIsUnknownTime(e.target.checked)}
                    className="rounded border-doryeong-border text-doryeong-navy"
                  />
                  <span>시간 모름</span>
                </label>
              </div>
              {!isUnknownTime ? (
                <div>
                  <select
                    value={birthHour}
                    onChange={(e) => setBirthHour(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-doryeong-border bg-white text-sm focus:outline-none focus:border-doryeong-navy"
                  >
                    {HOUR_PERIODS.map((period) => (
                      <option key={period.hour} value={period.hour}>{period.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-doryeong-textMuted">
                    각 시진의 시작 시각(30분)으로 계산합니다. 자시는 입력한 날짜의 23:30 기준입니다.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 text-xs text-doryeong-textMuted bg-doryeong-ivoryDark rounded-xl text-center">
                  시주를 제외한 삼주(년·월·일)를 기준으로 정확히 풀어드립니다.
                </div>
              )}
            </div>

            {/* 맞춤 질문 (선택) */}
            <div>
              <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                함께 살펴보고 싶은 이야기 (선택)
              </label>
              <textarea
                rows={2}
                placeholder="예: 올해 이직을 준비 중인데 흐름이 궁금해요."
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-doryeong-border bg-white text-xs focus:outline-none focus:border-doryeong-navy"
              />
            </div>

            {/* 안내 및 제출 버튼 */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-doryeong-navy text-white font-serif font-bold text-base shadow-lg hover:bg-doryeong-navyDark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4 text-doryeong-gold" />
                <span>나의 이야기 보기</span>
              </button>
              <p className="text-[11px] text-center text-doryeong-textMuted mt-2">
                결과는 자기 이해를 위한 참고이며, 미래를 확정하지 않습니다.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
