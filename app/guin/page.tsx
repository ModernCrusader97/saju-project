"use client";

import { readApiResponse } from "@/lib/http-client";


import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateUniverse, EXAMPLE_UNIVERSE, readUniverseSession, saveGalaxyUniverse, UNIVERSE_CHANGE_EVENT } from "@/lib/universe-state";

import Header from "@/components/Header";
import { Compass, Sparkles, Share2 } from "lucide-react";

export default function GuinPage() {
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("1996");
  const [birthMonth, setBirthMonth] = useState("7");
  const [birthDay, setBirthDay] = useState("20");
  const [birthHour, setBirthHour] = useState("14");
  const [birthMinute, setBirthMinute] = useState("30");
  const [isUnknownTime, setIsUnknownTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  const handleFormFocus = (event: React.FocusEvent<HTMLFormElement>) => {
    const target = event.target as HTMLElement;
    requestAnimationFrame(() => {
      if (document.activeElement !== target) return;
      const navigation = document.querySelector<HTMLElement>('.bottom-nav');
      if (navigation?.getClientRects().length && target.getBoundingClientRect().bottom > navigation.getBoundingClientRect().top) {
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    });
  };
  useEffect(() => {
    mounted.current = true;
    const restore = () => {
      const saved = readUniverseSession();
      if (!saved) return;
      const birth = saved.birth;
      setName(birth.name); setBirthYear(birth.year); setBirthMonth(birth.month);
      setBirthDay(birth.day); setBirthHour(birth.hour); setBirthMinute(birth.minute);
      setIsUnknownTime(birth.unknown);
    };
    restore(); window.addEventListener(UNIVERSE_CHANGE_EVENT, restore);
    return () => {
      mounted.current = false;
      window.removeEventListener(UNIVERSE_CHANGE_EVENT, restore);
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const next = calculateUniverse({ name:name.trim(), year:birthYear, month:birthMonth, day:birthDay,
        hour:birthHour, minute:birthMinute, unknown:isUnknownTime }, readUniverseSession() || EXAMPLE_UNIVERSE);
      const res = await fetch("/api/guin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          birthYear: birthYear,
          birthMonth: birthMonth,
          birthDay: birthDay,
          birthHour: isUnknownTime ? undefined : birthHour,
          birthMinute: isUnknownTime ? undefined : birthMinute,
          isUnknownTime,
        }),
      });
      const data = await readApiResponse(res);
      if (!mounted.current) return;
      if (res.ok && data.success && data.guinMap
        && typeof data.guinMap.id === "string" && /^[a-zA-Z0-9_-]+$/.test(data.guinMap.id)) {
        saveGalaxyUniverse(next, data.guinMap);
        router.push(`/guin/${data.guinMap.id}`);
      } else {
        alert(data.error || "지도 생성 실패");
      }
    } catch (reason) {
      if (!mounted.current) return;
      alert(reason instanceof Error ? reason.message : "네트워크 오류가 발생했습니다.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <div className="galaxy-page min-h-screen pb-24">
      <Header />

      <div className="px-5 pt-3 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 좌측: 소개 배너 & 설명 */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-[28px] bg-gradient-to-br from-doryeong-navy to-doryeong-navyLight text-white p-6 shadow-doryeong relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-doryeong-gold/20 blur-2xl" />
              <div className="relative z-10">
                <span className="inline-flex rounded-full bg-doryeong-gold px-3 py-1 text-xs font-bold text-doryeong-navy mb-3">
                  RELATIONSHIP ATLAS
                </span>
                <h2 className="font-serif text-2xl font-bold leading-tight">
                  우리의 우주
                </h2>
                <p className="mt-2 text-xs text-white/80 leading-relaxed font-serif">
                  나의 3D 중심 행성을 기준으로 인연들의 행성이 나선팔을 따라 부유하는 4대 나선은하가 펼쳐집니다.
                  내 행성과 함께 놓을 사람들을 추가해 관계 지도를 둘러보세요. 현재는 본인만 볼 수 있습니다.
                </p>
              </div>
            </div>

            {/* Feature Explanations */}
            <div className="rounded-[24px] bg-white border border-doryeong-border p-5 space-y-3 text-xs leading-relaxed text-doryeong-textMuted shadow-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-doryeong-gold shrink-0 mt-0.5" />
                <p>
                  <strong className="text-doryeong-navy">귀인이란? </strong>
                  단순히 나에게 이득을 주는 사람이 아닌, 삶의 고비마다 방향을 비춰주고 지혜를 나누는 인연입니다.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Share2 className="h-4 w-4 text-doryeong-gold shrink-0 mt-0.5" />
                <p>
                  <strong className="text-doryeong-navy">관계 더하기: </strong>
                  내 지도에서 친구의 생년월일을 직접 입력해 관계를 살펴보세요. 지도는 현재 본인만 볼 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 우측: 폼 카드 */}
          <div className="lg:col-span-7">
            <div className="rounded-[24px] bg-white border border-doryeong-border p-6 shadow-sm">
              <h3 className="font-serif text-lg font-bold text-doryeong-navy mb-1">
                내 귀인 지도 열기
              </h3>
              <p className="text-xs text-doryeong-textMuted mb-5">
                생년월일을 입력하면 나를 중심으로 하는 4대 나선은하가 생성됩니다.
              </p>

          <form onSubmit={handleCreate} onFocusCapture={handleFormFocus}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
            }}
            className="space-y-4">
            <div>
              <label htmlFor="guin-owner-name" className="block text-xs font-bold text-doryeong-textDark mb-1">
                이름 (또는 닉네임)
              </label>
              <input
                id="guin-owner-name"
                type="text"
                required
                placeholder="예: 별이"
                aria-label="은하 이름" value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-doryeong-border bg-doryeong-ivory text-sm focus:outline-none focus:border-doryeong-navy font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                생년월일 (양력 기준)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col min-[375px]:flex-row items-center rounded-xl border border-doryeong-border bg-doryeong-ivory px-2 py-2.5">
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    aria-label="은하 연도" required value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="w-full text-center text-sm font-semibold bg-transparent focus:outline-none"
                  />
                  <span className="text-xs text-doryeong-textMuted ml-1">년</span>
                </div>
                <div className="flex flex-col min-[375px]:flex-row items-center rounded-xl border border-doryeong-border bg-doryeong-ivory px-2 py-2.5">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    aria-label="은하 월" required value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className="w-full text-center text-sm font-semibold bg-transparent focus:outline-none"
                  />
                  <span className="text-xs text-doryeong-textMuted ml-1">월</span>
                </div>
                <div className="flex flex-col min-[375px]:flex-row items-center rounded-xl border border-doryeong-border bg-doryeong-ivory px-2 py-2.5">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    aria-label="은하 일" required value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className="w-full text-center text-sm font-semibold bg-transparent focus:outline-none"
                  />
                  <span className="text-xs text-doryeong-textMuted ml-1">일</span>
                </div>
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
                    aria-label="은하 시간 모름" checked={isUnknownTime}
                    onChange={(e) => setIsUnknownTime(e.target.checked)}
                    className="rounded accent-doryeong-navy"
                  />
                  <span>시간 모름 (시주 위성 숨김)</span>
                </label>
              </div>

              {!isUnknownTime ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center rounded-xl border border-doryeong-border bg-doryeong-ivory px-3 py-2.5">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      aria-label="은하 시" required value={birthHour}
                      onChange={(e) => setBirthHour(e.target.value)}
                      className="w-full text-center text-sm font-semibold bg-transparent focus:outline-none"
                    />
                    <span className="text-xs text-doryeong-textMuted ml-1">시 (0~23)</span>
                  </div>
                  <div className="flex items-center rounded-xl border border-doryeong-border bg-doryeong-ivory px-3 py-2.5">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      aria-label="은하 분" required value={birthMinute}
                      onChange={(e) => setBirthMinute(e.target.value)}
                      className="w-full text-center text-sm font-semibold bg-transparent focus:outline-none"
                    />
                    <span className="text-xs text-doryeong-textMuted ml-1">분 (0~59)</span>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-2 rounded-xl bg-doryeong-ivory text-xs text-doryeong-textMuted">
                  시간 미상으로 3기둥(연·월·일) 행성으로 생성됩니다.
                </div>
              )}

              {/* 한국 30분 시차 보정 안내 문구 */}
              <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-[#F5F8FF] border border-[#D9E4FF] text-[10.5px] text-[#2B4C8C] flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 shrink-0 text-[#3B82F6]" />
                <span>
                  <strong>한국 시차 30분 자동 보정:</strong> 서울/한반도 실제 태양시(동경 127.5°) 기준으로 자시(23:30~01:29) 등이 정통 만세력 규격에 맞게 계산됩니다.
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-doryeong-navy text-white font-serif font-bold text-base shadow-lg hover:bg-doryeong-navyDark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Compass className="h-5 w-5 text-doryeong-gold" />
              <span>{loading ? "지도 생성 중..." : "귀인 지도 만들기"}</span>
            </button>
          </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
