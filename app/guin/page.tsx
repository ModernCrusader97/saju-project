"use client";

import { readApiResponse } from "@/lib/http-client";


import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Compass, Sparkles, Share2, Users, ArrowRight } from "lucide-react";

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
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
      if (data.success && data.guinMap) {
        router.push(`/guin/${data.guinMap.id}`);
      } else {
        alert(data.error || "지도 생성 실패");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <Header />

      <div className="px-5 pt-3 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 좌측: 소개 배너 & 설명 */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-[28px] bg-gradient-to-br from-doryeong-navy to-doryeong-navyLight text-white p-6 shadow-doryeong relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-doryeong-gold/20 blur-2xl" />
              <div className="relative z-10">
                <span className="inline-flex rounded-full bg-doryeong-gold px-3 py-1 text-xs font-bold text-doryeong-navy mb-3">
                  ✨ 3D 관계 은하 · 완전 무료
                </span>
                <h2 className="font-serif text-2xl font-bold leading-tight">
                  도령의 우리은하 귀인 지도
                </h2>
                <p className="mt-2 text-xs text-white/80 leading-relaxed font-serif">
                  나의 3D 중심 행성을 기준으로 인연들의 행성이 나선팔을 따라 부유하는 4대 나선은하가 펼쳐집니다.
                  지도를 열고 친구들에게 공유하여 나만의 3D 우리은하 인연망을 완성해보세요.
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
                  <strong className="text-doryeong-navy">친구 초대하기: </strong>
                  생성된 지도의 링크를 단톡방이나 인스타 스토리에 공유해보세요. 친구가 생일을 입력하면 내 은하에 친구의 행성이 채워집니다.
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

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                이름 (또는 닉네임)
              </label>
              <input
                type="text"
                required
                placeholder="예: 별이"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-doryeong-border bg-doryeong-ivory text-sm focus:outline-none focus:border-doryeong-navy font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-doryeong-textDark mb-1">
                생년월일 (양력 기준)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center rounded-xl border border-doryeong-border bg-doryeong-ivory px-2 py-2.5">
                  <input
                    type="number"
                    min="1930"
                    max="2030"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="w-full text-center text-sm font-semibold bg-transparent focus:outline-none"
                  />
                  <span className="text-xs text-doryeong-textMuted ml-1">년</span>
                </div>
                <div className="flex items-center rounded-xl border border-doryeong-border bg-doryeong-ivory px-2 py-2.5">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className="w-full text-center text-sm font-semibold bg-transparent focus:outline-none"
                  />
                  <span className="text-xs text-doryeong-textMuted ml-1">월</span>
                </div>
                <div className="flex items-center rounded-xl border border-doryeong-border bg-doryeong-ivory px-2 py-2.5">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={birthDay}
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
                    checked={isUnknownTime}
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
                      value={birthHour}
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
                      value={birthMinute}
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
