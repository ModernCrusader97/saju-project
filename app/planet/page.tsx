"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import PlanetCanvas from "@/components/planet/PlanetCanvas";
import ElementalSpiritCanvas from "@/components/planet/ElementalSpiritCanvas";
import CosmicPassportModal from "@/components/planet/CosmicPassportModal";
import { SIXTY_GANZI_KEYS, getThemePreset, getStemThemePreset } from "@/lib/planet/theme-library";
import { TEN_STEM_SPIRITS } from "@/lib/planet/elemental-spirit";
import { MaskStyle } from "@/lib/planet/uv-mask";
import { analyzeSaju } from "@/lib/saju/manse";
import { parseSajuInput } from "@/lib/saju/input";
import { Sparkles, Compass, Sliders, Calendar, RotateCcw, Info, Heart, Download } from "lucide-react";

export default function PlanetStudioPage() {
  // 뷰 모드 토글 (3D 사주 행성 vs 3D 오행 엘리멘탈 분신)
  const [viewMode, setViewMode] = useState<"planet" | "spirit">("planet");
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [showIntroOverlay, setShowIntroOverlay] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string>("");

  // 슬롯별 2글자 간지 상태 (기준서 v0.1 고정 규칙)
  const [dayKey, setDayKey] = useState("갑자");   // SLOT-D (주 표면 70%)
  const [monthKey, setMonthKey] = useState("병인"); // SLOT-M (보조 표면 30%)
  const [hourKey, setHourKey] = useState("계유");  // SLOT-H (시주 위성 구체)
  const [yearKey, setYearKey] = useState("을축");  // SLOT-Y (연주 고리/소행성대)
  const [maskStyle, setMaskStyle] = useState<MaskStyle>("pangaea");
  const [isUnknownTime, setIsUnknownTime] = useState(false);

  // 사주 입력으로 자동 슬롯 배치용 상태
  const [inputName, setInputName] = useState("내 행성");
  const [birthYear, setBirthYear] = useState("1996");
  const [birthMonth, setBirthMonth] = useState("7");
  const [birthDay, setBirthDay] = useState("20");
  const [birthHour, setBirthHour] = useState("14");
  const [inputError, setInputError] = useState("");

  // URL 파라미터 파싱 (홈 화면 [Step 1] 1분 테스트 연동)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pName = params.get("name");
    const pY = params.get("y");
    const pM = params.get("m");
    const pD = params.get("d");
    const pH = params.get("h");
    const pUnknown = params.get("unknown") === "true";
    const pIntro = params.get("intro") === "true";

    if (pY && pM && pD) {
      if (pName) setInputName(pName);
      setBirthYear(pY);
      setBirthMonth(pM);
      setBirthDay(pD);
      if (pH) setBirthHour(pH);
      setIsUnknownTime(pUnknown);

      try {
        const saju = analyzeSaju(parseSajuInput({
          name: pName || "내 행성",
          gender: "male",
          birthYear: pY,
          birthMonth: pM,
          birthDay: pD,
          birthHour: pUnknown ? undefined : (pH ? pH : 12),
          isUnknownTime: pUnknown,
        }));
  
        const yKey = `${saju.yearPillar.gan}${saju.yearPillar.ji}`;
        const mKey = `${saju.monthPillar.gan}${saju.monthPillar.ji}`;
        const dKey = `${saju.dayPillar.gan}${saju.dayPillar.ji}`;
        const hKey = saju.hourPillar ? `${saju.hourPillar.gan}${saju.hourPillar.ji}` : "갑자";
  
        setDayKey(dKey);
        setMonthKey(mKey);
        setHourKey(hKey);
        setYearKey(yKey);
  
        if (pIntro) {
          setShowIntroOverlay(true);
        }
      } catch (error) {
        setInputError(error instanceof Error ? error.message : "입력 정보를 확인해주세요.");
      }
    }
  }, []);

  // 내 사주로 슬롯 자동 바인딩
  const handleApplySaju = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError("");
    try {
      const saju = analyzeSaju(parseSajuInput({
        name: inputName,
        gender: "male",
        birthYear: birthYear,
        birthMonth: birthMonth,
        birthDay: birthDay,
        birthHour: isUnknownTime ? undefined : birthHour,
        isUnknownTime,
      }));
  
      // 4개 기둥 2글자 간지 키 추출
      const yKey = `${saju.yearPillar.gan}${saju.yearPillar.ji}`;
      const mKey = `${saju.monthPillar.gan}${saju.monthPillar.ji}`;
      const dKey = `${saju.dayPillar.gan}${saju.dayPillar.ji}`;
      const hKey = saju.hourPillar ? `${saju.hourPillar.gan}${saju.hourPillar.ji}` : "갑자";
  
      setDayKey(dKey);
      setMonthKey(mKey);
      setHourKey(hKey);
      setYearKey(yKey);
      setShowIntroOverlay(true);
    } catch (error) {
      setShowIntroOverlay(false);
      setInputError(error instanceof Error ? error.message : "입력 정보를 확인해주세요.");
    }
  };

  const chooseVisualKey = (value: string) => viewMode === "planet" ? (SIXTY_GANZI_KEYS.find(g => g.stem === value)?.key ?? value) : value;

  // 프리셋 정보
  const pDay = viewMode === "planet" ? getStemThemePreset(dayKey) : getThemePreset(dayKey);
  const pMonth = viewMode === "planet" ? getStemThemePreset(monthKey) : getThemePreset(monthKey);
  const pHour = viewMode === "planet" ? getStemThemePreset(hourKey) : getThemePreset(hourKey);
  const pYear = viewMode === "planet" ? getStemThemePreset(yearKey) : getThemePreset(yearKey);

  return (
    <div className="min-h-screen pb-16">
      <Header />

      <div className="px-5 pt-2 space-y-6">
        {/* 상단 타이틀 */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-doryeong-gold mb-1">
            <Sparkles className="h-4 w-4" />
            <span>MY ELEMENTAL WORLD</span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-doryeong-navy">
            같은 나, 두 가지 모습
          </h2>
          <p className="text-xs text-doryeong-textMuted mt-1 leading-relaxed">
            {viewMode === "planet" ? "일주 70% · 월주 30%의 행성, 시주 위성, 연주 소행성대입니다." : "일간으로 이루어진 분신에 일지 동물 특징을 더하고, 월주 펫을 옆 바닥에 둡니다."}
          </p>
        </div>

        {/* 3D 스튜디오 반응형 레이아웃 (모바일 1열, 데스크톱 2열 와이드) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 좌측: 3D 뷰포트 (사주 행성 vs 오행 엘리멘탈 분신 토글) */}
          <div className="lg:col-span-7 space-y-4">
            {/* 뷰 모드 전환 탭 & 우주 여권 발급 버튼 */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-2xl bg-doryeong-ivory border border-doryeong-border">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setViewMode("planet")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === "planet"
                      ? "bg-doryeong-navy text-white shadow-sm"
                      : "text-doryeong-textMuted hover:text-doryeong-navy"
                  }`}
                >
                  <span>행성</span>
                </button>
                <button
                  onClick={() => setViewMode("spirit")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === "spirit"
                      ? "bg-doryeong-navy text-white shadow-sm"
                      : "text-doryeong-textMuted hover:text-doryeong-navy"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-doryeong-gold" />
                  <span>나의 분신</span>
                </button>
              </div>

              <button
                onClick={() => setShowPassportModal(true)}
                className="px-3 py-1.5 rounded-xl bg-[#d5ef9e] text-doryeong-navy font-bold text-xs flex items-center gap-1 shadow-sm hover:brightness-105 active:scale-95 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span>이미지로 간직하기</span>
              </button>
            </div>

            {/* 3D 캔버스 영역 */}
            <div className="h-[460px] md:h-[540px] lg:h-[620px] w-full">
              {viewMode === "planet" ? (
                <PlanetCanvas
                  dayKey={dayKey}
                  monthKey={monthKey}
                  hourKey={hourKey}
                  yearKey={yearKey}
                  maskStyle={maskStyle}
                  isUnknownTime={isUnknownTime}
                />
              ) : (
                <ElementalSpiritCanvas
                  dayKey={dayKey}
                  monthKey={monthKey}
                  hourKey={isUnknownTime ? undefined : hourKey}
                  yearKey={yearKey}
                  isUnknownTime={isUnknownTime}
                  maskStyle={maskStyle}
                  onCapture={(url) => setSnapshotUrl(url)}
                />
              )}
            </div>

            {/* UV 마스크 스타일 토글 (행성 모드일 때만 노출) */}
            {viewMode === "planet" && (
              <div className="rounded-[22px] bg-white border border-doryeong-border p-4 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-serif text-xs font-bold text-doryeong-navy flex items-center gap-1.5">
                    <Compass className="h-4 w-4 text-doryeong-gold" />
                    행성의 표면 무늬
                  </span>
                  <span className="text-[10px] text-doryeong-textSubtle">
                    일주 70% : 월주 30% 고정
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold">
                  {[
                    { id: "pangaea", label: "판게아 (단일 대륙)" },
                    { id: "archipelago", label: "군도 (다도해형)" },
                    { id: "tectonic", label: "단층 (지각판형)" },
                    { id: "bands", label: "목성형 (흐르는 띠)" },
                    { id: "vortices", label: "소용돌이 (유선형)" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      aria-pressed={maskStyle === m.id}
                      onClick={() => setMaskStyle(m.id as MaskStyle)}
                      className={`py-2 rounded-xl transition-all ${
                        maskStyle === m.id
                          ? "bg-doryeong-navy text-white shadow-sm"
                          : "bg-doryeong-ivory text-doryeong-textMuted border border-doryeong-border"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 우측: 슬롯별 간지 제어 & 사주 입력기 */}
          <div className="lg:col-span-5 space-y-4">
            {/* 슬롯별 60간지 선택 컨트롤 (Inspector) */}
            <div className="rounded-[24px] bg-white border border-doryeong-border p-5 shadow-sm space-y-4">
              <h3 className="font-serif text-base font-bold text-doryeong-navy flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-doryeong-gold" />
                {viewMode === "planet" ? "십간 10종 재질 선택" : "일주·월주 조합 선택"}
              </h3>

              <div className="space-y-3">
                {/* SLOT-D: 일주 70% */}
                <div className="p-3.5 rounded-2xl bg-doryeong-ivory border border-doryeong-border flex items-center justify-between">
                  <div>
                    <span className="text-[10.5px] font-bold text-doryeong-gold block">
                      {viewMode === "planet" ? "행성의 바탕 · 70%" : "본체 · 일간 재질 + 일지 특징"}
                    </span>
                    <span className="text-xs font-semibold text-doryeong-navy">
                      일주: {pDay.themeName}
                    </span>
                  </div>
                  <select
                    value={viewMode === "planet" ? dayKey.charAt(0) : dayKey}
                    onChange={(e) => setDayKey(chooseVisualKey(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-doryeong-border bg-white text-xs font-bold text-doryeong-navy focus:outline-none"
                  >
                    {(viewMode === "planet" ? SIXTY_GANZI_KEYS.slice(0, 10) : SIXTY_GANZI_KEYS).map((g) => (
                      <option key={g.key} value={viewMode === "planet" ? g.stem : g.key}>
                        {viewMode === "planet" ? `${g.stem} (${g.hanja.charAt(0)})` : `${g.key} (${g.hanja})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SLOT-M: 월주 30% */}
                <div className="p-3.5 rounded-2xl bg-[#F0F4FA] border border-[#CBD5E1] flex items-center justify-between">
                  <div>
                    <span className="text-[10.5px] font-bold text-[#3B82F6] block">
                      {viewMode === "planet" ? "SLOT-M · 행성 보조 표면 (30%)" : "지상 펫 · 월간 재질 + 월지 특징"}
                    </span>
                    <span className="text-xs font-semibold text-doryeong-navy">
                      월주: {pMonth.themeName}
                    </span>
                  </div>
                  <select
                    value={viewMode === "planet" ? monthKey.charAt(0) : monthKey}
                    onChange={(e) => setMonthKey(chooseVisualKey(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-doryeong-border bg-white text-xs font-bold text-doryeong-navy focus:outline-none"
                  >
                    {(viewMode === "planet" ? SIXTY_GANZI_KEYS.slice(0, 10) : SIXTY_GANZI_KEYS).map((g) => (
                      <option key={g.key} value={viewMode === "planet" ? g.stem : g.key}>
                        {viewMode === "planet" ? `${g.stem} (${g.hanja.charAt(0)})` : `${g.key} (${g.hanja})`}
                      </option>
                    ))}
                  </select>
                </div>

                {viewMode === "planet" && <>
                {/* SLOT-H: 시주 위성 */}
                <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10.5px] font-bold text-[#D97706] block">
                        SLOT-H · 위성 구체
                      </span>
                      <label className="text-[10px] text-doryeong-textMuted flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isUnknownTime}
                          onChange={(e) => setIsUnknownTime(e.target.checked)}
                          className="rounded"
                        />
                        <span>시간 미상</span>
                      </label>
                    </div>
                    <span className="text-xs font-semibold text-doryeong-navy">
                      시주: {isUnknownTime ? "위성 숨김" : pHour.themeName}
                    </span>
                  </div>
                  <select
                    value={viewMode === "planet" ? hourKey.charAt(0) : hourKey}
                    disabled={isUnknownTime}
                    onChange={(e) => setHourKey(chooseVisualKey(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-doryeong-border bg-white text-xs font-bold text-doryeong-navy focus:outline-none disabled:opacity-40"
                  >
                    {(viewMode === "planet" ? SIXTY_GANZI_KEYS.slice(0, 10) : SIXTY_GANZI_KEYS).map((g) => (
                      <option key={g.key} value={viewMode === "planet" ? g.stem : g.key}>
                        {viewMode === "planet" ? `${g.stem} (${g.hanja.charAt(0)})` : `${g.key} (${g.hanja})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SLOT-Y: 연주 고리 */}
                <div className="p-3.5 rounded-2xl bg-[#FFF1F2] border border-[#FECDD3] flex items-center justify-between">
                  <div>
                    <span className="text-[10.5px] font-bold text-[#E11D48] block">
                      SLOT-Y · 고리 / 소행성대
                    </span>
                    <span className="text-xs font-semibold text-doryeong-navy">
                      연주: {pYear.themeName}
                    </span>
                  </div>
                  <select
                    value={viewMode === "planet" ? yearKey.charAt(0) : yearKey}
                    onChange={(e) => setYearKey(chooseVisualKey(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-doryeong-border bg-white text-xs font-bold text-doryeong-navy focus:outline-none"
                  >
                    {(viewMode === "planet" ? SIXTY_GANZI_KEYS.slice(0, 10) : SIXTY_GANZI_KEYS).map((g) => (
                      <option key={g.key} value={viewMode === "planet" ? g.stem : g.key}>
                        {viewMode === "planet" ? `${g.stem} (${g.hanja.charAt(0)})` : `${g.key} (${g.hanja})`}
                      </option>
                    ))}
                  </select>
                </div>
                </>}
              </div>
            </div>

            {/* 내 생년월일시로 바로 적용하기 */}
            <div className="rounded-[24px] bg-white border border-doryeong-border p-5 shadow-sm space-y-3">
              <h3 className="font-serif text-base font-bold text-doryeong-navy flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-doryeong-gold" />
                내 사주 생년월일로 자동 배치
              </h3>
              <p className="text-xs text-doryeong-textMuted">
                {viewMode === "planet" ? "생년월일시로 행성의 4기둥을 배치합니다." : "생년월일시로 본체의 일주와 옆 펫의 월주를 배치합니다."}
              </p>

              <form onSubmit={handleApplySaju} className="space-y-3 pt-1">
                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="number"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="년"
                    className="px-2 py-2 rounded-xl border border-doryeong-border text-center text-xs font-bold"
                  />
                  <input
                    type="number"
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    placeholder="월"
                    className="px-2 py-2 rounded-xl border border-doryeong-border text-center text-xs font-bold"
                  />
                  <input
                    type="number"
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    placeholder="일"
                    className="px-2 py-2 rounded-xl border border-doryeong-border text-center text-xs font-bold"
                  />
                  <input
                    type="number"
                    value={birthHour}
                    disabled={isUnknownTime}
                    onChange={(e) => setBirthHour(e.target.value)}
                    placeholder="시"
                    className="px-2 py-2 rounded-xl border border-doryeong-border text-center text-xs font-bold disabled:opacity-40"
                  />
                </div>

                {inputError && <p role="alert" className="text-xs text-red-700">{inputError}</p>}
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-doryeong-navy text-white font-serif font-bold text-xs shadow-md hover:bg-doryeong-navyDark transition-all"
                >
                  {viewMode === "planet" ? "내 사주 행성으로 조립하기" : "내 사주 분신과 펫으로 조립하기"}
                </button>
              </form>
            </div>

            {/* 기준서 v0.1 준수 검증 가이드 */}
            {viewMode === "planet" ? (
            <div className="rounded-[20px] bg-doryeong-ivoryDark/60 border border-doryeong-border p-4 text-[11px] leading-relaxed text-doryeong-textMuted space-y-1.5">
              <div className="flex items-center gap-1.5 text-doryeong-navy font-bold">
                <Info className="h-4 w-4 text-doryeong-gold" />
                <span>기준서 v0.1 규칙 검증 상태</span>
              </div>
              <p>✔ <strong>일간 재질 70%</strong> + <strong>월간 재질 30%</strong> 단일 구체 UV 마스크 분할</p>
              <p>✔ <strong>시간 재질의 위성</strong> + <strong>연간 재질의 소행성대</strong></p>
              <p>✔ 대기, 구름, 계절 레이어 <strong>완전 배제</strong></p>
              <p>✔ 오행 점수 비율 변경 및 강약 순위 재배치 <strong>완전 배제</strong></p>
            </div>
            ) : <div className="rounded-2xl border border-doryeong-border p-4 text-sm text-doryeong-textMuted">일간은 분신의 몸과 재질, 일지는 귀·뿔·꼬리 같은 동물 특징입니다. 월간과 월지는 바로 옆에 서 있는 작은 펫에 반영합니다.</div>}
          </div>
        </div>
      </div>

      {/* [Step 1] "사주로 표현한 나의 행성을 만나보세요" 인트로 모달 */}
      {showIntroOverlay && viewMode === "planet" && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
          <div className="relative w-full max-w-lg bg-gradient-to-b from-[#0F172A] via-[#1E293B] to-[#0A0F1D] border-2 border-doryeong-gold/60 rounded-[36px] p-7 text-white text-center shadow-[0_0_60px_rgba(230,200,117,0.3)] space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-doryeong-gold/20 border border-doryeong-gold/40 text-xs font-bold text-doryeong-gold">
              <Sparkles className="h-4 w-4 animate-spin" />
              <span>1분 사주 행성 성격 테스트 완료</span>
            </div>

            <div className="space-y-2">
              <h3 className="font-serif text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 leading-tight">
                "사주로 표현한 나의 행성을 만나보세요"
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                [{dayKey}] 일간의 영혼을 품은 3D 입체 행성과 오행 수호 정령이 은하계에 탄생했습니다.
              </p>
            </div>

            {/* 정령 & 행성 프리뷰 카드 */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-around text-left">
              <div>
                <span className="text-[10px] text-doryeong-gold font-bold block">
                  수호 정령
                </span>
                <p className="text-sm font-bold text-white font-serif">
                  {TEN_STEM_SPIRITS[dayKey.charAt(0)]?.name || "우주 정령"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {TEN_STEM_SPIRITS[dayKey.charAt(0)]?.speciesTitle || "자연의 정령"}
                </p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <span className="text-[10px] text-cyan-300 font-bold block">
                  행성 테마
                </span>
                <p className="text-sm font-bold text-white font-serif">
                  {pDay.themeName}
                </p>
                <p className="text-[10px] text-slate-400">
                  일주 70% + 월주 30% 합성
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowIntroOverlay(false);
                  setShowPassportModal(true);
                }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-doryeong-navy font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:brightness-105 active:scale-95 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>인스타 스토리용 우주 여권 카드 발급 (9:16)</span>
              </button>

              <button
                onClick={() => setShowIntroOverlay(false)}
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-all border border-white/10"
              >
                🪐 3D 행성 & 정령 스튜디오 둘러보기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 우주 여권 카드 모달 (9:16 인스타 스토리용) */}
      <CosmicPassportModal
        person={{
          id: "me",
          name: inputName,
          relationType: "mentor",
          relationTitle: "나의 중심별",
          dayMaster: dayKey.charAt(0),
          elementMatch: "본인",
          affinityScore: 100,
          advice: "나의 중심별과 수호 정령",
          isMe: true,
          pillars: {
            dayKey,
            monthKey,
            yearKey,
            hourKey: isUnknownTime ? undefined : hourKey,
          },
        }}
        isOpen={showPassportModal}
        onClose={() => setShowPassportModal(false)}
        planetSnapshotUrl={snapshotUrl}
      />
    </div>
  );
}
