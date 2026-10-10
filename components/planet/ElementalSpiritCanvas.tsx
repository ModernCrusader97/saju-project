"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createVisibilityLoop } from "@/lib/planet/visibility-loop";
import { createStudioEnvironment } from "@/lib/planet/scene-environment";
import { releaseSceneGPUAllocations } from "@/lib/planet/context-loss-resources";
import type { ElementalSpiritInstance } from "@/lib/planet/elemental-spirit";
import { TEN_STEM_SPIRITS, ZODIAC_FEATURES, getSpiritStemPreset, type ZodiacBranch } from "@/lib/planet/spirit-profiles";
import { loadApprovedSpirit } from "@/lib/planet/approved-jade-spirit";
import { EMPTY_FASHION, type FashionSelection } from '@/lib/planet/spirit-fashion-catalog';

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
  fashion?: FashionSelection;
}

export default function ElementalSpiritCanvas({
  dayKey, monthKey="병인", onCapture, className="", fashion = EMPTY_FASHION,
}: ElementalSpiritCanvasProps) {
  const containerRef=useRef<HTMLDivElement>(null);
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
  const spiritRef=useRef<ElementalSpiritInstance|null>(null);
  const renderRef=useRef<(()=>void)|null>(null);
  const motionTime=useRef(0);
  const fashionRef=useRef(fashion);
  useEffect(()=>{
    fashionRef.current=fashion;spiritRef.current?.fashion?.set(fashion);renderRef.current?.();
  },[fashion]);
  const runningRef=useRef(true);
  const motionPreferenceInitialized=useRef(false);
  const viewRotation=useRef({x:0,y:0});
  const [running,setRunning]=useState(true);
  const [graphicsError,setGraphicsError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState<string|null>(null);
  const [reactionCount,setReactionCount]=useState(0);
  const [spiritInfo,setSpiritInfo]=useState(TEN_STEM_SPIRITS[dayKey.charAt(0)] || TEN_STEM_SPIRITS.갑);
  const timerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const monthInfo=getSpiritStemPreset(monthKey);
  const monthColor=new THREE.Color(monthInfo.surface.primaryColor);
  const backdropTop=new THREE.Color('#f5f5ed').lerp(monthColor,.07).getStyle();
  const backdropBottom=new THREE.Color('#edf0e7').lerp(monthColor,.12).getStyle();

  useEffect(()=>{
    const container=containerRef.current;if(!container)return;
    let disposed=false;
    let disposeScene:(()=>void)|undefined;
    // Report renderer setup results from a cancellable browser callback. Cancel
    // this frame on cleanup so an abandoned view never allocates GPU resources.
    const initialize=()=>{
    setLoading(true);
    setSpiritInfo(TEN_STEM_SPIRITS[dayKey.charAt(0)] || TEN_STEM_SPIRITS.갑);
    const low=window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(38,1,.1,40);
    let renderer:THREE.WebGLRenderer;
    try {
      renderer=new THREE.WebGLRenderer({antialias:!low,alpha:true,premultipliedAlpha:true,powerPreference:"high-performance",preserveDrawingBuffer:true});
    } catch {
      setGraphicsError("3D 화면을 사용할 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.");return;
    }
    setGraphicsError(null);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,low?1.35:1.75));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.12;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    let shaderFailed=false;
    renderer.debug.onShaderError=()=>{shaderFailed=true;setGraphicsError("정령 재질을 그리지 못했어요. 다른 WebGL 지원 브라우저에서 다시 열어주세요.");};
    rendererRef.current=renderer;
    const dom=renderer.domElement;
    dom.style.width="100%";dom.style.height="100%";dom.style.touchAction="pan-y";
    dom.setAttribute("aria-label","드래그로 둘러보는 사주 자연 정령");
    container.replaceChildren(dom);

    // A real PMREM environment gives titanium, mercury and water broad bright
    // reflections. It is lighting only, never a visible atmosphere shell.
    let environment:THREE.WebGLRenderTarget;
    try {
      environment=createStudioEnvironment(renderer);
      scene.environment=environment.texture;scene.environmentIntensity=1.05;
    } catch {
      renderer.dispose();renderer.forceContextLoss();rendererRef.current=null;container.replaceChildren();
      setGraphicsError("정령의 반사광을 준비하지 못했어요. 화면을 다시 열어주세요.");return;
    }
    scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
    const keyLight=new THREE.DirectionalLight(0xfff1d9,2.1);keyLight.position.set(-3,4,4);scene.add(keyLight);
    keyLight.castShadow=true;keyLight.shadow.mapSize.set(low?512:1024,low?512:1024);
    Object.assign(keyLight.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-2,near:.1,far:16});
    keyLight.shadow.bias=-.0002;
    const fillLight=new THREE.DirectionalLight(0xc1e4f0,.8);fillLight.position.set(4,1,2);scene.add(fillLight);
    const rimLight=new THREE.DirectionalLight(0xf5fbff,1.8);rimLight.position.set(0,3,-3);scene.add(rimLight);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({color:0x1c4836,opacity:.09}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-.016;ground.receiveShadow=true;scene.add(ground);

    let spirit:ElementalSpiritInstance|null=null;
    motionTime.current=0;viewRotation.current={x:0,y:0};
    let contextLost=false;
    const render=()=>{
      if(disposed || contextLost || shaderFailed)return;
      spirit?.update(motionTime.current,0,camera);
      renderer.render(scene,camera);
    };
    renderRef.current=render;
    const resize=()=>{
      if(disposed)return;
      const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
      camera.aspect=width/height;
      // Fit the unchanged front width and the separate small day-branch animal.
      const distance=Math.max(5.7,1.50/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
      camera.position.set(0,1.70,distance);camera.lookAt(0,1.24,0);camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);render();
    };
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    // Loading is asynchronous and scoped to this mounted view. Late completions never
    // attach a model to an unmounted scene or keep its GPU resources alive.
    loadApprovedSpirit(dayKey,monthKey,low?"low":"high").then(instance=>{
      if(disposed){instance.dispose();return;}
      // Transmission draws without alpha blending. Premultiply its final canvas
      // output, while preserving straight RGB in offscreen refraction targets.
      // Normal-blended fire and the ground already use the canvas convention.
      instance.group.traverse(object=>{
        const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
        for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]) {
          const physical=material as THREE.MeshPhysicalMaterial;
          if(!physical.isMeshPhysicalMaterial || physical.transmission<=0)continue;
          const previousOnBeforeRender=physical.onBeforeRender;
          physical.onBeforeRender=function(...args) {
            previousOnBeforeRender.apply(this,args);
            const canvasOutput=args[0].getRenderTarget()===null;
            if(this.premultipliedAlpha!==canvasOutput){this.premultipliedAlpha=canvasOutput;this.needsUpdate=true;}
          };
        }
      });
      spirit=instance;scene.add(instance.group);spiritRef.current=instance;
      instance.fashion?.set(fashionRef.current);
      setSpiritInfo(instance.data);setLoading(false);resize();
    }).catch(()=>{
      if(!disposed){setLoading(false);setGraphicsError("정령을 불러오지 못했어요. 아래 사주 구성은 계속 확인할 수 있어요.");}
    });

    let activePointer:number|null=null;
    let previous={x:0,y:0};let origin={x:0,y:0};let movement=0;let dragIntent:"rotate"|null=null;
    const applyRotation=()=>{
      if(!spirit)return;
      // Orbit the avatar in place. Rotating the whole pair collapses the pet
      // behind its owner at side views, especially on a narrow phone screen.
      spirit.avatarPivot.rotation.x=viewRotation.current.x;spirit.avatarPivot.rotation.y=viewRotation.current.y;render();
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
        spirit?.triggerReaction();setReactionCount(count=>count+1);
      }
      if(dom.hasPointerCapture(event.pointerId))dom.releasePointerCapture(event.pointerId);
      activePointer=null;
    };
    const onLost=()=>{activePointer=null;};
    dom.addEventListener("pointerdown",onDown);dom.addEventListener("pointermove",onMove);
    dom.addEventListener("pointerup",onUp);dom.addEventListener("pointercancel",onUp);dom.addEventListener("lostpointercapture",onLost);
    const onContextLost=(event:Event)=>{
      event.preventDefault();if(contextLost)return;contextLost=true;
      // Release the old render-target callbacks while the context is lost.
      // After restoration their captured GPU handles are invalid.
      scene.environment=null;environment.dispose();releaseSceneGPUAllocations(scene,renderer);
      setGraphicsError("3D 연결이 잠시 끊겼어요. 복구를 기다려주세요.");
    };
    const onContextRestored=()=>{
      try { const restored=createStudioEnvironment(renderer);environment=restored;scene.environment=restored.texture;contextLost=false;shaderFailed=false;setGraphicsError(null);render(); }
      catch { setGraphicsError("정령 반사광을 복구하지 못했어요. 화면을 다시 열어주세요."); }
    };
    dom.addEventListener("webglcontextlost",onContextLost);dom.addEventListener("webglcontextrestored",onContextRestored);

    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionPreference=()=>{runningRef.current=!reducedMotion.matches;setRunning(runningRef.current);};
    if(!motionPreferenceInitialized.current){onMotionPreference();motionPreferenceInitialized.current=true;}
    reducedMotion.addEventListener("change",onMotionPreference);
    const animate=(now:number,previousTime:number)=>{
      const delta=safeDelta(now,previousTime);
      if(document.hidden || contextLost || shaderFailed || !runningRef.current || activePointer!==null || !spirit)return;
      motionTime.current+=delta;render();
    };
    const stopAnimation = createVisibilityLoop(container, animate);
    return ()=>{
      stopAnimation();observer.disconnect();
      reducedMotion.removeEventListener("change",onMotionPreference);
      dom.removeEventListener("pointerdown",onDown);dom.removeEventListener("pointermove",onMove);
      dom.removeEventListener("pointerup",onUp);dom.removeEventListener("pointercancel",onUp);dom.removeEventListener("lostpointercapture",onLost);
      dom.removeEventListener("webglcontextlost",onContextLost);dom.removeEventListener("webglcontextrestored",onContextRestored);
      spirit?.dispose();ground.geometry.dispose();ground.material.dispose();keyLight.shadow.dispose();
      scene.environment=null;environment.dispose();renderer.dispose();renderer.forceContextLoss();
      if(rendererRef.current===renderer)rendererRef.current=null;
      if(spiritRef.current===spirit)spiritRef.current=null;
      renderRef.current=null;scene.clear();
      if(container.contains(dom))container.removeChild(dom);
    };
    };
    const startFrame=requestAnimationFrame(()=>{disposeScene=initialize();});
    return ()=>{
      disposed=true;cancelAnimationFrame(startFrame);disposeScene?.();
    };
  },[dayKey,monthKey]);

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
    <div className={`spirit-stage relative h-full min-h-[380px] overflow-hidden rounded-3xl border border-doryeong-border ${className}`} style={{background:`linear-gradient(155deg,${backdropTop},${backdropBottom})`}} data-scene="spirit" data-scene-state={graphicsError?"fallback":loading?"loading":"ready"}>
      <div ref={containerRef} className="h-full min-h-[380px] w-full cursor-grab active:cursor-grabbing" />
      {(loading||graphicsError)&&<div className="scene-placeholder" role={graphicsError?"alert":"status"}>
        <img src="/spirits/jade-v002/still.png" alt="승인된 비취 B형 정령의 참고 이미지" width="320" height="320"/>
        <strong>{graphicsError||"정령을 준비하고 있어요."}</strong>
        <span>{graphicsError?"비취 형태 참고 이미지 · 실시간 3D를 사용할 수 없습니다.":"비취 형태 미리보기 · 재질이 준비되면 3D로 바뀝니다."}</span>
      </div>}
      <div className="pointer-events-none absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-100"><Sparkles className="h-3 w-3 shrink-0"/><span>{spiritInfo.name}</span></div>
          <p className="mt-1 text-[10px] text-white/50">일간 {dayKey.charAt(0)} 정령 · 일지 {ZODIAC_FEATURES[dayKey.charAt(1) as ZodiacBranch]?.label || "동물"} 동반자</p>
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
        <p className="text-sm text-[#234c3c]">{spiritInfo.speciesTitle}</p>
        <p className="mt-1 text-xs text-[#526b5b]">드래그로 둘러보기 · 가볍게 눌러 인사하기{reactionCount>0?` · ${reactionCount}번 인사`:""}</p>
        <p className="mt-1 text-xs text-[#526b5b]">월령 {monthKey} 배경 · 일지 {ZODIAC_FEATURES[dayKey.charAt(1) as ZodiacBranch]?.label || "동물"} 동반자</p>
      </div>
      {notice&&<div role="status" className="absolute bottom-24 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-4 py-2 text-xs text-white">{notice}</div>}
    </div>
  );
}
