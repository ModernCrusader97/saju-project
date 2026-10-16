"use client";

import { readApiResponse } from "@/lib/http-client";


import React, { useState, useEffect, Suspense, useMemo } from "react";
import Header from "@/components/Header";
import FortuneCard from "@/components/FortuneCard";
import { FortuneResult } from "@/lib/saju/types";
import type { FortuneSummary } from "@/lib/db/fortune-summary";
import { ScrollText, ChevronRight, ArrowLeft, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";


const CATEGORY_MAP: Record<string, { label: string; badge: string }> = {
  overall: { label: "종합 사주", badge: "bg-amber-100 text-amber-800" },
  love: { label: "연애운", badge: "bg-rose-100 text-rose-800" },
  match: { label: "두 사람 궁합", badge: "bg-pink-100 text-pink-800" },
  career: { label: "직업·재물운", badge: "bg-emerald-100 text-emerald-800" },
  year: { label: "한 해 운세", badge: "bg-blue-100 text-blue-800" },
  daewun: { label: "10년 대운", badge: "bg-indigo-100 text-indigo-800" },
  consult: { label: "풀이 대화", badge: "bg-purple-100 text-purple-800" },
};

// Validate before storing the list so malformed items reach the retryable error state.
function canRenderFortuneSummary(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id || typeof row.createdAt !== "string") return false;
  if (!["category", "title", "summary", "name", "dayMaster"].every(key => typeof row[key] === "string")) return false;
  return row.createdAt === "" || Number.isFinite(new Date(row.createdAt).getTime());
}

// Check the card's rendered fields before storing detail data; optional legacy fields remain optional.
function canRenderFortune(value: unknown): boolean {
  const record = (candidate: unknown): candidate is Record<string, unknown> =>
    candidate !== null && typeof candidate === "object" && !Array.isArray(candidate);
  const strings = (candidate: Record<string, unknown>, keys: string[]) =>
    keys.every(key => typeof candidate[key] === "string");
  const numbers = (candidate: Record<string, unknown>, keys: string[]) =>
    keys.every(key => typeof candidate[key] === "number" && Number.isFinite(candidate[key]));
  const pillar = (candidate: unknown) => record(candidate) && strings(candidate, [
    "ganElement", "ganHanja", "gan", "shipshinGan", "jiElement", "jiHanja", "ji", "shipshinJi",
  ]);
  if (!record(value) || !strings(value, ["title", "summary"])) return false;
  const analysis = value.analysis;
  if (!record(analysis) || !strings(analysis, ["name", "calendarType"])
    || !numbers(analysis, ["birthYear", "birthMonth", "birthDay"])
    || !["patternName", "yongshin"].every(key => analysis[key] == null || typeof analysis[key] === "string")) return false;
  if (![analysis.yearPillar, analysis.monthPillar, analysis.dayPillar].every(pillar)
    || (analysis.hourPillar != null && !pillar(analysis.hourPillar))) return false;
  if (!record(analysis.elementsCount)
    || !numbers(analysis.elementsCount, ["wood", "fire", "earth", "metal", "water"])) return false;
  if (analysis.solarBirthDate && (!record(analysis.solarBirthDate)
    || !numbers(analysis.solarBirthDate, ["year", "month", "day"]))) return false;
  if (!record(value.metaphor) || !strings(value.metaphor, ["coreTitle", "description"])) return false;
  if (!record(value.luckyAdvice) || !strings(value.luckyAdvice, ["color", "direction", "mindset"])) return false;
  return Array.isArray(value.sections) && value.sections.every((section: unknown) =>
    record(section) && strings(section, ["title", "content"])
    && (section.subtitle == null || typeof section.subtitle === "string")
    && (section.advice == null || typeof section.advice === "string"));
}

function SavedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");

  const [fortunes, setFortunes] = useState<FortuneSummary[]>([]);
  const [details, setDetails] = useState<Map<string, FortuneResult>>(() => new Map());
  const selectedFortune = queryId ? details.get(queryId) : undefined;
  const [detailError, setDetailError] = useState<{ id: string | null; message: string }>({ id: queryId, message: "" });
  // Errors belong to one selection visit. Reset before rendering another route,
  // including Back to a previously failed reading, while its fresh request runs.
  if (detailError.id !== queryId) setDetailError({ id: queryId, message: "" });
  const [detailRetry, setDetailRetry] = useState(0);
  const [listRetry, setListRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string|null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/saju?view=summary", { signal: controller.signal })
      .then(async (res) => {const data=await readApiResponse(res); if(!res.ok) throw new Error(data.error || "기록을 불러오지 못했습니다."); return data;})
      .then((data) => {
        if (!Array.isArray(data.fortuneSummaries) || !data.fortuneSummaries.every(canRenderFortuneSummary)) throw new Error("기록 목록을 확인할 수 없습니다.");
        if (!controller.signal.aborted) setFortunes(data.fortuneSummaries);
      })
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error.message || "기록을 불러오지 못했습니다."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [listRetry]);

  useEffect(() => {
    if (!queryId || details.has(queryId)) return;
    const controller = new AbortController();
    fetch(`/api/saju/${encodeURIComponent(queryId)}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await readApiResponse(res);
        if (!res.ok) throw new Error(data.error || "기록을 불러오지 못했습니다.");
        if (!data.fortune || data.fortune.id !== queryId || !canRenderFortune(data.fortune)) throw new Error("요청한 기록을 확인할 수 없습니다.");
        return data.fortune;
      })
      .then((fortune) => { if (!controller.signal.aborted) setDetails(previous => new Map(previous).set(queryId, fortune)); })
      .catch((error) => { if (!controller.signal.aborted) setDetailError({ id: queryId, message: error.message || "기록을 불러오지 못했습니다." }); });
    return () => controller.abort();
  }, [queryId, details, detailRetry]);

  const openFortune = (id: string) => {
    setDetailError({ id, message: "" });
    router.push(`/saved?id=${encodeURIComponent(id)}`, { scroll: false });
  };

  const filteredFortunes = useMemo(() => {
    const q = searchQuery.trim().normalize("NFC").toLowerCase();
    return fortunes.filter((f) => {
      const matchCategory =
        selectedCategory === "all" || (f.category || "overall") === selectedCategory;
      if (!matchCategory) return false;
      const matchSearch =
        !q ||
        f.name.normalize("NFC").toLowerCase().includes(q) ||
        f.title.normalize("NFC").toLowerCase().includes(q) ||
        f.summary.normalize("NFC").toLowerCase().includes(q) ||
        (f.dayMaster && f.dayMaster.normalize("NFC").toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }, [fortunes, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    return Object.fromEntries(Object.keys(CATEGORY_MAP).map((key) => [
      key,
      fortunes.filter((f) => (f.category || "overall") === key).length,
    ]));
  }, [fortunes]);

  return (
    <div className="px-5 pt-2 pb-24 space-y-5">
      {queryId ? (
        <div>
          <button
            onClick={() => router.push("/saved", { scroll: false })}
            className="flex items-center gap-1.5 text-xs font-bold text-doryeong-textMuted hover:text-doryeong-navy mb-4 transition-colors p-1"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>← 보관함 전체 목록으로 돌아가기</span>
          </button>
          {selectedFortune ? <FortuneCard key={selectedFortune.id} fortune={selectedFortune} />
            : detailError.id === queryId && detailError.message ? <div role="alert" className="p-4 border border-red-200 bg-red-50 text-red-800 rounded-xl space-y-3">
              <p>{detailError.message}</p>
              <button type="button" className="secondary-button" onClick={() => { setDetailError({ id: queryId, message: "" }); setDetailRetry(count => count + 1); }}>다시 불러오기</button>
            </div>
            : <p role="status" className="py-16 text-center text-sm text-doryeong-textMuted">선택한 기록을 불러오고 있어요.</p>}
        </div>
      ) : (
        <>
          {/* Top Banner */}
          <div className="rounded-[26px] bg-doryeong-navy text-white p-6 shadow-doryeong">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-doryeong-gold text-xs font-bold">
                <ScrollText className="h-4 w-4" />
                <span>MY ARCHIVE</span>
              </div>
              <span className="text-xs bg-white/15 px-2.5 py-0.5 rounded-full font-bold">
                총 {fortunes.length}권의 기록
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold">나의 기록</h2>
            <p className="mt-1 text-xs text-white/70">
              저장한 사주 풀이와 대화를 다시 살펴보세요.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 text-doryeong-textMuted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="저장한 기록 검색"
                placeholder="이름, 일간 또는 제목으로 기록 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-doryeong-border text-xs bg-white focus:outline-none focus:border-doryeong-gold shadow-xs"
              />
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                aria-pressed={selectedCategory === "all"}
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-colors ${
                  selectedCategory === "all"
                    ? "bg-doryeong-navy text-white shadow-xs"
                    : "bg-white text-doryeong-textMuted border border-doryeong-border hover:text-doryeong-textDark"
                }`}
              >
                전체 ({fortunes.length})
              </button>
              {Object.entries(CATEGORY_MAP).map(([key, cat]) => {
                const count = categoryCounts[key];
                if (count === 0 && selectedCategory !== key) return null;
                return (
                  <button
                    key={key}
                    aria-pressed={selectedCategory === key}
                    onClick={() => setSelectedCategory(key)}
                    className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-colors ${
                      selectedCategory === key
                        ? "bg-doryeong-navy text-white shadow-xs"
                        : "bg-white text-doryeong-textMuted border border-doryeong-border hover:text-doryeong-textDark"
                    }`}
                  >
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card List */}
          {loading ? (
            <div className="py-16 text-center text-xs text-doryeong-textMuted font-serif">
              보관된 사주 서책을 불러오는 중이옵니다...
            </div>
          ) : loadError ? (
            <div role="alert" className="p-4 border border-red-200 bg-red-50 text-red-800 rounded-xl space-y-3">
              <p>{loadError}</p>
              <button type="button" className="secondary-button" onClick={() => { setLoading(true); setLoadError(null); setListRetry(count => count + 1); }}>다시 불러오기</button>
            </div>
          ) : fortunes.length === 0 ? (
            <div className="py-16 text-center rounded-[24px] bg-white border border-doryeong-border p-6 space-y-3 shadow-sm">
              <p className="text-sm font-serif font-bold text-doryeong-navy">
                아직 보관된 사주 풀이가 없습니다.
              </p>
              <p className="text-xs text-doryeong-textMuted">
                나의 우주에서 궁금한 주제로 풀이를 남겨보세요.
              </p>
              <Link
                href="/"
                className="inline-block mt-3 px-5 py-2.5 rounded-xl bg-doryeong-gold text-doryeong-navy text-xs font-bold shadow-md hover:brightness-105 transition-all"
              >
                사주 풀이 보러가기
              </Link>
            </div>
          ) : filteredFortunes.length === 0 ? (
            <div className="py-12 text-center rounded-[20px] bg-white/70 border border-doryeong-border p-5 text-xs text-doryeong-textMuted">
              검색 조건에 맞는 사주 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFortunes.map((f) => {
                const catInfo = CATEGORY_MAP[f.category || "overall"] || CATEGORY_MAP.overall;
                const createdDate = f.createdAt ? new Date(f.createdAt) : null;
                const formattedDate = createdDate
                  ? [
                    String(createdDate.getFullYear()).padStart(4, "0"),
                    String(createdDate.getMonth() + 1).padStart(2, "0"),
                    String(createdDate.getDate()).padStart(2, "0"),
                  ].join("-")
                  : "";

                return (
                  <div
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openFortune(f.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!e.repeat) openFortune(f.id);
                      }
                    }}
                    className="p-4 rounded-[22px] bg-white border border-doryeong-border hover:border-doryeong-gold/60 focus:outline-none focus:ring-2 focus:ring-doryeong-gold cursor-pointer shadow-sm active:scale-[0.99] transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-doryeong-ivoryDark text-doryeong-navy">
                          {f.name}님
                        </span>
                        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${catInfo.badge}`}>
                          {catInfo.label}
                        </span>
                        {f.dayMaster && (
                          <span className="text-[9.5px] font-bold text-doryeong-gold bg-doryeong-gold/10 px-1.5 py-0.5 rounded-md">
                            {f.dayMaster}
                          </span>
                        )}
                      </div>

                      <h4 className="font-serif text-sm font-bold text-doryeong-textDark mt-1.5 group-hover:text-doryeong-navy transition-colors truncate">
                        {f.title}
                      </h4>
                      <p className="text-xs text-doryeong-textMuted mt-1 line-clamp-1 font-serif">
                        {f.summary}
                      </p>
                      <span className="text-[10px] text-doryeong-textSubtle mt-1.5 block">
                        기록 일자: {formattedDate}
                      </span>
                    </div>

                    <ChevronRight className="h-5 w-5 text-doryeong-gold shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SavedPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <Suspense fallback={<div className="p-8 text-center text-xs text-doryeong-textMuted">불러오는 중...</div>}>
        <SavedContent />
      </Suspense>
    </div>
  );
}
