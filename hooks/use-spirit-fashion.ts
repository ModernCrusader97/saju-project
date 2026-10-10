'use client';
import { useEffect, useState } from 'react';
import { emptyWardrobe, readWardrobe, saveWardrobe, FASHION_STORAGE_KEY, type FashionWardrobe } from '@/lib/planet/spirit-fashion-storage';
import { normalizeFashion, type FashionSelection, type FashionStem } from '@/lib/planet/spirit-fashion-catalog';

export function useSpiritFashion(stem: FashionStem) {
  const [wardrobe, setWardrobe] = useState<FashionWardrobe>(emptyWardrobe);
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState(true);
  useEffect(() => {
    const restore = () => {
      try { setWardrobe(readWardrobe(window.localStorage)); }
      catch { setWardrobe(emptyWardrobe()); setPersisted(false); }
      setReady(true);
    };
    const frame = requestAnimationFrame(restore);
    const changed = (event: StorageEvent) => { if (event.key === FASHION_STORAGE_KEY || event.key === null) restore(); };
    window.addEventListener('storage', changed);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('storage', changed); };
  }, []);
  function change(selection: FashionSelection) {
    if (!ready) return;
    const next: FashionWardrobe = { version: 1, outfits: { ...wardrobe.outfits, [stem]: normalizeFashion(selection) } };
    setWardrobe(next);
    try { setPersisted(saveWardrobe(window.localStorage, next)); } catch { setPersisted(false); }
  }
  return { selection: wardrobe.outfits[stem], ready, persisted, change };
}
