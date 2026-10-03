"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createElementalSpirit, type ElementalSpiritInstance, TEN_STEM_SPIRITS } from "@/lib/planet/elemental-spirit";
import { safeDelta } from "@/lib/planet/surface-math";
import type { MaskStyle } from "@/lib/planet/uv-mask";
import { Sparkles, RotateCcw, Camera, Pause, Play } from "lucide-react";

interface ElementalSpiritCanvasProps {
  dayKey: string;
  monthKey?: string;
  hourKey?: string;
  yearKey?: string;
  isUnknownTime?: boolean;
  maskStyle?: MaskStyle;
  onCapture?: (dataUrl: string) => void;
  className?: string;
}

export default function ElementalSpiritCanvas({
  dayKey, monthKey="병인", hourKey, yearKey, isUnknownTime=false,
  maskStyle="pangaea", onCapture, className="",
}: ElementalSpiritCanvasProps) {
  const containerRef=useRef<HTMLDivElement>(null);
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
  const spiritRef=useRef<ElementalSpiritInstance|null>(null);
  const renderRef=useRef<(()=>void)|null>(null);
  const motionTime=useRef(0);
  const runningRef=useRef(true);
  const motionPreferenceInitialized=useRef(false);
  const viewRotation=useRef({x:0,y:0});
  const [running,setRunning]=useState(true);
  const [graphicsError,setGraphicsError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [reactionCount,setReactionCount]=useState(0);
  const [spiritInfo,setSpiritInfo]=useState(TEN_STEM_SPIRITS[dayKey.charAt(0)] || TEN_STEM_SPIRITS.갑);
  const timerRef=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    const container=containerRef.current;if(!container)return;
    const low=window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(38,1,.1,40);
    let renderer:THREE.WebGLRenderer;
    try {
      renderer=new THREE.WebGLRenderer({antialias:!low,alpha:true,powerPreference:"high-performance",preserveDrawingBuffer:true});
    } catch {
      setGraphicsError("3D 화면을 사용할 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.");return;
    }
    setGraphicsError(null);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,low?1.35:1.75));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.12;
    renderer.debug.onShaderError=()=>setGraphicsError("정령 재질을 그리지 못했어요. 다른 WebGL 지원 브라우저에서 다시 열어주세요.");
    rendererRef.current=renderer;
    const dom=renderer.domElement;
    dom.style.width="100%";dom.style.height="100%";dom.style.touchAction="pan-y";
    dom.setAttribute("aria-label","드래그로 둘러보는 사주 자연 정령");
    container.replaceChildren(dom);

    // A real PMREM environment gives titanium, mercury and water broad bright
    // reflections. It is lighting only, never a visible atmosphere shell.
    const pmrem=new THREE.PMREMGenerator(renderer);
    const room=new RoomEnvironment();
    let environment:THREE.WebGLRenderTarget;
    try {
      environment=pmrem.fromScene(room,.035);
      scene.environment=environment.texture;scene.environmentIntensity=1.05;
    } catch {
      room.dispose();pmrem.dispose();renderer.dispose();renderer.forceContextLoss();rendererRef.current=null;container.replaceChildren();
      setGraphicsError("정령의 반사광을 준비하지 못했어요. 화면을 다시 열어주세요.");return;
    }
    room.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
    const keyLight=new THREE.DirectionalLight(0xfff1d9,2.1);keyLight.position.set(-3,4,4);scene.add(keyLight);
    const fillLight=new THREE.DirectionalLight(0xc1e4f0,.8);fillLight.position.set(4,1,2);scene.add(fillLight);
    const rimLight=new THREE.DirectionalLight(0xf5fbff,1.8);rimLight.position.set(0,3,-3);scene.add(rimLight);

    let spirit:ElementalSpiritInstance;
    try {
      spirit=createElementalSpirit(dayKey,monthKey,hourKey,{yearKey,isUnknownTime,maskStyle,quality:low?"low":"high"});
    } catch {
      scene.environment=null;environment.dispose();renderer.dispose();renderer.forceContextLoss();rendererRef.current=null;container.replaceChildren();
      setGraphicsError("정령을 만들지 못했어요. 재질을 바꾸거나 화면을 다시 열어주세요.");return;
    }
    scene.add(spirit.group);spiritRef.current=spirit;setSpiritInfo(spirit.data);
    motionTime.current=0;viewRotation.current={x:0,y:0};
    let contextLost=false, disposed=false;
    const render=()=>{if(!disposed && !contextLost)renderer.render(scene,camera);};
    renderRef.current=render;
    const resize=()=>{
      if(disposed)return;
      const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
      camera.aspect=width/height;
      // Fit both the full crown and detached pillar companion on portrait screens.
      const distance=Math.max(5.4,1.72/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
      camera.position.set(0,.55,distance);camera.lookAt(0,.16,0);camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);render();
    };
    const observer=new ResizeObserver(resize);observer.observe(container);resize();

    let activePointer:number|null=null;
    let previous={x:0,y:0};let origin={x:0,y:0};let movement=0;let dragIntent:"rotate"|null=null;
    const applyRotation=()=>{
      spirit.group.rotation.x=viewRotation.current.x;spirit.group.rotation.y=viewRotation.current.y;render();
    };
    const onDown=(event:PointerEvent)=>{
      if(activePointer!==null)return;
      activePointer=event.pointerId;previous={x:event.clientX,y:event.clientY};origin={...previous};movement=0;dragIntent=null;
      dom.setPointerCapture(event.pointerId);
    };
    const onMove=(event:PointerEvent)=>{
      if(event.pointerId!==activePointer)return;
      if(event.pointerType==="touch" && dragIntent===null) {
        const totalX=event.clientX-origin.x,totalY=event.clientY-origin.y;
        if(Math.abs(totalX)+Math.abs(totalY)<7)return;
        // Vertical gestures belong to the page. Horizontal swipes rotate the
        // spirit; pointercancel/lost capture always end the gesture cleanly.
        if(Math.abs(totalY)>Math.abs(totalX)*1.1) {
          if(dom.hasPointerCapture(event.pointerId))dom.releasePointerCapture(event.pointerId);
          activePointer=null;return;
        }
        dragIntent="rotate";
      }
      const dx=event.clientX-previous.x,dy=event.clientY-previous.y;
      movement+=Math.abs(dx)+Math.abs(dy);
      viewRotation.current.y+=dx*.009;
      viewRotation.current.x=THREE.MathUtils.clamp(viewRotation.current.x+dy*.007,-.35,.35);
      previous={x:event.clientX,y:event.clientY};applyRotation();
    };
    const onUp=(event:PointerEvent)=>{
      if(event.pointerId!==activePointer)return;
      if(event.type==="pointerup" && movement<8) {
        spirit.triggerReaction();setReactionCount(count=>count+1);
      }
      if(dom.hasPointerCapture(event.pointerId))dom.releasePointerCapture(event.pointerId);
      activePointer=null;
    };
    const onLost=()=>{activePointer=null;};
    dom.addEventListener("pointerdown",onDown);dom.addEventListener("pointermove",onMove);
    dom.addEventListener("pointerup",onUp);dom.addEventListener("pointercancel",onUp);dom.addEventListener("lostpointercapture",onLost);
    const onContextLost=(event:Event)=>{event.preventDefault();contextLost=true;setGraphicsError("3D 연결이 잠시 끊겼어요. 복구를 기다려주세요.");};
    const onContextRestored=()=>{contextLost=false;setGraphicsError(null);render();};
    dom.addEventListener("webglcontextlost",onContextLost);dom.addEventListener("webglcontextrestored",onContextRestored);

    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionPreference=()=>{runningRef.current=!reducedMotion.matches;setRunning(runningRef.current);};
    if(!motionPreferenceInitialized.current){onMotionPreference();motionPreferenceInitialized.current=true;}
    reducedMotion.addEventListener("change",onMotionPreference);
    let previousTime=performance.now();
    const onVisibility=()=>{previousTime=performance.now();};
    document.addEventListener("visibilitychange",onVisibility);
    let frame=0;
    const animate=(now:number)=>{
      frame=requestAnimationFrame(animate);
      const delta=safeDelta(now,previousTime);previousTime=now;
      if(document.hidden || contextLost || !runningRef.current || activePointer!==null)return;
      motionTime.current+=delta;spirit.update(motionTime.current,delta);render();
    };
    frame=requestAnimationFrame(animate);
    return ()=>{
      disposed=true;cancelAnimationFrame(frame);observer.disconnect();
      reducedMotion.removeEventListener("change",onMotionPreference);
      document.removeEventListener("visibilitychange",onVisibility);
      dom.removeEventListener("pointerdown",onDown);dom.removeEventListener("pointermove",onMove);
      dom.removeEventListener("pointerup",onUp);dom.removeEventListener("pointercancel",onUp);dom.removeEventListener("lostpointercapture",onLost);
      dom.removeEventListener("webglcontextlost",onContextLost);dom.removeEventListener("webglcontextrestored",onContextRestored);
      spirit.dispose();scene.environment=null;environment.dispose();renderer.dispose();renderer.forceContextLoss();
      if(rendererRef.current===renderer)rendererRef.current=null;
      if(spiritRef.current===spirit)spiritRef.current=null;
      renderRef.current=null;scene.clear();
      if(container.contains(dom))container.removeChild(dom);
    };
  },[dayKey,monthKey,hourKey,yearKey,isUnknownTime,maskStyle]);

  useEffect(()=>()=>{if(timerRef.current)clearTimeout(timerRef.current);},[]);
  const showNotice=(text:string)=>{
    if(timerRef.current)clearTimeout(timerRef.current);setNotice(text);
    timerRef.current=setTimeout(()=>setNotice(null),2600);
  };
  const toggleMotion=()=>{runningRef.current=!runningRef.current;setRunning(runningRef.current);};
  const reset=()=>{
    motionTime.current=0;viewRotation.current={x:0,y:0};spiritRef.current?.reset();renderRef.current?.();setReactionCount(0);
  };
  const capture=()=>{
    if(!rendererRef.current || graphicsError)return;
    try {
      renderRef.current?.();
      const dataUrl=rendererRef.current.domElement.toDataURL("image/png");onCapture?.(dataUrl);
      const link=document.createElement("a");link.href=dataUrl;link.download=`사주정령_${dayKey}.png`;link.click();
      showNotice("정령 이미지를 저장했어요.");
    } catch {showNotice("이미지를 저장하지 못했어요. 다시 시도해 주세요.");}
  };

  return (
    <div className={`relative h-full min-h-[380px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_35%,#263943_0%,#111e28_60%,#0a131b_100%)] ${className}`}>
      <div ref={containerRef} className="h-full min-h-[380px] w-full cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-100"><Sparkles className="h-3 w-3 shrink-0"/><span>{spiritInfo.name}</span></div>
          <p className="mt-1 text-[10px] text-white/50">일주 {dayKey} 주재질 · 월주 {monthKey} 보조재질</p>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={toggleMotion} aria-label={running?"정령 움직임 일시정지":"정령 움직임 재생"} aria-pressed={!running} title={running?"일시정지":"재생"} className="rounded-full border border-white/15 bg-black/40 p-2 text-white/80 hover:bg-black/60">
            {running?<Pause className="h-3.5 w-3.5"/>:<Play className="h-3.5 w-3.5"/>}
          </button>
          <button type="button" onClick={reset} aria-label="정령 정면과 움직임 초기화" title="정면과 움직임 초기화" className="rounded-full border border-white/15 bg-black/40 p-2 text-white/80 hover:bg-black/60"><RotateCcw className="h-3.5 w-3.5"/></button>
          <button type="button" onClick={capture} disabled={!!graphicsError} aria-label="정령 이미지 저장" title="이미지 저장" className="rounded-full border border-white/15 bg-black/40 p-2 text-white/80 hover:bg-black/60 disabled:opacity-40"><Camera className="h-3.5 w-3.5"/></button>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 text-center">
        <p className="text-[11px] text-white/60">{spiritInfo.speciesTitle}</p>
        <p className="mt-1 text-[10px] text-white/35">드래그로 둘러보기 · 가볍게 눌러 인사하기{reactionCount>0?` · ${reactionCount}번 인사`:""}</p>
        <p className="mt-1 text-[9px] text-white/30">{hourKey&&!isUnknownTime?`시주 ${hourKey} 작은 동반자`:"시간 모름 · 동반자 생략"}{yearKey?` · 연주 ${yearKey} 고리`:""}</p>
      </div>
      {graphicsError&&<div role="alert" className="absolute inset-0 flex items-center justify-center bg-slate-950/85 px-8 text-center text-sm text-white/80">{graphicsError}</div>}
      {notice&&<div role="status" className="absolute bottom-24 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-4 py-2 text-xs text-white">{notice}</div>}
    </div>
  );
}
