"use client";

import React, { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import SajuInputModal from "@/components/SajuInputModal";
import FortuneCard from "@/components/FortuneCard";
import { FortuneResult } from "@/lib/saju/types";
import {
  Sparkles,
  Heart,
  Users,
  Compass,
  Briefcase,
  Calendar,
  Clock,
  HelpCircle,
  Flame,
  ChevronRight,
  BookOpen,
} from "lucide-react";

export default function Home() {
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    category: string;
    title: string;
  }>({
    isOpen: false,
    category: "overall",
    title: "내 사주 풀이",
  });

  const [activeFortune, setActiveFortune] = useState<FortuneResult | null>(null);

  // [Step 1] 1분 사주 행성 성격 테스트 폼 상태
  const [quickName, setQuickName] = useState("");
  const [quickYear, setQuickYear] = useState("1998");
  const [quickMonth, setQuickMonth] = useState("5");
  const [quickDay, setQuickDay] = useState("15");
  const [quickHour, setQuickHour] = useState("14");
  const [quickUnknown, setQuickUnknown] = useState(false);

  const handleQuickTestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = quickName.trim() || "별의 여행자";
    window.location.href = `/planet?name=${encodeURIComponent(name)}&y=${quickYear}&m=${quickMonth}&d=${quickDay}&h=${quickHour}&unknown=${quickUnknown}&intro=true`;
  };

  const openModal = (category: string, title: string) => {
    setModalConfig({ isOpen: true, category, title });
  };

  return (
    <div className="min-h-screen">
      <Header />

      <div className="px-5 pt-1 space-y-6">
        {/* 결과가 생성되었을 때 결과 카드를 상단에 즉시 표시 */}
        {activeFortune && (
          <div className="mb-6">
            <div className="flex items-center justify-between pb-2 mb-4 border-b border-doryeong-border">
              <span className="text-xs font-bold text-doryeong-navy flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-doryeong-gold" />
                방금 풀이된 결과
              </span>
              <button
                onClick={() => setActiveFortune(null)}
                className="text-xs text-doryeong-textMuted hover:underline"
              >
                닫기
              </button>
            </div>
            <FortuneCard fortune={activeFortune} />
          </div>
        )}

        {/* [Step 1] "나는 어떤 우주 행성일까?" 1분 사주 행성 성격 테스트 배너 */}
        <div className="relative rounded-[32px] overflow-hidden bg-gradient-to-br from-[#070D1E] via-[#0F1B38] to-[#1A1838] border-2 border-doryeong-gold/60 p-6 md:p-8 text-white shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/20 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-3 py-1 text-xs font-black text-doryeong-navy shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
                <span>STEP 1 · 1분 사주 행성 성격 테스트</span>
              </span>
              <span className="text-[11px] font-bold text-doryeong-gold">
                무료 3D 정령 & 우주 여권 즉시 발급
              </span>
            </div>

            <div className="max-w-xl">
              <h2 className="font-serif text-2xl md:text-3xl font-extrabold text-white leading-tight">
                "나는 어떤 우주 행성일까?"
              </h2>
              <p className="mt-2 text-xs md:text-sm text-slate-300 leading-relaxed">
                생년월일시를 입력하면, 사주 도령의 긴 글 대신 <strong>"당신의 영혼이 빚어낸 3D 사주 행성이 생성되었습니다"</strong> 인트로와 함께 회전하는 3D 행성 & 10간 정령(가디언즈 샌드맨 & 엘리멘탈)이 등장합니다!
              </p>
            </div>

            {/* 1분 빠른 생년월일 입력 폼 */}
            <form onSubmit={handleQuickTestSubmit} className="pt-2 max-w-lg space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="이름 또는 별명 (예: 도령)"
                  aria-label="이름 또는 별명"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/40 text-xs font-semibold focus:outline-none focus:border-doryeong-gold"
                />
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="text-white/70 text-[11px]">태어난 시간</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-doryeong-gold">
                    <input
                      type="checkbox"
                      checked={quickUnknown}
                      onChange={(e) => setQuickUnknown(e.target.checked)}
                      className="rounded accent-doryeong-gold"
                    />
                    <span>시간 모름</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <input
                  type="number"
                  placeholder="년"
                  aria-label="태어난 연도"
                  value={quickYear}
                  onChange={(e) => setQuickYear(e.target.value)}
                  className="px-2 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-center text-xs font-bold focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="월"
                  aria-label="태어난 월"
                  value={quickMonth}
                  onChange={(e) => setQuickMonth(e.target.value)}
                  className="px-2 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-center text-xs font-bold focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="일"
                  aria-label="태어난 일"
                  value={quickDay}
                  onChange={(e) => setQuickDay(e.target.value)}
                  className="px-2 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-center text-xs font-bold focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="시"
                  aria-label="태어난 시"
                  disabled={quickUnknown}
                  value={quickHour}
                  onChange={(e) => setQuickHour(e.target.value)}
                  className="px-2 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-center text-xs font-bold focus:outline-none disabled:opacity-40"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-doryeong-gold via-amber-400 to-yellow-400 text-doryeong-navy font-bold text-sm shadow-lg hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>🪐 1분 만에 내 행성 & 정령 생성하기 (무료)</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </form>

            {/* 태그 모음 */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10.5px] text-white/60">
              <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">#3D사주행성</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">#가디언즈샌드맨</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">#엘리멘탈정령</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">#9:16인스타스토리여권</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">#내은하로착륙해줘</span>
            </div>
          </div>
        </div>

        {/* 1. 상단 히어로 배너 그리드 (모바일 1열, 데스크톱 2열) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* A. 메인 대표 서비스 배너: "사주도령에게 내 사주 묻기" */}
          <section
            onClick={() => openModal("overall", "내 사주 풀이")}
            className="relative block overflow-hidden rounded-[26px] p-6 text-white cursor-pointer transition-all active:scale-[0.98] shadow-doryeong flex flex-col justify-between"
            style={{
              background: "linear-gradient(135deg, #1E2A4A 0%, #2A3A5E 100%)",
            }}
          >
            {/* Ambient Glow */}
            <div className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-doryeong-gold/20 blur-2xl pointer-events-none" />

            <div className="relative z-10 pr-12">
              <p className="text-[10px] font-bold uppercase tracking-[3px] text-doryeong-gold mb-2">
                대표 서비스 · 내 사주 풀이
              </p>
              <h2 className="font-serif text-[22px] font-bold leading-[1.35]">
                사주도령에게<br />내 사주 묻기
              </h2>
              <p className="mt-2 text-xs leading-[1.6] text-white/70">
                성격, 관계, 흐름까지 도령의 비유로 풀어드립니다.
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-doryeong-gold px-4 py-2 text-xs font-bold text-doryeong-navy shadow-md">
                  내 사주 보기 · 990원
                </span>
              </div>
            </div>

            <div className="absolute bottom-3 right-3 flex flex-col items-center opacity-90">
              <div className="w-16 h-20 bg-doryeong-gold/10 border border-doryeong-gold/30 rounded-xl flex items-center justify-center font-serif text-doryeong-gold font-bold text-sm shadow-inner rotate-3">
                四柱
              </div>
            </div>
          </section>

          {/* B. 3D 개인 행성 스튜디오 진입 배너 (확정사항 기준서 v0.1) */}
          <Link
            href="/planet"
            className="relative block rounded-[26px] bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#334155] border-2 border-doryeong-gold/60 p-6 text-white transition-all active:scale-[0.98] shadow-lg overflow-hidden group flex flex-col justify-between"
          >
            <div className="relative z-10 pr-12">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-flex rounded-full bg-doryeong-gold px-2.5 py-0.5 text-[10px] font-extrabold text-doryeong-navy">
                  NEW 기준서 v0.1
                </span>
                <span className="text-[11px] text-doryeong-gold font-bold">
                  70:30 표면 + 위성 + 고리
                </span>
              </div>
              <h4 className="font-serif text-[22px] font-bold text-white leading-tight">
                3D 개인 행성 스튜디오
              </h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                내 사주팔자가 우주 속 입체 행성으로 조립되는 모습을 3D로 직접 확인하세요.
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 border border-white/30 px-4 py-2 text-xs font-bold text-white group-hover:bg-white group-hover:text-doryeong-navy transition-all">
                  행성 스튜디오 열기 →
                </span>
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 w-24 h-24 rounded-full bg-doryeong-gold/20 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
              🪐
            </div>
          </Link>
        </div>

        {/* 2. 관계 섹션 ("관계가 궁금하다면") */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-serif text-[17px] font-bold text-doryeong-textDark">
              관계가 궁금하다면
            </h3>
            <span className="h-px flex-1 bg-doryeong-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 내 연애운 */}
            <div
              onClick={() => openModal("love", "내 연애운")}
              className="flex items-center justify-between p-4 rounded-[20px] border-2 border-doryeong-border bg-white cursor-pointer hover:border-doryeong-gold/50 active:scale-[0.98] transition-all"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-doryeong-roseBg text-doryeong-roseText">
                    나 1명
                  </span>
                  <h4 className="font-serif text-base font-bold text-doryeong-textDark">
                    내 연애운
                  </h4>
                </div>
                <p className="mt-1 text-xs text-doryeong-textMuted">
                  새 인연·연애·결혼 시기
                </p>
                <p className="mt-2 text-xs font-extrabold text-doryeong-navy">
                  990원 →
                </p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-doryeong-roseBg/50 flex items-center justify-center text-doryeong-roseText">
                <Heart className="h-5 w-5 fill-current opacity-80" />
              </div>
            </div>

            {/* 두 사람 궁합 */}
            <div
              onClick={() => openModal("match", "두 사람 궁합")}
              className="flex items-center justify-between p-4 rounded-[20px] border-2 border-[#7A86A1]/40 bg-[#F5F6F9] cursor-pointer hover:border-doryeong-navy/40 active:scale-[0.98] transition-all"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-doryeong-blueBg text-doryeong-blueText">
                    두 사람
                  </span>
                  <h4 className="font-serif text-base font-bold text-doryeong-textDark">
                    두 사람 궁합
                  </h4>
                </div>
                <p className="mt-1 text-xs text-doryeong-textMuted">
                  나와 상대가 얼마나 잘 맞는지
                </p>
                <p className="mt-2 text-xs font-extrabold text-doryeong-navy">
                  990원 →
                </p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-doryeong-blueBg flex items-center justify-center text-doryeong-blueText">
                <Users className="h-5 w-5" />
              </div>
            </div>

            {/* 연애 사주상담 [NEW] */}
            <div
              onClick={() => openModal("consult", "연애 사주상담")}
              className="flex items-center justify-between p-4 rounded-[20px] border-2 border-doryeong-purpleText/30 bg-[#F8F3FA] cursor-pointer hover:border-doryeong-purpleText/60 active:scale-[0.98] transition-all relative"
            >
              <span className="absolute right-4 top-3 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-doryeong-purpleBg text-doryeong-purpleText tracking-wider">
                NEW
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-doryeong-purpleBg text-doryeong-purpleText">
                    고백·관계
                  </span>
                  <h4 className="font-serif text-base font-bold text-doryeong-textDark">
                    연애 사주상담
                  </h4>
                </div>
                <p className="mt-1 text-xs text-doryeong-textMuted">
                  고백·대화·지금 할 행동 찾기
                </p>
                <p className="mt-2 text-xs font-extrabold text-doryeong-navy">
                  990원 →
                </p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-doryeong-purpleBg flex items-center justify-center text-doryeong-purpleText">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. 소셜 바이럴 대표 기능: "귀인 지도" */}
        <Link
          href="/guin"
          className="relative block rounded-[24px] border-2 border-doryeong-gold bg-doryeong-navy p-5 text-white transition-all active:scale-[0.98] shadow-md overflow-hidden"
        >
          <div className="relative z-10">
            <span className="inline-flex rounded-full bg-doryeong-gold px-2.5 py-0.5 text-[11px] font-bold text-doryeong-navy mb-2">
              ✨ 생일만 있으면 · 무료
            </span>
            <h4 className="font-serif text-[22px] font-bold text-doryeong-ivory">
              귀인 지도
            </h4>
            <p className="mt-1 text-sm text-[#E8DFC8]">
              내 주변에 나를 돕는 귀인이 몇 명일까?
            </p>
            <p className="mt-2 text-[11px] text-white/60">
              링크를 친구에게 보내고 내 귀인 지도를 완성해보세요 →
            </p>
          </div>
          <div className="absolute bottom-2 right-4 h-14 w-14 rounded-full bg-doryeong-gold/20 flex items-center justify-center text-doryeong-gold">
            <Compass className="h-8 w-8 animate-spin-slow" />
          </div>
        </Link>

        {/* 4. 오늘의 운세 (무료) */}
        <Link
          href="/daily"
          className="flex items-center gap-3 p-4 rounded-[20px] border-2 border-doryeong-border bg-white cursor-pointer active:scale-[0.98] transition-all shadow-sm"
        >
          <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Flame className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-doryeong-navy">오늘의 운세</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-doryeong-gold/20 text-doryeong-goldDark">
                무료
              </span>
            </div>
            <p className="text-xs text-doryeong-textMuted mt-0.5 truncate">
              매일 바뀌는 하루의 기운을 먼저 확인하세요
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-doryeong-gold shrink-0" />
        </Link>

        {/* 5. 이런 풀이도 있어요 (2열 그리드) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-serif text-[17px] font-bold text-doryeong-textDark">
              이런 풀이도 있어요
            </h3>
            <span className="h-px flex-1 bg-doryeong-border" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: "career", title: "직업운", desc: "커리어 방향", price: "990원", icon: Briefcase },
              { id: "year", title: "한 해 운세", desc: "올해 운세", price: "990원", icon: Calendar },
              { id: "daewun", title: "대운", desc: "10년 운 흐름", price: "990원", icon: Clock },
              { id: "consult", title: "고민 상담", desc: "도령에게 묻기", price: "330원", icon: HelpCircle },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => openModal(item.id, item.title)}
                  className="rounded-[20px] border-2 border-doryeong-border bg-white p-3.5 flex flex-col justify-between min-h-[110px] cursor-pointer hover:border-doryeong-gold/40 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-serif text-base font-bold text-doryeong-textDark">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-doryeong-textMuted mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                    <Icon className="h-4 w-4 text-doryeong-gold" />
                  </div>
                  <span className="text-xs font-extrabold text-doryeong-navy">
                    {item.price}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. 안내 & 철학 카드 */}
        <div className="rounded-[18px] border border-doryeong-border bg-[#F6F0E0] p-4 text-xs leading-relaxed text-doryeong-textMuted">
          <p>
            🍯 <strong className="font-bold text-doryeong-navy">풀이가 이해되지 않을 땐 도령이 다시 설명해드려요.</strong>
          </p>
          <p className="mt-1">
            기존 풀이 재해설은 무료이며, 새로운 질문이나 선택에 관한 질문은 질문권으로 자유롭게 물어보실 수 있습니다.
          </p>
        </div>

        {/* 7. 도령 청명이의 약속 */}
        <section className="pt-2 pb-6 border-t border-doryeong-border/60">
          <p className="text-[10px] font-bold uppercase tracking-[2px] text-doryeong-gold mb-1">
            사주도령 청명입니다
          </p>
          <h3 className="font-serif text-[17px] font-bold text-doryeong-navy">
            멀리, 대충 보지 않습니다
          </h3>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-doryeong-textMuted">
            <div className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-doryeong-gold mt-1.5 shrink-0" />
              <p>
                <strong className="text-doryeong-textDark">정통 격국·용신까지: </strong>
                얕은 말이 아니라 사주 원국의 뼈대와 흐름을 함께 살핍니다.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-doryeong-gold mt-1.5 shrink-0" />
              <p>
                <strong className="text-doryeong-textDark">작동 방식의 비유: </strong>
                좋고 나쁨으로 단정하지 않고, 내 기운이 현실에서 어떻게 발현되는지 짚어드립니다.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Saju Input Modal */}
      <SajuInputModal
        isOpen={modalConfig.isOpen}
        category={modalConfig.category}
        categoryTitle={modalConfig.title}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={(fortune) => setActiveFortune(fortune)}
      />
    </div>
  );
}
