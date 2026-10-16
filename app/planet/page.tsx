"use client";
import React, { lazy, Suspense, useRef, useState } from "react";
import Header from "@/components/Header";
import CosmicPassportModal from "@/components/planet/CosmicPassportModal";
import { SIXTY_GANZI_KEYS, getStemThemePreset } from "@/lib/planet/theme-library";
import { TEN_STEM_SPIRITS } from "@/lib/planet/spirit-profiles";
import { ZODIAC_FEATURES, type ZodiacBranch } from "@/lib/planet/spirit-profiles";
import { calculateUniverse, type UniverseBirth } from "@/lib/universe-state";
import { useUniverse } from "@/hooks/use-universe";
import type { MaskStyle } from "@/lib/planet/uv-mask";
import { Camera, Calendar, Sliders } from "lucide-react";
import GanziMascotScene from "@/components/planet/GanziMascotScene";
import { getGanziMascot, MASCOT_ASSET_VERSION } from "@/lib/planet/ganzi-mascot";

const PlanetCanvas = lazy(() => import("@/components/planet/PlanetCanvas"));
const masks: { key: MaskStyle; label: string }[] = [
  { key: "pangaea", label: "하나의 대륙" }, { key: "archipelago", label: "작은 섬들" },
  { key: "tectonic", label: "대지의 결" }, { key: "bands", label: "흐르는 띠" }, { key: "vortices", label: "소용돌이" },
];

export default function PlanetStudioPage() {
  const { snapshot, commit, ready, error, setError } = useUniverse();
  const [captured, setCaptured] = useState<{ key:string; url:string } | null>(null);
  const [passportOpen, setPassportOpen] = useState(false);
  const sceneRef = useRef<HTMLElement>(null);
  const [appliedBirth, setAppliedBirth] = useState<UniverseBirth | null>(null);
  const applied = appliedBirth === snapshot.birth;
  const [form, setForm] = useState({ birth:snapshot.birth, draft:snapshot.birth });
  const draft = form.birth === snapshot.birth ? form.draft : snapshot.birth;
  const { mode, dayKey, monthKey, yearKey, hourKey, maskStyle, birth } = snapshot;
  const profile = TEN_STEM_SPIRITS[dayKey.charAt(0)] || TEN_STEM_SPIRITS.갑;
  const mascot = getGanziMascot(dayKey);
  const day = getStemThemePreset(dayKey), month = getStemThemePreset(monthKey);
  const animal = ZODIAC_FEATURES[dayKey.charAt(1) as ZodiacBranch]?.label;
  const sceneKey = [mode, dayKey, monthKey, yearKey, hourKey, maskStyle, birth.unknown, MASCOT_ASSET_VERSION].join(":");
  const snapshotUrl = captured?.key === sceneKey ? captured.url : "";
  const capture = (url:string) => setCaptured({ key:sceneKey, url });
  function openPassport() {
    const canvas = sceneRef.current?.querySelector<HTMLCanvasElement>('[data-scene-state="ready"] canvas');
    if (canvas) { try { capture(canvas.toDataURL('image/png')); } catch { /* Metadata card remains available. */ } }
    setPassportOpen(true);
  }
  function changeBirth(key: keyof UniverseBirth, value: string | boolean) {
    setForm({ birth:snapshot.birth, draft:{ ...draft, [key]:value } });
    setAppliedBirth(null);
  }
  function applyBirth(event: React.FormEvent) {
    event.preventDefault(); setError("");
    try { const next = calculateUniverse(draft, snapshot); commit(next, true); setAppliedBirth(next.birth); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "입력을 확인해주세요."); setAppliedBirth(null); }
  }
  function selectPillar(key: "dayKey" | "monthKey" | "yearKey" | "hourKey", value: string) {
    commit({ ...snapshot, [key]: value, source: "example" }, true); setAppliedBirth(null);
  }

  return <div className="universe-page">
    <Header/>
    <div className="universe-workspace">
      <div className="universe-heading">
        <div><p className="eyebrow">{snapshot.source === "example" ? "예시 조합 · 직접 둘러보기" : (birth.name || "나") + "의 우주"}</p>
          <h1>{mode === "spirit" ? "나를 닮은 마스코트" : "나만의 작은 행성"}</h1></div>
        <button type="button" className="secondary-button" onClick={openPassport}><Camera size={18}/>이미지로 간직하기</button>
      </div>
      <div className="universe-result-grid">
        <section ref={sceneRef} className={"universe-viewport " + mode} aria-label={mode === "spirit" ? "원소 동물 마스코트" : "행성 입체 화면"}>
          {ready ? <Suspense fallback={<div className="scene-placeholder" role="status"><span>내 우주를 준비하고 있어요.</span></div>}>
            {mode === "spirit" ? <GanziMascotScene dayKey={dayKey} monthKey={monthKey} yearKey={yearKey} hourKey={hourKey} isUnknownTime={birth.unknown} onCapture={capture}/>
              : <PlanetCanvas dayKey={dayKey} monthKey={monthKey} hourKey={hourKey} yearKey={yearKey}
                  isUnknownTime={birth.unknown} maskStyle={maskStyle} onCapture={capture}/>}
          </Suspense> : <div className="scene-placeholder" role="status"><span>내 우주를 준비하고 있어요.</span></div>}
        </section>
        <aside className="universe-profile" aria-live="polite">
          <p className="eyebrow">{mode === "spirit" ? "나의 원소 동반자" : "내가 이루는 세계"}</p>
          <h2>{mode === "spirit" ? mascot?.title || dayKey : day.themeName}</h2>
          <p className="identity-line">{mode === "spirit" ? `${dayKey}의 원소와 동물로 만나요.` : "일주와 월주가 하나의 표면에서 만나요."}</p>
          {mode === "spirit" ? <>
            <div className="identity-traits">{profile.personalityTraits.map(trait => <span key={trait}>{trait}</span>)}</div>
            <p>일간의 원소와 일지의 동물이 하나의 마스코트로 만나요.</p>
            <dl className="identity-facts"><div><dt>나의 마스코트</dt><dd>{mascot?.title || dayKey}</dd></div>
              <div><dt>월령 배경</dt><dd>{monthKey} · {month.themeName}</dd></div>
              <div><dt>일지 동물</dt><dd>일지 {dayKey.charAt(1)} · {animal}</dd></div></dl>
            <button className="primary-button" type="button" onClick={() => commit({ ...snapshot, mode: "planet" }, true)}>같은 나의 행성 보기</button>
          </> : <>
            <dl className="identity-facts"><div><dt>일주 · 표면 70%</dt><dd>{dayKey} · {day.themeName}</dd></div>
              <div><dt>월주 · 표면 30%</dt><dd>{monthKey} · {month.themeName}</dd></div>
              <div><dt>시주 · 위성</dt><dd>{birth.unknown ? "시간을 몰라 위성은 쉬고 있어요." : hourKey}</dd></div>
              <div><dt>연주 · 소행성대</dt><dd>{yearKey}</dd></div></dl>
            <p>대기와 계절 장식 없이, 네 기둥의 재질을 그대로 만나요.</p>
            <button className="primary-button" type="button" onClick={() => commit({ ...snapshot, mode: "spirit" }, true)}>같은 나의 마스코트 보기</button>
          </>}
          <p className="form-note">이름과 특징은 사주를 표현한 디자인 해석입니다. 성격을 확정하는 검사 결과는 아니에요.</p>
        </aside>
      </div>
      {mode === "planet" && <section className="surface-options" aria-label="행성 표면 무늬">
        <h2>표면을 가까이 둘러보세요.</h2><div>{masks.map(mask => <button key={mask.key} type="button"
          aria-pressed={maskStyle === mask.key} onClick={() => commit({ ...snapshot, maskStyle: mask.key }, true)}>{mask.label}</button>)}</div>
      </section>}
      <div className="universe-controls">
        <details className="universe-disclosure" open>
          <summary><Calendar size={19}/><span>내 사주로 만나기</span></summary>
          <form className="birth-panel" onSubmit={applyBirth}
            onKeyDown={event => {
              if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
            }}>
            <p>양력 생년월일을 입력하면 정령과 행성에 같은 사주가 반영돼요.</p>
            <label>이름 또는 별명<input aria-label="스튜디오 이름" value={draft.name} maxLength={40} autoComplete="nickname" onChange={e => changeBirth("name", e.target.value)}/></label>
            <div className="field-grid">
              <label>연도<input aria-label="스튜디오 연도" required type="number" min={1900} max={2100} inputMode="numeric" value={draft.year} onChange={e => changeBirth("year", e.target.value)}/></label>
              <label>월<input aria-label="스튜디오 월" required type="number" min={1} max={12} inputMode="numeric" value={draft.month} onChange={e => changeBirth("month", e.target.value)}/></label>
              <label>일<input aria-label="스튜디오 일" required type="number" min={1} max={31} inputMode="numeric" value={draft.day} onChange={e => changeBirth("day", e.target.value)}/></label>
            </div>
            <div className="time-row"><label>시<input aria-label="스튜디오 시" required type="number" min={0} max={23} disabled={draft.unknown} value={draft.hour} onChange={e => changeBirth("hour", e.target.value)}/></label>
              <label>분<input aria-label="스튜디오 분" required type="number" min={0} max={59} disabled={draft.unknown} value={draft.minute} onChange={e => changeBirth("minute", e.target.value)}/></label>
              <label className="checkbox-label"><input aria-label="스튜디오 시간 모름" type="checkbox" checked={draft.unknown} onChange={e => changeBirth("unknown", e.target.checked)}/>시간 모름</label></div>
            {error && <p role="alert" className="form-error">{error}</p>}
            {applied && <p role="status" className="form-note">같은 사주를 정령과 행성에 반영했어요.</p>}
            <button type="submit" className="primary-button">내 사주 반영하기</button>
            <p className="form-note"><a href="/manse">양력·자세한 사주 구성</a> · 절기와 대운 계산은 검증 중입니다.</p>
          </form>
        </details>
        <details className="universe-disclosure">
          <summary><Sliders size={19}/><span>조합을 직접 둘러보기</span></summary>
          <div className="pillar-inspector">
            <p>재질을 직접 고르면 계산 결과 대신 예시 조합으로 표시돼요.</p>
            {([{ key: "dayKey", label: mode === "spirit" ? "마스코트 · 일주" : "주 표면 · 일주 70%" },
              { key: "monthKey", label: mode === "spirit" ? "배경 · 월령" : "보조 표면 · 월주 30%" },
              ...(mode === "planet" ? [{ key: "hourKey", label: "위성 · 시주" }, { key: "yearKey", label: "소행성대 · 연주" }] : [])
            ] as { key: "dayKey" | "monthKey" | "hourKey" | "yearKey"; label: string }[]).map(item => <label key={item.key}>{item.label}
              <select aria-label={item.label} value={snapshot[item.key]} disabled={item.key === "hourKey" && birth.unknown}
                onChange={e => selectPillar(item.key, e.target.value)}>{SIXTY_GANZI_KEYS.map(pillar => <option key={pillar.key} value={pillar.key}>{pillar.key} ({pillar.hanja})</option>)}</select></label>)}
            <p className="form-note">일간의 원소와 일지의 동물이 마스코트를 이루고, 월령은 배경에 반영돼요. 행성은 기존 십간 재질을 사용합니다.</p>
          </div>
        </details>
      </div>
    </div>
    <CosmicPassportModal isOpen={passportOpen} onClose={() => setPassportOpen(false)} planetSnapshotUrl={snapshotUrl}
      person={{ id: "me", name: birth.name || "나", relationType: "mentor", relationTitle: "나의 중심별", dayMaster: dayKey.charAt(0),
        elementMatch: "본인", affinityScore: 100, advice: "나의 원소 동반자", isMe: true,
        pillars: { dayKey, monthKey, yearKey, hourKey: birth.unknown ? undefined : hourKey } }}/>
  </div>;
}
