'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Orbit, Sparkles, Network } from 'lucide-react';
import { readGalaxyPath, UNIVERSE_CHANGE_EVENT } from '@/lib/universe-state';

export default function UniverseNav({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname();
  const [mode, setMode] = useState('spirit');
  const [galaxyPath, setGalaxyPath] = useState('/guin');
  useEffect(() => {
    const sync = () => { setMode(new URLSearchParams(window.location.search).get('view') || 'spirit'); setGalaxyPath(readGalaxyPath()); };
    sync(); window.addEventListener('popstate', sync); window.addEventListener(UNIVERSE_CHANGE_EVENT, sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener(UNIVERSE_CHANGE_EVENT, sync); };
  }, [path]);
  const items = [
    { href: '/planet?view=spirit', label: '정령', Icon: Sparkles, active: path === '/planet' && mode !== 'planet' },
    { href: '/planet?view=planet', label: '행성', Icon: Orbit, active: path === '/planet' && mode === 'planet' },
    { href: galaxyPath, label: '은하', Icon: Network, active: path.startsWith('/guin') },
  ];
  return <nav className={mobile ? 'bottom-nav universe-nav-mobile' : 'desktop-nav universe-nav'} aria-label={mobile ? '모바일 우주 탐색' : '우주 탐색'}>
    {items.map(({ href, label, Icon, active }) => <a key={label} href={href} aria-current={active ? 'page' : undefined}><Icon size={20}/><span>{label}</span></a>)}
  </nav>;
}
