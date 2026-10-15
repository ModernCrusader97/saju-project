"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import SajuInputModal from '@/components/SajuInputModal';
import FortuneCard from '@/components/FortuneCard';
import type { FortuneResult } from '@/lib/saju/types';
import { parseSajuInput } from '@/lib/saju/input';
import styles from './home.module.css';
import { EXAMPLE_UNIVERSE, readUniverseSession, UNIVERSE_CHANGE_EVENT } from '@/lib/universe-state';
import GanziMascotImage from '@/components/planet/GanziMascotImage';

const readings = [
  ['overall', '나의 성향'], ['love', '연애와 관계'], ['match', '두 사람의 궁합'],
  ['career', '일과 재물'], ['year', '한 해의 흐름'], ['daewun', '긴 시간의 흐름'],
  ['consult', '궁금한 이야기'],
];

export default function Home() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(EXAMPLE_UNIVERSE);
  useEffect(() => {
    const restore = () => setSnapshot(readUniverseSession() || EXAMPLE_UNIVERSE);
    restore();
    window.addEventListener(UNIVERSE_CHANGE_EVENT, restore);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener(UNIVERSE_CHANGE_EVENT, restore);
      window.removeEventListener('popstate', restore);
    };
  }, []);
  const [modal, setModal] = useState({ open: false, category: 'overall', title: '나의 성향' });
  const [result, setResult] = useState<FortuneResult | null>(null);
  const [name, setName] = useState('');
  const [y, setY] = useState('1998');
  const [m, setM] = useState('5');
  const [d, setD] = useState('15');
  const [h, setH] = useState('14');
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      parseSajuInput({ name: name.trim() || '나', gender: 'male', birthYear: y, birthMonth: m,
        birthDay: d, birthHour: unknown ? undefined : h, isUnknownTime: unknown, calendarType: 'solar' });
      const query = new URLSearchParams({ name: name.trim() || '나', y, m, d, h, unknown: String(unknown) });
      router.push('/planet?' + query.toString());
    } catch (error) {
      setError(error instanceof Error ? error.message : '입력을 확인해주세요.');
    }
  }

  return <>
    <Header />
    <details className="site-notice">
      <summary>비공개 테스트 · 해석과 계산 범위 안내</summary>
      <p>기존 기록은 이전되지 않았습니다. 일반 풀이·대화는 준비된 문구를 사용합니다. 절기·대운 계산은 검증 중이며, 관계 점수는 임의의 예시입니다. 생년월일과 입력 내용은 일반 흐름에서 외부 AI로 보내지 않습니다.</p>
      <p><a href="/ai-test">가상 AI 시험</a><a href="/lab">재질 실험실</a></p>
    </details>
    <div className={'home-workspace ' + styles.workspace}>
      <section className={styles.intro} aria-labelledby="home-title">
        <div>
          <p className="eyebrow">태어난 순간에서 시작하는 이야기</p>
          <h1 id="home-title">나를 닮은 우주</h1>
          <p className={styles.introText}>나의 사주를 원소 동물 마스코트와 행성으로 만나보세요.<br />소중한 사람들과는 하나의 은하로 이어져요.</p>
        </div>
        <a href="#birth-form" className={'primary-button ' + styles.start}>
          나의 우주 만들기 <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section className={styles.entries} aria-label="예시 먼저 둘러보기">
        <Link href="/planet" prefetch={false} onNavigate={event => { event.preventDefault(); router.push('/planet'); }} className={styles.entry} aria-labelledby="spirit-entry-title">
          <div className={styles.media + ' ' + styles.jade}>
            <GanziMascotImage dayKey={snapshot.dayKey} priority className="mascot-home-portrait"/>
          </div>
          <div className={styles.entryText}>
            <span className={styles.example}>{snapshot.source === 'example' ? '예시' : '내 일주'} · {snapshot.dayKey}</span>
            <h2 id="spirit-entry-title">마스코트 · 행성 보기</h2>
            <p>태어난 날을 나만의 모습으로.</p>
            <span className={styles.arrow} aria-hidden="true">→</span>
          </div>
        </Link>
        <Link href="/guin" prefetch={false} onNavigate={event => { event.preventDefault(); router.push('/guin'); }} className={styles.entry} aria-labelledby="galaxy-entry-title">
          <div className={styles.media + ' ' + styles.cosmos}>
            <img src="/images/cosmos-cover.png" alt="서로 다른 행성과 작은 위성이 모인 은하의 콘셉트 예시" width={1536} height={1024} loading="lazy" />
          </div>
          <div className={styles.entryText}>
            <span className={styles.example}>예시</span>
            <h2 id="galaxy-entry-title">은하 보기</h2>
            <p>서로 다른 우리가 함께하는 우주.</p>
            <span className={styles.arrow} aria-hidden="true">→</span>
          </div>
        </Link>
      </section>

      <form id="birth-form" tabIndex={-1} aria-labelledby="birth-form-title" className={'birth-panel ' + styles.birthForm} onSubmit={submit}>
        <h2 id="birth-form-title">태어난 순간에서 시작해요.</h2>
        <p>양력 생년월일로 나의 정령과 행성을 만나보세요.</p>
        <label className="name-field">이름 또는 별명
          <input value={name} onChange={event => setName(event.target.value)} placeholder="어떻게 불러드릴까요?" maxLength={40} autoComplete="nickname" />
        </label>
        <div className="field-grid">
          <label>연도<input required type="number" min={1900} max={2100} value={y} onChange={event => setY(event.target.value)} inputMode="numeric" /></label>
          <label>월<input required type="number" min={1} max={12} value={m} onChange={event => setM(event.target.value)} inputMode="numeric" /></label>
          <label>일<input required type="number" min={1} max={31} value={d} onChange={event => setD(event.target.value)} inputMode="numeric" /></label>
        </div>
        <div className="time-row">
          <label>태어난 시각<input type="number" min={0} max={23} value={h} disabled={unknown} onChange={event => setH(event.target.value)} inputMode="numeric" /></label>
          <label className="checkbox-label"><input type="checkbox" checked={unknown} onChange={event => setUnknown(event.target.checked)} />시간 모름</label>
        </div>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="primary-button" type="submit">나의 우주 보기</button>
        <p className="form-note">시간을 몰라도 시작할 수 있어요. <a href="/manse" className="underline">양력·자세한 사주 구성</a></p>
      </form>

      <aside className={styles.saved}>
        <div><h2>나의 기록</h2><p>저장한 풀이와 대화를 다시 읽어요.</p></div>
        <a href="/saved" className="text-link">기록 보기 <span aria-hidden="true">→</span></a>
      </aside>
      <section className="reading-section">
        <div><p className="eyebrow">Read your story</p><h2>모습 너머의 이야기</h2><p>원하는 주제로 사주 풀이를 남겨보세요.<br />현재는 준비된 해석 문구를 조합합니다.</p></div>
        <div className="reading-options">{readings.map(([category, title]) => <button key={category} onClick={() => setModal({ open: true, category, title })}>{title}</button>)}</div>
      </section>
      {result && <section aria-live="polite">
        <div className="section-heading"><h2>이번에 남긴 기록</h2><button onClick={() => setResult(null)} className="text-link">닫기</button></div>
        <FortuneCard fortune={result} />
      </section>}
      <footer className="site-footer">사주는 자신을 돌아보는 하나의 관점입니다. 행성과 분신은 사주를 시각적으로 해석한 디자인이며, 미래를 확정하지 않습니다.</footer>
    </div>
    <SajuInputModal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })} category={modal.category} categoryTitle={modal.title} onSuccess={fortune => { setResult(fortune); setModal({ ...modal, open: false }); }} />
  </>;
}
