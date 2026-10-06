"use client";

import { readApiResponse } from "@/lib/http-client";


import React, { useState, useEffect, useRef } from "react";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import { FortuneResult } from "@/lib/saju/types";

interface Message {
  role: "user" | "doryeong";
  content: string;
  createdAt: string;
}

interface AskDoryeongModalProps {
  isOpen: boolean;
  onClose: () => void;
  fortune: FortuneResult;
}

export default function AskDoryeongModal({
  isOpen,
  onClose,
  fortune,
}: AskDoryeongModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // 대화 내역 불러오기
      fetch(`/api/saju/${fortune.id}`)
        .then((res) => readApiResponse(res))
        .then((data) => {
          if (data.chats && data.chats.length > 0) {
            setMessages(data.chats);
          } else {
            // 초기 인사 메시지
            setMessages([
              {
                role: "doryeong",
                content: `${fortune.analysis.name}님, 사주 풀이를 읽어보시며 마음에 남은 질문이나 더 알고 싶은 시기, 관계에 대해 편히 여쭈어보시옵소서.`,
                createdAt: new Date().toISOString(),
              },
            ]);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, fortune.id, fortune.analysis.name]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    const userMsg: Message = {
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`/api/saju/${fortune.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userText }),
      });
      const data = await readApiResponse(res);
      if (data.success && data.reply) {
        const reply = data.reply;
        setMessages((prev) => [
          ...prev,
          {
            role: "doryeong",
            content: reply,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        alert(data.error || "답변을 불러오지 못했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-doryeong-ivory rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-doryeong-border flex flex-col h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-doryeong-border/60 bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-doryeong-gold/20 flex items-center justify-center font-serif text-doryeong-navy font-bold text-sm">
              청
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-doryeong-navy leading-tight">
                나의 풀이에 관해
              </h3>
              <p className="text-[11px] text-doryeong-textMuted">
                {fortune.analysis.name}님의 사주를 바탕으로 상담합니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-doryeong-textMuted hover:bg-black/5"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                m.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-doryeong-navy text-white rounded-br-none shadow-sm"
                    : "bg-white text-doryeong-textDark border border-doryeong-border rounded-bl-none shadow-sm font-serif"
                }`}
              >
                {m.content}
              </div>
              <span className="text-[10px] text-doryeong-textSubtle mt-1 px-1">
                {m.role === "user" ? "나" : "해석 안내"}
              </span>
            </div>
          ))}

          {loading && (
            <div className="flex flex-col items-start">
              <div className="rounded-2xl bg-white border border-doryeong-border px-4 py-3 text-sm text-doryeong-textMuted rounded-bl-none flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-doryeong-gold" />
                <span className="font-serif">답변을 정리하고 있어요.</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-white border-t border-doryeong-border flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="궁금한 시기, 연애, 이직 등 마음껏 물어보세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-doryeong-ivory border border-doryeong-border text-sm focus:outline-none focus:border-doryeong-navy"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="h-11 w-11 rounded-xl bg-doryeong-navy text-white flex items-center justify-center disabled:opacity-40 hover:bg-doryeong-navyDark active:scale-95 transition-all shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
