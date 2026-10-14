"use client";

import React, { useEffect, useRef } from "react";
import { SIXTY_GANZI_KEYS } from "@/lib/planet/theme-library";
import { collectGanziKeys, getGanziMascot } from "@/lib/planet/ganzi-mascot";
import GanziMascotImage from "./GanziMascotImage";
import { GuinPerson } from "@/lib/saju/types";
import { X, Sparkles, Trophy, CheckCircle2, Lock } from "lucide-react";

interface GalaxyPokedexModalProps {
  guins: GuinPerson[];
  isOpen: boolean;
  onClose: () => void;
}

export default function GalaxyPokedexModal({
  guins,
  isOpen,
  onClose,
}: GalaxyPokedexModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus({ preventScroll: true });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || [])
          .filter(control => control.getClientRects().length > 0);
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const collectedKeys = collectGanziKeys(guins.map(person => person.pillars?.dayKey));
  const totalCollected = collectedKeys.size;
  const planetCount = guins.length;

  // 은하 레벨 계산
  let level = 1;
  let levelName = "Level 1 · 성간 원시 성단 (Proto Cluster)";
  let levelDesc = "나의 중심별과 인연들이 태동하는 작은 성단입니다.";
  let nextGoal = "행성 3개 수집 시 '나선 은하'로 진화!";

  if (planetCount >= 6) {
    level = 3;
    levelName = "Level 3 · 4대 나선팔 대은하 (Grand 4-Arm Galaxy)";
    levelDesc = "황금빛 은하핵과 42,000개 항성이 찬란하게 회전하는 완성형 대은하입니다!";
    nextGoal = "최고 등급 은하 달성! 마스코트 도감 60종을 만나보세요.";
  } else if (planetCount >= 3) {
    level = 2;
    levelName = "Level 2 · 2중 나선 은하 (Spiral Galaxy)";
    levelDesc = "중력과 인연선이 균형을 이루며 유려하게 회전하는 나선은하입니다.";
    nextGoal = "행성 6개 달성 시 '4대 나선팔 대은하'로 레벨업!";
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label="60간지 우주 도감"
        className="relative my-auto w-full max-w-lg bg-gradient-to-b from-[#0B132B] via-[#1C2541] to-[#0A0F1D] border border-doryeong-gold/30 rounded-[36px] p-6 text-white shadow-2xl space-y-6 max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-doryeong-gold/20 text-doryeong-gold">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-serif font-bold text-lg text-doryeong-gold">
                60간지 마스코트 도감
              </h3>
              <p className="text-xs text-white/60 font-mono">
                COLLECTED MASCOTS: {totalCollected} / 60
              </p>
            </div>
          </div>
          <button
            ref={closeButton}
            onClick={onClose}
            aria-label="도감 닫기"
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 은하 레벨업 게이미피케이션 카드 */}
        <div className="rounded-3xl bg-gradient-to-r from-amber-950/60 via-black/60 to-purple-950/60 border border-doryeong-gold/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-doryeong-gold flex items-center gap-1.5 font-serif">
              <Sparkles className="h-3.5 w-3.5 text-doryeong-gold" />
              <span>{levelName}</span>
            </span>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-doryeong-gold/20 text-doryeong-gold border border-doryeong-gold/30">
              행성 {planetCount}개 안착
            </span>
          </div>

          <p className="text-xs text-white/80 leading-relaxed">
            {levelDesc}
          </p>

          <div className="pt-2">
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (planetCount / 6) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-doryeong-gold font-mono mt-1 text-right">
              {nextGoal}
            </p>
          </div>
        </div>

        {/* 기존 전체 간지 순서를 유지하는 60종 컬렉션 */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white/90 font-serif flex items-center gap-1">
            <span>나의 은하에 모인 마스코트</span>
            <span className="text-doryeong-gold">({totalCollected}/60)</span>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {SIXTY_GANZI_KEYS.map((pillar) => {
              const mascot = getGanziMascot(pillar.key)!;
              const isDiscovered = collectedKeys.has(pillar.key);

              return (
                <div
                  key={pillar.key}
                  data-ganzi-card={pillar.key}
                  className={`rounded-2xl p-3 border transition-all text-left flex flex-col justify-between ${
                    isDiscovered
                      ? "bg-white/10 border-doryeong-gold/50 shadow-md"
                      : "bg-black/40 border-white/5 opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-lg text-white font-serif"
                      style={{ backgroundColor: isDiscovered ? "#527645" : "#334155" }}
                    >
                      {pillar.key} ({pillar.hanja})
                    </span>
                    {isDiscovered ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-white/30" />
                    )}
                  </div>

                  <GanziMascotImage dayKey={pillar.key} thumbnail className="mascot-collection-portrait"/>

                  <div className="my-2">
                    <p className="text-xs font-bold text-white truncate font-serif">
                      {mascot.title}
                    </p>
                    <p className="text-[10px] text-white/60 truncate">
                      {isDiscovered ? "나의 은하에서 만났어요." : "아직 만나지 않은 마스코트"}
                    </p>
                  </div>

                  <div className="text-[9.5px] text-doryeong-gold/90 font-mono">
                    {mascot.polarity === "yang" ? "양" : "음"} · {mascot.animalLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
