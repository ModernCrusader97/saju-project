'use client';
import { EMPTY_FASHION, FASHION_ITEMS, FASHION_SLOTS, FASHION_SLOT_LABELS, FASHION_PALETTES, equipFashion,
  type FashionSelection, type FashionStem } from '@/lib/planet/spirit-fashion-catalog';

export default function SpiritFashionPanel({ stem, selection, onChange, ready, persisted }: {
  stem: FashionStem; selection: FashionSelection; onChange: (selection: FashionSelection) => void; ready: boolean; persisted: boolean;
}) {
  const buttonStyle = (selected: boolean) => ({ border: `1px solid ${selected ? '#52765b' : '#cfddd3'}`, borderRadius: 18,
    padding: '8px 12px', minHeight: 44, fontSize: 14, color: '#234c3c', background: selected ? '#e5efd8' : '#fff' });
  return <section className="surface-options spirit-fashion-panel" aria-label="정령 패션" style={{ marginTop: 18, padding: 18, border: '1px solid #cfddd3', borderRadius: 20, background: '#f8fbf7' }}>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>정령에게 작은 장식을 더해보세요.</h2>
    <p className="form-note">{FASHION_PALETTES[stem].label}에 어울리는 장식 · {persisted ? '착용 조합은 이 브라우저에 저장돼요.' : '저장할 수 없어 이번 화면에서만 착용돼요.'}</p>
    <div className="fashion-slot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
      {FASHION_SLOTS.map(slot => <fieldset key={slot} style={{ minWidth: 0, border: '1px solid #d7e2db', borderRadius: 14, padding: 12 }}>
        <legend style={{ padding: '0 4px', fontWeight: 600 }}>{FASHION_SLOT_LABELS[slot]}</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button type="button" style={buttonStyle(selection[slot] === null)} disabled={!ready} aria-label={`${FASHION_SLOT_LABELS[slot]} 장식 벗기`} aria-pressed={selection[slot] === null}
            onClick={() => onChange(equipFashion(selection, slot, null))}>미착용</button>
          {FASHION_ITEMS.filter(item => item.slot === slot).map(item => <button key={item.id} type="button" style={buttonStyle(selection[slot] === item.id)} disabled={!ready}
            aria-label={`${item.label} 착용`} aria-pressed={selection[slot] === item.id}
            onClick={() => onChange(equipFashion(selection, slot, item.id))}>{item.label}</button>)}
        </div>
      </fieldset>)}
    </div>
    <button type="button" disabled={!ready || FASHION_SLOTS.every(slot => selection[slot] === null)}
      onClick={() => onChange({ ...EMPTY_FASHION })} style={{ ...buttonStyle(false), marginTop: 12 }}>장식 모두 벗기</button>
  </section>;
}
