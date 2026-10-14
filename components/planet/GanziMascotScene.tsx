"use client";
import React from 'react';
import GanziMascotImage from './GanziMascotImage';
import { getGanziMascot } from '@/lib/planet/ganzi-mascot';
import { getStemThemePreset } from '@/lib/planet/theme-library';

export default function GanziMascotScene({dayKey,monthKey,yearKey,hourKey,isUnknownTime,onCapture}:{dayKey:string;monthKey:string;yearKey?:string;hourKey?:string;isUnknownTime:boolean;onCapture:(url:string)=>void}) {
  const mascot=getGanziMascot(dayKey),month=getStemThemePreset(monthKey);
  return <div className="mascot-scene" style={{background:`linear-gradient(160deg,${month.surface.primaryColor},${month.surface.secondaryColor})`}}>
    <GanziMascotImage dayKey={dayKey} priority onReady={onCapture} onUnavailable={()=>onCapture('')}/>
    <div className="mascot-scene-caption"><strong>{mascot?.title || dayKey}</strong>
      <span>월령 {monthKey} · {month.themeName}</span>
      <span>연주 {yearKey || '미상'} · {isUnknownTime?'시간 모름':`시주 ${hourKey || '미상'}`}</span>
    </div>
  </div>;
}
