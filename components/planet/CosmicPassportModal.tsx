"use client";

import React, { useRef, useState, useEffect } from "react";
import { TEN_STEM_SPIRITS } from "@/lib/planet/spirit-profiles";
import { fitPassportTitle } from "@/lib/planet/passport-title";
import { GuinPerson } from "@/lib/saju/types";
import { X, Sparkles, Download, Share2, Compass, Check, Heart } from "lucide-react";

interface CosmicPassportModalProps {
  person: GuinPerson;
  isOpen: boolean;
  onClose: () => void;
  planetSnapshotUrl?: string;
}

export default function CosmicPassportModal({
  person,
  isOpen,
  onClose,
  planetSnapshotUrl,
}: CosmicPassportModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => { window.removeEventListener("keydown", handleKeyDown); previous?.focus(); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dayKey = person.pillars?.dayKey || "갑자";
  const stem = dayKey.charAt(0);
  const spirit = TEN_STEM_SPIRITS[stem] || TEN_STEM_SPIRITS["갑"];

  // 카카오톡 / SNS 은하 초대 링크 복사
  const handleCopyInviteLink = () => {
    const url = `${window.location.origin}/guin?join=true&from=${encodeURIComponent(person.name)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 9:16 인스타그램 스토리용 고해상도 여권 카드 이미지 생성 (HTML5 Canvas)
  const handleDownloadStoryCard = async () => {
    setDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. 우주 배경 그라데이션
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
      bgGrad.addColorStop(0, "#020617");
      bgGrad.addColorStop(0.3, "#0F172A");
      bgGrad.addColorStop(0.7, "#1E1B4B");
      bgGrad.addColorStop(1, "#020617");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1920);

      // 별빛 파티클
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      for (let i = 0; i < 180; i++) {
        const x = Math.random() * 1080;
        const y = Math.random() * 1920;
        const r = Math.random() * 2.2 + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. 상단 헤더
      ctx.fillStyle = "#E6C875";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("COSMIC SAJU PASSPORT · 우주 여권", 540, 150);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "24px monospace";
      ctx.fillText("HYPER3D GALAXY EXPLORATION ID", 540, 195);

      // 3. 카드 내부 프레임 (골드 테두리)
      ctx.strokeStyle = "rgba(230, 200, 117, 0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(80, 240, 920, 1500, 48);
      ctx.stroke();

      // 4. 이름 및 사주 간지
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(fitPassportTitle(ctx, `${person.name}님의 우주 정령`), 540, 360);

      ctx.fillStyle = "#F59E0B";
      ctx.font = "bold 38px sans-serif";
      ctx.fillText(`[${dayKey}] 일주 · ${spirit.name}`, 540, 430);

      // 5. 3D 행성 / 샌드맨 정령 샷 (있을 시 렌더링)
      if (planetSnapshotUrl) {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Passport snapshot could not be loaded."));
          img.src = planetSnapshotUrl;
        });
        ctx.save();
        ctx.beginPath();
        ctx.arc(540, 800, 300, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 240, 500, 600, 600);
        ctx.restore();

        ctx.strokeStyle = "#F59E0B";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(540, 800, 305, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // 대체 비주얼 원
        ctx.fillStyle = spirit.primaryColor;
        ctx.beginPath();
        ctx.arc(540, 800, 260, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. 종족 칭호 & 설명
      ctx.fillStyle = "#E2E8F0";
      ctx.font = "bold 42px sans-serif";
      ctx.fillText(spirit.speciesTitle, 540, 1200);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "28px sans-serif";
      const wrapText = (text: string, x: number, y: number, maxWidth: number) => {
        const words = text.split(" ");
        let line = "";
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + " ";
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + " ";
            y += 44;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, x, y);
      };
      wrapText(spirit.conceptDesc, 540, 1270, 780);

      // 7. 성격 태그 3종 캡슐
      let tagX = 220;
      spirit.personalityTraits.forEach((t) => {
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.beginPath();
        ctx.roundRect(tagX, 1420, 200, 64, 32);
        ctx.fill();

        ctx.fillStyle = "#FDE68A";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText(`#${t}`, tagX + 100, 1462);
        tagX += 230;
      });

      // 8. 하단 바이럴 푸터
      ctx.fillStyle = "#E6C875";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText("🚀 나의 나선은하로 너의 행성을 착륙시켜줘!", 540, 1590);

      ctx.fillStyle = "#64748B";
      ctx.font = "24px monospace";
      ctx.fillText("우리은하 인연망 · saju-galaxy.app", 540, 1650);

      // 9. 이미지 다운로드 트리거
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `우주여권_${person.name}_${dayKey}.png`;
      a.click();
    } catch {
      alert("스토리 카드 생성 중 오류가 발생했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label="우주 여권"
        className="relative w-full max-w-md bg-gradient-to-b from-[#0F172A] via-[#1E293B] to-[#0A0F1D] border border-doryeong-gold/30 rounded-[36px] p-6 text-white shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 닫기 */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-doryeong-gold/20 text-doryeong-gold">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-serif font-bold text-base text-doryeong-gold">
                우주 여권 (Cosmic Passport)
              </h3>
              <p className="text-[10px] text-white/60 font-mono">
                9:16 INSTAGRAM STORY READY
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="우주 여권 닫기"
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 9:16 프리뷰 카드 컨테이너 */}
        <div
          ref={cardRef}
          className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#020617] via-[#0B132B] to-[#1C2541] border border-doryeong-gold/40 p-5 text-center shadow-xl space-y-4"
        >
          <div className="text-[10px] text-doryeong-gold font-mono tracking-widest uppercase">
            ✦ GALACTIC CITIZENSHIP ID ✦
          </div>

          <div>
            <h4 className="text-xl font-bold font-serif text-white">
              {person.name}님의 3D 사주 정령
            </h4>
            <p className="text-xs text-doryeong-gold font-semibold mt-0.5">
              [{dayKey}] 일간 · {spirit.name}
            </p>
          </div>

          {/* 중앙 비주얼 (스냅샷 또는 슬라임 뱃지) */}
          <div className="relative mx-auto w-40 h-40 rounded-full overflow-hidden border-2 border-doryeong-gold/60 shadow-[0_0_25px_rgba(230,200,117,0.3)] bg-black/60 flex items-center justify-center">
            {planetSnapshotUrl ? (
              <img
                src={planetSnapshotUrl}
                alt={spirit.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center text-3xl shadow-inner font-bold"
                style={{ backgroundColor: spirit.primaryColor }}
              >
                ✨
              </div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-cyan-300">
              {spirit.speciesTitle}
            </span>
            <p className="text-[11px] text-white/75 leading-relaxed px-2 line-clamp-3">
              {spirit.conceptDesc}
            </p>
          </div>

          {/* 3가지 성격 태그 */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {spirit.personalityTraits.map((t, i) => (
              <span
                key={i}
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-doryeong-gold border border-doryeong-gold/30"
              >
                #{t}
              </span>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10 text-[10.5px] text-doryeong-gold/90 font-medium flex items-center justify-center gap-1">
            <Heart className="h-3 w-3 text-rose-400" />
            <span>나의 나선은하에 너의 행성을 착륙시켜줘!</span>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={handleDownloadStoryCard}
            disabled={downloading}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-doryeong-gold via-amber-400 to-yellow-500 text-doryeong-navy font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>{downloading ? "9:16 스토리 카드 생성 중..." : "인스타 스토리용 9:16 카드 저장 (PNG)"}</span>
          </button>

          <button
            onClick={handleCopyInviteLink}
            className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-white/15 transition-all"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">카톡 착륙 초대 링크 복사 완료!</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 text-doryeong-gold" />
                <span>카톡 초대 링크 복사 (내 은하로 착륙해줘)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
