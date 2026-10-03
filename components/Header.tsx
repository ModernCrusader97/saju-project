"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Sparkles, BookOpen, User, HelpCircle, Receipt, ScrollText } from "lucide-react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    if (isMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  return (
    <>
      <header className="flex items-center justify-between px-6 pt-5 pb-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-doryeong-gold/20 text-doryeong-navy font-serif font-bold text-lg shadow-sm">
            <span>청</span>
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-doryeong-gold text-[9px] text-doryeong-navy font-bold">
              ★
            </span>
          </div>
          <span className="font-serif text-[20px] font-bold text-doryeong-navy tracking-tight">
            사주도령
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-doryeong-textMuted font-medium">
            방문자님, 반가워요
          </span>
          <button
            onClick={() => setIsMenuOpen(true)}
            aria-label="메뉴 열기"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-doryeong-ivoryDark text-doryeong-navy hover:bg-doryeong-border transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Side Drawer Menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="w-[min(320px,85vw)] h-full bg-doryeong-ivory flex flex-col shadow-2xl p-5 border-l border-doryeong-border overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-doryeong-border">
              <div className="flex items-center gap-2">
                <span className="font-serif text-lg font-bold text-doryeong-navy">
                  도령의 방
                </span>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-1 text-doryeong-textMuted hover:text-doryeong-textDark"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="py-4">
              <div className="rounded-2xl bg-white p-4 border border-doryeong-border shadow-sm">
                <p className="text-xs text-doryeong-textMuted font-medium">나의 보유권</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-doryeong-navy">풀이 이용권 1회</span>
                  <span className="text-xs font-semibold text-doryeong-roseText bg-doryeong-roseBg px-2 py-0.5 rounded-full">
                    무료 체험 가능
                  </span>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 text-sm font-medium text-doryeong-textDark">
              <Link
                href="/planet"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-doryeong-gold/15 text-doryeong-navy font-bold hover:bg-doryeong-gold/25 transition-colors"
              >
                <Sparkles className="h-4 w-4 text-doryeong-gold" />
                <span>3D 개인 행성 스튜디오</span>
                <span className="ml-auto text-[9px] bg-doryeong-navy text-white px-1.5 py-0.5 rounded-full font-bold">
                  NEW
                </span>
              </Link>
              <Link
                href="/saved"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/80 transition-colors"
              >
                <ScrollText className="h-4 w-4 text-doryeong-gold" />
                <span>사주 결과 보관함</span>
              </Link>
              <Link
                href="/guin"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/80 transition-colors"
              >
                <Sparkles className="h-4 w-4 text-doryeong-gold" />
                <span>귀인 지도 만들기</span>
              </Link>
              <Link
                href="/manse"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/80 transition-colors"
              >
                <BookOpen className="h-4 w-4 text-doryeong-gold" />
                <span>내 만세력 보기</span>
              </Link>
            </nav>

            <div className="pt-4 mt-auto border-t border-doryeong-border text-[11px] text-doryeong-textSubtle leading-relaxed">
              <p className="font-semibold text-doryeong-textMuted">사주도령 안내</p>
              <p className="mt-1">
                정통 명리학 알고리즘과 감성적 비유로 풀이하는 독립 사주 서비스입니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
