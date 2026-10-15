"use client";

import React from "react";
import Header from "@/components/Header";
import { Flame, Sparkles, Sun, Moon, Coffee, ShieldCheck } from "lucide-react";
import { getDailyPillar } from "@/lib/saju/manse";
import { useLocalDate } from "@/lib/use-local-date";

const ELEMENT_DATA: Record<
  string,
  {
    korean: string;
    badgeBg: string;
    colors: string;
    numbers: string;
    direction: string;
    food: string;
    mindset: string;
  }
> = {
  wood: {
    korean: "목(木) - 푸른 생명력의 기운",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    colors: "포레스트 그린 & 민트",
    numbers: "3과 8",
    direction: "동쪽 (따뜻한 햇살이 드는 창가)",
    food: "신선한 샐러드 또는 녹차",
    mindset: "새로운 시작을 두려워하지 않고 첫 발을 내딛기",
  },
  fire: {
    korean: "화(火) - 밝고 열정적인 기운",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
    colors: "선셋 레드 & 웜 코랄",
    numbers: "2와 7",
    direction: "남쪽 (활기가 넘치는 번화가)",
    food: "따뜻한 아메리카노 또는 매콤한 요리",
    mindset: "밝은 미소로 주변 사람들에게 먼저 인사 건네기",
  },
  earth: {
    korean: "토(土) - 묵직하고 비옥한 대지의 기운",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    colors: "아이보리 & 샌드 베이지",
    numbers: "5와 10",
    direction: "중앙 (내 방의 가장 편안한 자리)",
    food: "따뜻한 곡물차나 견과류",
    mindset: "서두르지 않고 기본을 충실히 지키는 안정감",
  },
  metal: {
    korean: "금(金) - 명확하고 단단한 결단의 기운",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-300",
    colors: "스노우 화이트 & 실버",
    numbers: "4와 9",
    direction: "서쪽 (노을이 지는 방향)",
    food: "상큼한 과일 또는 배도라지차",
    mindset: "불필요한 생각과 잡동사니를 말끔히 정리하기",
  },
  water: {
    korean: "수(水) - 깊은 지혜와 유연한 흐름의 기운",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    colors: "딥 네이비 & 스카이 블루",
    numbers: "1과 6",
    direction: "북쪽 (조용하고 차분한 서재)",
    food: "맑은 생수 또는 해조류",
    mindset: "장애물을 억지로 뚫기보다 물처럼 유연하게 우회하기",
  },
};

export default function DailyPage() {
  const localDate = useLocalDate();
  const [year, month, day] = localDate.split("-").map(Number);
  const dateInfo = localDate ? {
    dateStr: `${year}년 ${month}월 ${day}일`,
    dailyPillar: getDailyPillar(year, month, day),
  } : {
    dateStr: "오늘의 해석",
    dailyPillar: {
      gan: "기",
      ji: "해",
      ganHanja: "己",
      jiHanja: "亥",
      element: "earth",
      elemKo: "토",
      name: "기해 (己亥)",
    },
  };

  const elementInfo = ELEMENT_DATA[dateInfo.dailyPillar.element] || ELEMENT_DATA.earth;

  const dailyFortunes = [
    {
      time: "아침 (07:00 ~ 12:00)",
      theme: "마음을 차분히 정리하는 고요한 시작",
      desc: "오늘은 머릿속에 새로운 아이디어가 샘솟는 날입니다. 조급하게 결정을 내리기보다 따뜻한 차 한 잔과 함께 우선순위를 정해보세요.",
      icon: Sun,
    },
    {
      time: "오후 (12:00 ~ 18:00)",
      theme: "주변과의 소통에서 기회를 얻는 시간",
      desc: "동료나 지인들과 가벼운 대화를 나누는 과정에서 막혔던 문제의 실마리가 풀리게 됩니다. 열린 귀로 조언을 들어보세요.",
      icon: Coffee,
    },
    {
      time: "저녁 (18:00 ~ 23:00)",
      theme: "나 자신을 토닥이고 에너지를 채우는 휴식",
      desc: "하루 동안 애쓴 자신에게 칭찬을 건네주세요. 좋아하는 음악을 듣거나 가벼운 산책으로 기운의 피로를 씻어내기에 참 좋은 밤입니다.",
      icon: Moon,
    },
  ];

  return (
    <div className="min-h-screen pb-20">
      <Header />

      <div className="px-5 pt-2 space-y-5">
        {/* Top Banner */}
        <div className="rounded-[26px] bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 text-white p-6 shadow-doryeong relative overflow-hidden">
          <div className="flex items-center gap-2 text-amber-200 text-xs font-bold mb-2">
            <Flame className="h-4 w-4" />
            <span>오늘의 기운 · 정통 일진(日辰)</span>
          </div>
          <h2 className="font-serif text-2xl font-bold">{dateInfo.dateStr} 운세</h2>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>
              오늘의 일진: <strong className="text-amber-200 font-bold">{dateInfo.dailyPillar.name}일</strong> ({elementInfo.korean})
            </span>
          </div>
          <p className="mt-2 text-xs text-white/80">
            매일 자정 바뀌는 하늘과 땅의 자연 리듬에 맞춘 생활 개운 처방전입니다.
          </p>
        </div>

        {/* Daily Advice Cards */}
        <div className="space-y-3">
          {dailyFortunes.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="p-5 rounded-[22px] bg-white border border-doryeong-border shadow-sm space-y-2 hover:border-doryeong-gold/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-doryeong-gold">
                  <Icon className="h-4 w-4" />
                  <span>{f.time}</span>
                </div>
                <h3 className="font-serif text-base font-bold text-doryeong-navy">
                  {f.theme}
                </h3>
                <p className="text-xs leading-relaxed text-doryeong-textMuted font-serif">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Dynamic Lucky Point of the Day */}
        <div className="rounded-[22px] bg-[#FAF6EC] border border-doryeong-border p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-doryeong-navy font-serif font-bold text-sm">
              <Sparkles className="h-4 w-4 text-doryeong-gold" />
              <span>오늘의 기운과 생활 힌트</span>
            </div>
            <span className="text-[10px] text-doryeong-textSubtle bg-white px-2 py-0.5 rounded-full border border-doryeong-border">
              {dateInfo.dailyPillar.ganHanja}{dateInfo.dailyPillar.jiHanja} 일진 기반
            </span>
          </div>

          <p className="text-xs leading-relaxed text-doryeong-textMuted">
            오늘의 일진을 일상에 빗댄 해석이에요. 내 상황과 연결해 참고해보세요.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs text-doryeong-textDark">
            <div className="p-3 rounded-xl bg-white border border-doryeong-border">
              <span className="text-doryeong-textMuted block text-[10.5px]">행운의 색상</span>
              <span className="font-bold text-doryeong-navy">{elementInfo.colors}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-doryeong-border">
              <span className="text-doryeong-textMuted block text-[10.5px]">행운의 숫자</span>
              <span className="font-bold text-doryeong-navy">{elementInfo.numbers}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-doryeong-border">
              <span className="text-doryeong-textMuted block text-[10.5px]">행운의 방위</span>
              <span className="font-bold text-doryeong-navy">{elementInfo.direction}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-doryeong-border">
              <span className="text-doryeong-textMuted block text-[10.5px]">추천 다과</span>
              <span className="font-bold text-doryeong-navy">{elementInfo.food}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/80 border border-doryeong-gold/30 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-doryeong-gold shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-doryeong-navy block">오늘의 마음가짐 처방</span>
              <p className="text-doryeong-textMuted text-[11.5px] mt-0.5 font-serif leading-relaxed">
                &quot;{elementInfo.mindset}&quot;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
