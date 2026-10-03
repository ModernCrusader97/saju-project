"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, BookOpen, Flame, ScrollText } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "사주 보기", href: "/", icon: Home },
    { label: "귀인 지도", href: "/guin", icon: Compass },
    { label: "내 만세력", href: "/manse", icon: BookOpen },
    { label: "오늘 운세", href: "/daily", icon: Flame },
    { label: "사주 결과", href: "/saved", icon: ScrollText },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-doryeong-ivory/95 backdrop-blur-md border-t border-doryeong-border shadow-lg">
      <div className="max-w-lg md:max-w-xl mx-auto flex items-center justify-around px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                isActive ? "text-doryeong-navy font-bold" : "text-doryeong-textSubtle hover:text-doryeong-textMuted"
              }`}
            >
              <div className={`p-1 rounded-xl transition-colors ${isActive ? "bg-doryeong-gold/20" : ""}`}>
                <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
              </div>
              <span className="text-[10.5px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
