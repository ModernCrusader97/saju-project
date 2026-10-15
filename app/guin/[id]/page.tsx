"use client";
import Link from "next/link";

import { readApiResponse } from "@/lib/http-client";


import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import { restoreGalaxyUniverse } from "@/lib/universe-state";
import Header from "@/components/Header";
import { GuinMapData, GuinPerson } from "@/lib/saju/types";
import {
  Compass,
  Sparkles,
  Users,
  Copy,
  Check,
  UserPlus,
  ArrowLeft,
  Trophy,
  Download,
} from "lucide-react";

import { useParams } from "next/navigation";
const GalaxyCanvas = lazy(() => import("@/components/planet/GalaxyCanvas"));
import { PlusCircle } from "lucide-react";
import { calculateDailyOrbitalWeather } from "@/lib/saju/daily-orbital";
import CosmicPassportModal from "@/components/planet/CosmicPassportModal";
import GalaxyPokedexModal from "@/components/planet/GalaxyPokedexModal";
import GanziMascotImage from "@/components/planet/GanziMascotImage";

function hasRenderableDayKey(pillars: unknown): boolean {
  const dayKey = (pillars as { dayKey?: unknown } | null | undefined)?.dayKey;
  return dayKey == null || typeof dayKey === "string";
}
function canRenderAddedGuinMap(value: unknown, mapId: string): value is GuinMapData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.id === mapId
    && ["ownerName", "ownerBirth", "ownerDayMaster", "ownerTheme", "createdAt"].every(key => typeof candidate[key] === "string")
    && Array.isArray(candidate.guins) && candidate.guins.every(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const person = value as Record<string, unknown>;
      return ["id", "name", "relationTitle", "dayMaster", "elementMatch", "advice"].every(key => typeof person[key] === "string")
        && typeof person.relationType === "string" && ["mentor", "partner", "supporter", "grounding"].includes(person.relationType)
        && typeof person.affinityScore === "number" && Number.isFinite(person.affinityScore)
        && hasRenderableDayKey(person.pillars)
        && (person.isMe === undefined || typeof person.isMe === "boolean");
    });
}

export default function GuinMapDetailPage() {
  const { id } = useParams<{id:string}>();
  return <GuinMapDetailContent key={id} mapId={id} />;
}

function GuinMapDetailContent({ mapId }: { mapId: string }) {
  const [mapData, setMapData] = useState<GuinMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState<string|null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyRequest = useRef(0);
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>(undefined);
  const [distanceScale, setDistanceScale] = useState(1.0);
  const [speedScale, setSpeedScale] = useState(1.0);

  // 도감 및 여권 모달 상태
  const [showPokedexModal, setShowPokedexModal] = useState(false);
  const [passportPerson, setPassportPerson] = useState<GuinPerson | null>(null);
  const [lastAddedPersonId, setLastAddedPersonId] = useState<string | undefined>(undefined);

  // Friend joining form state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [fYear, setFYear] = useState("1997");
  const [fMonth, setFMonth] = useState("3");
  const [fDay, setFDay] = useState("10");
  const [fHour, setFHour] = useState("10");
  const [fMinute, setFMinute] = useState("30");
  const [fUnknownTime, setFUnknownTime] = useState(false);
  const [joining, setJoining] = useState(false);
  const joinDialogRef = useRef<HTMLDivElement>(null);
  const joinTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => {
    copyRequest.current += 1;
    clearTimeout(copyFeedbackTimer.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const fetchMap = async () => {
      try {
        const res = await fetch(`/api/guin/${mapId}`, { signal: controller.signal });
        const data = await readApiResponse(res);
        if (!active) return;
        if (!res.ok) throw new Error(data.error || "지도를 불러오지 못했습니다.");
        if (data.guinMap) {
          const candidateMap = data.guinMap;
          if (typeof candidateMap !== "object"
            || !["id", "ownerName", "ownerBirth", "ownerDayMaster", "ownerTheme", "createdAt"].every(key => typeof candidateMap[key as keyof GuinMapData] === "string")
            || !Array.isArray(candidateMap.guins) || !candidateMap.guins.every(person =>
              person !== null && typeof person === "object"
              && ["id", "name", "relationTitle", "dayMaster", "elementMatch", "advice"].every(key => typeof person[key as keyof GuinPerson] === "string")
              && ["mentor", "partner", "supporter", "grounding"].includes(person.relationType)
              && typeof person.affinityScore === "number" && Number.isFinite(person.affinityScore)
              && hasRenderableDayKey(person.pillars)
              && (person.isMe === undefined || typeof person.isMe === "boolean")
            )) throw new Error("지도를 확인할 수 없습니다.");
          setMapData(data.guinMap);
          restoreGalaxyUniverse(data.guinMap);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error && error.message ? error.message : "지도를 불러오지 못했습니다.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchMap();
    return () => {
      active = false;
      controller.abort();
    };
  }, [mapId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showJoinModal) setShowJoinModal(false);
        if (passportPerson) setPassportPerson(null);
        if (showPokedexModal) setShowPokedexModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showJoinModal, passportPerson, showPokedexModal]);

  useEffect(() => {
    if (!showJoinModal) return;
    const dialog = joinDialogRef.current;
    const trigger = joinTriggerRef.current;
    if (!dialog) return;
    dialog.querySelector<HTMLInputElement>('input')?.focus();
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]'
      )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      const active = document.activeElement;
      if (!controls.includes(active as HTMLElement)
        || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      if (!trigger?.isConnected) return;
      trigger.focus();
      requestAnimationFrame(() => {
        if (document.activeElement !== trigger) return;
        const navigation = document.querySelector<HTMLElement>('.bottom-nav');
        if (navigation?.getClientRects().length && trigger.getBoundingClientRect().bottom > navigation.getBoundingClientRect().top) {
          trigger.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      });
    };
  }, [showJoinModal]);

  useEffect(() => {
    if (!showJoinModal || joining) return;
    const dialog = joinDialogRef.current;
    // Disabling the submit button can move focus to body during a failed save.
    if (dialog && !dialog.contains(document.activeElement)) dialog.querySelector<HTMLInputElement>('input')?.focus();
  }, [showJoinModal, joining]);

  const handleCopyLink = async () => {
    const request = ++copyRequest.current;
    const url = window.location.href;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(url);
      if (request !== copyRequest.current) return;
      setCopied(true);
      clearTimeout(copyFeedbackTimer.current);
      copyFeedbackTimer.current = setTimeout(() => {
        copyFeedbackTimer.current = undefined;
        setCopied(false);
      }, 2000);
    } catch {
      if (request !== copyRequest.current) return;
      setCopied(false);
      setCopyError("링크를 복사하지 못했어요. 다시 시도해주세요.");
    }
  };

  const handleQuickAddTestFriend = async (name: string, y: number, m: number, d: number, h?: number, min?: number) => {
    setJoining(true);
    try {
      const res = await fetch(`/api/guin/${mapId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendName: name,
          birthYear: y,
          birthMonth: m,
          birthDay: d,
          birthHour: h !== undefined ? h : Math.floor(Math.random() * 24),
          birthMinute: min !== undefined ? min : Math.floor(Math.random() * 60),
          isUnknownTime: false,
        }),
      });
      const data = await readApiResponse(res);
      if(!res.ok) throw new Error(data.error || "등록 중 오류가 발생했습니다.");
      if (data.success && canRenderAddedGuinMap(data.guinMap, mapId)) {
        const lastFriend = data.guinMap.guins[data.guinMap.guins.length - 1];
        if (lastFriend) setLastAddedPersonId(lastFriend.id);
        setMapData(data.guinMap);
      } else {
        throw new Error("등록 중 오류가 발생했습니다.");
      }
    } catch {
      alert("등록 중 오류가 발생했습니다.");
    } finally {
      setJoining(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName.trim()) return;

    setJoining(true);
    try {
      const res = await fetch(`/api/guin/${mapId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendName: friendName.trim(),
          birthYear: fYear,
          birthMonth: fMonth,
          birthDay: fDay,
          birthHour: fUnknownTime ? undefined : fHour,
          birthMinute: fUnknownTime ? undefined : fMinute,
          isUnknownTime: fUnknownTime,
        }),
      });
      const data = await readApiResponse(res);
      if(!res.ok) throw new Error(data.error || "등록 중 오류가 발생했습니다.");
      if (data.success && canRenderAddedGuinMap(data.guinMap, mapId)) {
        const lastFriend = data.guinMap.guins[data.guinMap.guins.length - 1];
        if (lastFriend) setLastAddedPersonId(lastFriend.id);
        setMapData(data.guinMap);
        setShowJoinModal(false);
        setFriendName("");
        alert(`${mapData?.ownerName}님의 우리은하에 등록되었습니다! ✨`);
      } else {
        throw new Error("등록 중 오류가 발생했습니다.");
      }
    } catch {
      alert("등록 중 오류가 발생했습니다.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <Compass className="h-8 w-8 text-doryeong-gold animate-spin mx-auto" />
          <p className="text-xs text-doryeong-textMuted font-serif">우리은하 인연망을 펼치는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!mapData) {
    return (
      <div className="min-h-screen p-6 text-center">
        <p className="text-sm text-doryeong-textMuted">{loadError || "지도를 찾을 수 없습니다."}</p>
        <Link href="/guin" className="mt-4 inline-block text-xs text-doryeong-navy underline">
          새 은하 만들기
        </Link>
      </div>
    );
  }

  return (
    <div className="galaxy-page min-h-screen pb-24">
      <Header />

      <div className="px-5 pt-2 space-y-6">
        <div className="galaxy-heading"><p className="eyebrow">PERSONAL UNIVERSE / 03</p><h1>{mapData.ownerName}의 갤럭시</h1><p>행성을 선택하면 함께하는 사람의 이야기를 볼 수 있어요. 관계 점수는 기존 시연용 해석입니다.</p></div>
        <div className="flex items-center justify-between">
          <Link
            href="/guin"
            className="flex items-center gap-1 text-xs text-doryeong-textMuted hover:text-doryeong-navy font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>지도 목록</span>
          </Link>
          <span className="text-[11px] text-doryeong-gold font-bold">
            은하 속 인연: {mapData.guins.length}개 행성
          </span>
        </div>

        {/* 1. 우리은하 3D 관계 은하 뷰어 (기준서 v0.1: 중심별 + 인연 행성들 + 관계선) */}
        <div className="h-[500px] md:h-[600px] lg:h-[680px] w-full">
          <Suspense fallback={<div className="scene-loading" role="status">갤럭시를 불러오고 있어요.</div>}><GalaxyCanvas
            guins={mapData.guins}
            selectedPersonId={selectedPersonId}
            onSelectPerson={(p) => setSelectedPersonId(p.id)}
            distanceScale={distanceScale}
            speedScale={speedScale}
            incomingPersonId={lastAddedPersonId}
          /></Suspense>
        </div>

        {/* [Step 3] "오늘 우리 행성의 궤도 날씨" 데일리 관계 인사이트 */}
        {(() => {
          const owner = mapData.guins.find((g) => g.isMe) || mapData.guins[0];
          const weatherInsights = owner ? calculateDailyOrbitalWeather(owner, mapData.guins) : [];
          if (weatherInsights.length === 0) return null;

          return (
            <div className="rounded-[26px] bg-gradient-to-r from-[#0C1222] via-[#161F37] to-[#0A101D] border border-doryeong-gold/30 p-5 text-white shadow-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-doryeong-gold/20 text-doryeong-gold">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-doryeong-gold">
                      오늘 우리 행성의 궤도 날씨 · 데일리 관계 인사이트
                    </h3>
                    <p className="text-[10px] text-white/60">
                      매일 달라지는 일진(日辰)에 따른 은하 속 인연 역학 (클릭 시 3D 뷰어 핀포인트 추적)
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-doryeong-gold border border-doryeong-gold/30">
                  오늘의 일진 역학 분석
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {weatherInsights.map((insight) => {
                  const isSelected = selectedPersonId === insight.friendId;
                  return (
                    <div
                      key={insight.friendId}
                      onClick={() => setSelectedPersonId(insight.friendId)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white/15 border-doryeong-gold shadow-md ring-2 ring-doryeong-gold/70"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                          <span>{insight.friendName}</span>
                        </span>
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-doryeong-gold/20 text-doryeong-gold border border-doryeong-gold/30">
                          {insight.badgeText}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200 leading-snug">
                        {insight.headline}
                      </p>
                      <p className="text-[11px] text-amber-200/90 mt-1 font-serif bg-black/30 px-2 py-1 rounded-lg">
                        💡 {insight.actionTip}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 2. 우리은하 컨트롤 바 & 액션 버튼 */}
        <div className="rounded-[24px] bg-white border border-doryeong-border p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-doryeong-gold font-bold uppercase block font-mono">Galactic Physics Controls</span>
              <h3 className="font-serif text-sm font-bold text-doryeong-navy">
                {mapData.ownerName}님의 우리은하 조작
              </h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-doryeong-textMuted font-medium">인연 거리</span>
                <input
                  type="range"
                  min="0.7"
                  max="1.5"
                  step="0.05"
                  aria-label="인연 거리" value={distanceScale}
                  onChange={(e) => setDistanceScale(parseFloat(e.target.value))}
                  className="w-16 sm:w-20 accent-doryeong-gold cursor-pointer"
                  title={`거리 배율: ${distanceScale.toFixed(2)}x`}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-doryeong-textMuted font-medium">공전 속도</span>
                <input
                  type="range"
                  min="0"
                  max="2.5"
                  step="0.1"
                  aria-label="공전 속도" value={speedScale}
                  onChange={(e) => setSpeedScale(parseFloat(e.target.value))}
                  className="w-16 sm:w-20 accent-cyan-600 cursor-pointer"
                  title={`공전 속도: ${speedScale.toFixed(1)}x`}
                />
                <span className="text-[10px] text-doryeong-navy font-mono w-7">
                  {speedScale === 0 ? "정지" : `${speedScale.toFixed(1)}x`}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              onClick={handleCopyLink}
              className="py-3 px-3 rounded-xl bg-doryeong-ivory border border-doryeong-border hover:bg-white active:scale-95 transition-all text-xs font-bold text-doryeong-navy flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-doryeong-gold" />}
              <span>{copied ? "복사 완료!" : "은하 링크 공유"}</span>
            </button>

            <button
              ref={joinTriggerRef}
              onClick={() => setShowJoinModal(true)}
              className="py-3 px-3 rounded-xl bg-doryeong-navy text-white hover:bg-doryeong-navyDark active:scale-95 transition-all text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <UserPlus className="h-4 w-4 text-doryeong-gold" />
              <span>친구 행성 등록</span>
            </button>

            {/* [Step 4] 60간지 우주 도감 버튼 */}
            <button
              onClick={() => setShowPokedexModal(true)}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/10 border border-amber-400/50 hover:bg-amber-100/50 active:scale-95 transition-all text-xs font-bold text-amber-950 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Trophy className="h-4 w-4 text-amber-600" />
              <span>60간지 우주 도감</span>
            </button>

            {/* 빠른 테스트용 인연 생성 버튼 (은하 체험용) */}
            <button
              onClick={() => {
                const sampleNames = ["은하", "도윤", "서아", "민준", "지안", "시우"];
                const rName = sampleNames[Math.floor(Math.random() * sampleNames.length)] + (mapData.guins.length);
                const rYear = 1994 + Math.floor(Math.random() * 8);
                const rMonth = 1 + Math.floor(Math.random() * 12);
                const rDay = 1 + Math.floor(Math.random() * 28);
                handleQuickAddTestFriend(rName, rYear, rMonth, rDay);
              }}
              disabled={joining}
              className="py-3 px-3 rounded-xl bg-[#FFF8EB] border border-[#FDE68A] hover:bg-[#FEF3C7] active:scale-95 transition-all text-xs font-bold text-amber-900 flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="h-4 w-4 text-amber-600" />
              <span>체험용 인연 추가</span>
            </button>
          </div>
          {copyError && <p role="alert" className="text-xs text-red-600">{copyError}</p>}
        </div>

        {/* Guin Persons List / Nodes */}
        <div className="space-y-3">
          <h3 className="font-serif text-base font-bold text-doryeong-textDark flex items-center gap-1.5">
            <Users className="h-4 w-4 text-doryeong-gold" />
            <span>지도에 연결된 귀인들</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mapData.guins.map((person) => {
              const isSelected = selectedPersonId === person.id;
              return (
                <div
                  key={person.id}
                  onClick={() => setSelectedPersonId(person.id)}
                  className={`relationship-card p-4 rounded-[22px] border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#FCF9F2] border-doryeong-gold shadow-md ring-2 ring-doryeong-gold/60"
                      : person.isMe
                      ? "bg-white border-doryeong-gold/60 shadow-sm"
                      : "bg-white border-doryeong-border shadow-sm hover:border-doryeong-navy/40"
                  }`}
                >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                        person.isMe
                          ? "bg-doryeong-gold text-doryeong-navy font-serif"
                          : "bg-doryeong-ivoryDark text-doryeong-navy border border-doryeong-border"
                      }`}
                    >
                      <GanziMascotImage dayKey={person.pillars?.dayKey} thumbnail className="mascot-friend-portrait"/>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm text-doryeong-textDark">
                          <button type="button" aria-pressed={isSelected}
                            onClick={(event) => { event.stopPropagation(); setSelectedPersonId(person.id); }}
                            className="text-left">
                            {person.name}
                          </button>
                        </h4>
                        {person.isMe && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-doryeong-gold/20 text-doryeong-goldDark">
                            중심별
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-serif text-doryeong-gold font-semibold mt-0.5">
                        {person.relationTitle}
                      </p>
                    </div>
                  </div>

                  {!person.isMe && (
                    <div className="text-right">
                      <span className="text-xs font-bold text-doryeong-roseText bg-doryeong-roseBg px-2 py-0.5 rounded-full">
                        시연 점수 {person.affinityScore}점
                      </span>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-doryeong-textMuted font-serif bg-doryeong-ivory/60 p-2.5 rounded-xl border border-doryeong-border/40">
                  {person.advice}
                </p>

                <div className="mt-3 pt-2 border-t border-doryeong-border/40 flex items-center justify-between">
                  <span className="text-[10px] text-doryeong-textMuted font-mono">
                    {person.pillars?.dayKey || "일주미상"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPassportPerson(person);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-doryeong-gold/15 text-doryeong-goldDark text-[10.5px] font-bold border border-doryeong-gold/30 hover:bg-doryeong-gold/25 transition-all flex items-center gap-1"
                      title="우주 여권 카드 발급 (9:16 인스타 스토리용)"
                    >
                      <Download className="h-3 w-3" />
                      <span>우주 여권</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPersonId(person.id);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-doryeong-navy/10 text-doryeong-navy text-[10.5px] font-bold hover:bg-doryeong-navy/20 transition-all flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3 text-doryeong-gold" />
                      <span>3D 추적</span>
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Join Modal for Friends */}
        {showJoinModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowJoinModal(false)}
          >
            <div
              ref={joinDialogRef} role="dialog" aria-modal="true" aria-labelledby="guin-join-heading"
              className="w-full max-w-md bg-doryeong-ivory rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-doryeong-border p-6 animate-in slide-in-from-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 id="guin-join-heading" className="font-serif text-lg font-bold text-doryeong-navy">
                  {mapData.ownerName}님의 지도에 참여하기
                </h3>
                <button
                  type="button" aria-label="친구 등록 닫기"
                  onClick={() => setShowJoinModal(false)}
                  className="text-doryeong-textMuted hover:text-doryeong-textDark"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleJoin}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
                }}
                className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                    내 이름 (또는 별명)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 지우"
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-doryeong-border bg-white text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                    내 생년월일
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={fYear}
                      onChange={(e) => setFYear(e.target.value)}
                      className="px-2 py-2 text-center rounded-xl border border-doryeong-border bg-white text-sm"
                    />
                    <input
                      type="number"
                      value={fMonth}
                      onChange={(e) => setFMonth(e.target.value)}
                      className="px-2 py-2 text-center rounded-xl border border-doryeong-border bg-white text-sm"
                    />
                    <input
                      type="number"
                      value={fDay}
                      onChange={(e) => setFDay(e.target.value)}
                      className="px-2 py-2 text-center rounded-xl border border-doryeong-border bg-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-doryeong-textDark">
                      태어난 시간 (시·분)
                    </label>
                    <label className="text-[11px] text-doryeong-textMuted flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fUnknownTime}
                        onChange={(e) => setFUnknownTime(e.target.checked)}
                        className="rounded accent-doryeong-navy"
                      />
                      <span>시간 모름</span>
                    </label>
                  </div>

                  {!fUnknownTime ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        max="23"
                        required
                        placeholder="시 (0~23)"
                        value={fHour}
                        onChange={(e) => setFHour(e.target.value)}
                        className="px-3 py-2 text-center rounded-xl border border-doryeong-border bg-white text-sm"
                      />
                      <input
                        type="number"
                        min="0"
                        max="59"
                        required
                        placeholder="분 (0~59)"
                        value={fMinute}
                        onChange={(e) => setFMinute(e.target.value)}
                        className="px-3 py-2 text-center rounded-xl border border-doryeong-border bg-white text-sm"
                      />
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 rounded-xl bg-white/70 border border-doryeong-border text-xs text-doryeong-textMuted">
                      시간 미상 (시주 위성 제외)
                    </div>
                  )}

                  <p className="text-[10px] text-doryeong-textMuted mt-1">
                    ※ 한국 시차 30분(동경 127.5° 진태양시)이 자동 보정됩니다.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={joining}
                  className="w-full py-3.5 rounded-2xl bg-doryeong-navy text-white font-serif font-bold text-sm shadow-md"
                >
                  {joining ? "분석 및 등록 중..." : "귀인 등록 완료하기"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* [Step 4] 60간지 우주 도감 모달 */}
        <GalaxyPokedexModal
          guins={mapData.guins}
          isOpen={showPokedexModal}
          onClose={() => setShowPokedexModal(false)}
        />

        {/* [Step 1 & 2] 우주 여권 (9:16 인스타 스토리) 모달 */}
        {passportPerson && (
          <CosmicPassportModal
            person={passportPerson}
            isOpen={!!passportPerson}
            onClose={() => setPassportPerson(null)}
          />
        )}
      </div>
    </div>
  );
}
