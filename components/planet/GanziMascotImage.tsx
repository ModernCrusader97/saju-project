"use client";
import React, { useEffect, useRef, useState } from 'react';
import { getGanziMascot } from '@/lib/planet/ganzi-mascot';

interface Props {
  dayKey?: string;
  thumbnail?: boolean;
  className?: string;
  priority?: boolean;
  onReady?: (url:string) => void;
  onUnavailable?: () => void;
}
export default function GanziMascotImage(props: Props) {
  const mascot = getGanziMascot(props.dayKey);
  const src = mascot?.ready ? (props.thumbnail ? mascot.thumbnailSrc : mascot.src) : '';
  return <Portrait key={src + ':' + (props.dayKey || '')} {...props} src={src} alt={mascot?.alt || '간지 정보 없음'}/>;
}
function Portrait({dayKey,src,alt,className='',priority=false,onReady,onUnavailable}: Props & {src:string;alt:string}) {
  const [failed,setFailed] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [attempt,setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const callbacks = useRef({onReady,onUnavailable});
  useEffect(() => { callbacks.current = {onReady,onUnavailable}; }, [onReady,onUnavailable]);
  useEffect(() => {
    // SSR images can finish before hydration attaches React's load/error handlers.
    const image = imageRef.current;
    if (!src || !image?.complete) return;
    if (image.naturalWidth > 0) { setLoaded(true); callbacks.current.onReady?.(src); }
    else { setFailed(true); callbacks.current.onUnavailable?.(); }
  }, [src,attempt]);
  const retry = () => {setFailed(false);setLoaded(false);setAttempt(value=>value+1);};
  return <div className={'ganzi-mascot-image '+className} data-mascot-key={dayKey || ''} data-mascot-state={!src?'pending':failed?'error':loaded?'ready':'loading'}>
    {src && !failed ? <>
      {/* eslint-disable-next-line @next/next/no-img-element -- Keep the approved lossless source identical in UI and passport Canvas export. */}
      <img ref={imageRef} data-ganzi-key={dayKey} src={src+(attempt?'?retry='+attempt:'')} alt={alt}
        width={960} height={960} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'}
        onLoad={()=>{setLoaded(true);onReady?.(src);}} onError={()=>{setFailed(true);onUnavailable?.();}}/>
      {!loaded && <span className="mascot-loading" role="status">그림을 불러오고 있어요.</span>}
    </> : <div className="mascot-placeholder" role="status">
      <span>{!dayKey?'일주 정보가 필요해요.':failed?'그림을 불러오지 못했어요.':'그림을 준비하고 있어요.'}</span>
      {failed && <button type="button" onClick={event=>{event.preventDefault();event.stopPropagation();retry();}}>다시 불러오기</button>}
    </div>}
  </div>;
}
