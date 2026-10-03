import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "사주도령 — 도령이 그려주는 나의 사주",
  description: "비유로 풀어주는 사주. 오늘의 기운, 내 사주 풀이, 두 사람의 불꽃, 10년의 흐름까지.",
  icons: { icon: "/favicon.svg" },
  keywords: ["사주", "운세", "궁합", "사주도령", "귀인지도", "AI사주", "만세력"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen bg-[#EFECE4] text-doryeong-textDark antialiased flex flex-col items-center">
        {/* Responsive layout adapting to screen aspect ratio (mobile to widescreen) */}
        <div className="w-full max-w-6xl min-h-screen bg-doryeong-ivory flex flex-col relative shadow-xl border-x border-doryeong-border/30">
          <div className="px-4 py-2 text-xs text-center bg-amber-50 text-amber-900 border-b border-amber-200">비공개 테스트 · 기존 기록 미이전 · 일반 풀이 AI 미연결 · 절기·대운 검증 중 · 관계 점수는 임의 예시입니다. <a href="/ai-test" className="underline font-semibold ml-2">가상 AI 시험</a> <a href="/lab" className="underline font-semibold ml-2">재질 비교실</a></div>
          <main className="flex-1 pb-24">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
