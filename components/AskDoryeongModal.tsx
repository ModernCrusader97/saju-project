"use client";

import { readApiResponse } from "@/lib/http-client";


import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
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

export default function AskDoryeongModal(props: AskDoryeongModalProps) {
  return <Conversation key={props.fortune.id} {...props} />;
}

function Conversation({
  isOpen,
  onClose,
  fortune,
}: AskDoryeongModalProps) {
  const [visit, setVisit] = useState({ open: isOpen, version: 0 });
  if (visit.open !== isOpen) setVisit({ open: isOpen, version: visit.version + 1 });
  const [historyRetry, setHistoryRetry] = useState(0);
  const historyToken = `${visit.version}:${historyRetry}`;
  const [history, setHistory] = useState<{ token: string; messages: Message[]; error: string }>({ token: "", messages: [], error: "" });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [resendChoice, setResendChoice] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const persistedCount = useRef(0);
  const uncertainSend = useRef<{ question: string; after: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = history.messages;
  const historyLoading = history.token !== historyToken;
  const historyError = history.token === historyToken ? history.error : "";
  const canSend = !loading && !historyLoading && !historyError && !needsReview;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!isOpen || inFlight.current) return;
    const controller = new AbortController();
    fetch(`/api/saju/${encodeURIComponent(fortune.id)}`, { signal: controller.signal })
      .then(async res => {
        const data = await readApiResponse(res);
        if (!res.ok) throw new Error(data.error || "대화 기록을 불러오지 못했어요.");
        if (!Array.isArray(data.chats) || !data.chats.every(message =>
          message !== null && typeof message === "object" &&
          (message.role === "user" || message.role === "doryeong") &&
          typeof message.content === "string"
        )) throw new Error("대화 기록을 확인할 수 없습니다.");
        return data.chats;
      })
      .then(chats => {
        if (controller.signal.aborted) return;
        const uncertain = uncertainSend.current;
        if (uncertain) {
          const found = chats.slice(uncertain.after).some(message => message.role === "user" && message.content === uncertain.question);
          if (found) {
            setInput(current => current.trim() === uncertain.question ? "" : current);
            setNotice("질문이 이미 대화에 저장되어 있어요. 대화 기록을 확인해 주세요.");
            uncertainSend.current = null;
            setNeedsReview(false);
            setResendChoice(false);
            setSendError("");
          } else {
            setNotice("");
            setSendError("지금 불러온 기록에는 질문이 없지만, 이전 요청이 나중에 저장될 수도 있어요. 다시 보내면 같은 질문이 중복될 수 있습니다.");
            setNeedsReview(true);
            setResendChoice(true);
          }
        }
        persistedCount.current = chats.length;
        setHistory({ token: historyToken, error: "", messages: chats.length ? chats : [{ role: "doryeong", content: `${fortune.analysis.name}님, 사주 풀이에서 궁금한 점을 질문해 주세요.`, createdAt: new Date().toISOString() }] });
      })
      .catch(error => {
        if (!controller.signal.aborted) setHistory(previous => ({ ...previous, token: historyToken, error: error.message || "대화 기록을 불러오지 못했어요." }));
      });
    return () => controller.abort();
  }, [isOpen, fortune.id, fortune.analysis.name, historyToken]);

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

  const handleSend = async (e: React.FormEvent, allowResend = false) => {
    e.preventDefault();
    if (!input.trim() || loading || historyLoading || historyError || (!allowResend && needsReview) || inFlight.current) return;
    // A synchronous fence also covers two submits before React has committed
    // the disabled button. Failed/uncertain requests are never retried here.
    inFlight.current = true;
    const userText = input.trim();
    const after = persistedCount.current;
    setLoading(true);
    setSendError("");
    setNotice("");
    setResendChoice(false);
    setNeedsReview(false);
    uncertainSend.current = null;
    let acknowledged = false;
    try {
      const res = await fetch(`/api/saju/${encodeURIComponent(fortune.id)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userText }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || !data.success || !data.reply) throw new Error(data.error || "답변을 확인하지 못했어요.");
      if (!mounted.current) return;
      const now = new Date().toISOString();
      setHistory(previous => ({ ...previous, messages: [...previous.messages, { role: "user", content: userText, createdAt: now }, { role: "doryeong", content: data.reply!, createdAt: now }] }));
      setInput(current => current.trim() === userText ? "" : current);
      acknowledged = true;
    } catch (error) {
      if (!mounted.current) return;
      uncertainSend.current = { question: userText, after };
      setNeedsReview(true);
      setSendError(`${error instanceof Error ? error.message : "네트워크 응답을 확인하지 못했어요."} 질문은 입력란에 남겨두었어요. 중복 전송을 피하려면 대화 기록을 먼저 확인해 주세요.`);
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setLoading(false);
        // Reconcile the authoritative history after an acknowledged write,
        // including completion while the dialog was closed then reopened.
        if (acknowledged) setHistoryRetry(count => count + 1);
      }
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
            aria-label="대화 닫기"
            className="p-1 rounded-full text-doryeong-textMuted hover:bg-black/5"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
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

        {/* Keep recovery next to the composer, outside the scrolling history. */}
        <div className="px-3 space-y-2">
          {historyLoading && !loading && !sendError && <p role="status" className="text-sm text-doryeong-textMuted">대화 기록을 불러오고 있어요.</p>}
          {historyError && <div role="alert" className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm space-y-2">
            <p>{historyError}</p><button type="button" className="secondary-button" onClick={() => setHistoryRetry(count => count + 1)}>대화 기록 다시 불러오기</button>
          </div>}
          {sendError && <div role="alert" className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm space-y-2">
            <p>{sendError}</p><button type="button" className="secondary-button" onClick={() => setHistoryRetry(count => count + 1)}>대화 기록 확인하기</button>
            {resendChoice && <button type="button" className="secondary-button" disabled={loading || historyLoading || !!historyError || !input.trim()} onClick={event => void handleSend(event, true)}>중복 가능성을 알고 다시 보내기</button>}
          </div>}
          {notice && <div className="space-y-2"><p role="status" className="text-sm text-doryeong-textMuted">{notice}</p>
            <button type="button" className="secondary-button" disabled={loading || historyLoading} onClick={() => setHistoryRetry(count => count + 1)}>기록 다시 확인</button></div>}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-white border-t border-doryeong-border flex items-center gap-2"
        >
          <input
            type="text"
            aria-label="사주 풀이 질문"
            maxLength={500}
            placeholder="궁금한 시기, 연애, 이직 등 마음껏 물어보세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || historyLoading || !!historyError}
            className="flex-1 px-4 py-3 rounded-xl bg-doryeong-ivory border border-doryeong-border text-sm focus:outline-none focus:border-doryeong-navy"
          />
          <button
            type="submit"
            aria-label="질문 보내기"
            disabled={!input.trim() || !canSend}
            className="h-11 w-11 rounded-xl bg-doryeong-navy text-white flex items-center justify-center disabled:opacity-40 hover:bg-doryeong-navyDark active:scale-95 transition-all shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
