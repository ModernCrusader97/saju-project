"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getThemePreset } from "@/lib/planet/theme-library";
import { createPlanetMaterial, animateSurface, resetSurface } from "@/lib/planet/surface-material";
import { disposeObject, disposeMaterial } from "@/lib/planet/render-resources";
import { safeDelta } from "@/lib/planet/surface-math";
import { MaskStyle } from "@/lib/planet/uv-mask";
import { createAsteroidBeltParticles } from "@/lib/planet/asteroid-belt";
import { Camera, RotateCcw } from "lucide-react";

interface PlanetCanvasProps {
  dayKey: string;    // SLOT-D (일주 70% 주 표면)
  monthKey: string;  // SLOT-M (월주 30% 보조 표면)
  hourKey: string;   // SLOT-H (시주 위성 구체)
  yearKey: string;   // SLOT-Y (연주 고리/소행성대)
  maskStyle?: MaskStyle;
  isUnknownTime?: boolean; // 시간 모름일 경우 위성 숨김 여부
}

export default function PlanetCanvas({
  dayKey,
  monthKey,
  hourKey,
  yearKey,
  maskStyle = "pangaea",
  isUnknownTime = false,
}: PlanetCanvasProps) {
  const [graphicsError, setGraphicsError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Mesh refs
  const mainPlanetRef = useRef<THREE.Mesh | null>(null);
  const satelliteMeshRef = useRef<THREE.Mesh | null>(null);
  const satellitePivotRef = useRef<THREE.Group | null>(null);
  const asteroidBeltPointsRef = useRef<THREE.Points | null>(null);
  const planetRootRef = useRef<THREE.Group | null>(null);

  // Interaction state
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const isAutoRotatingRef = useRef(true);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const motionTimeRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [snapshotToast, setSnapshotToast] = useState(false);

  // 1. Scene & Objects 초기화
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 460;

    // 씬
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 카메라
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 9.6);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 렌더러
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true, // 이미지 캡처 지원
    });
    } catch {
      setGraphicsError("3D 화면을 사용할 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.");
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 조명 (주 태양광 + 은은한 보조광)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const mainSunLight = new THREE.DirectionalLight(0xfff5e6, 2.0);
    mainSunLight.position.set(5, 4, 5);
    scene.add(mainSunLight);

    const fillLight = new THREE.DirectionalLight(0x5070a0, 0.8);
    fillLight.position.set(-6, -2, -4);
    scene.add(fillLight);

    // 행성 루트 그룹
    const planetRoot = new THREE.Group();
    scene.add(planetRoot);
    planetRootRef.current = planetRoot;

    // A. 공통 본체 구체 메쉬 (SLOT-D 70% + SLOT-M 30%)
    const sphereGeo = new THREE.SphereGeometry(1.85, 96, 64);
    const mainMat = new THREE.MeshStandardMaterial({
      roughness: 0.65,
      metalness: 0.1,
    });
    const mainMesh = new THREE.Mesh(sphereGeo, mainMat);
    planetRoot.add(mainMesh);
    mainPlanetRef.current = mainMesh;

    // B. 위성 궤도 그룹 & 위성 구체 (SLOT-H)
    const satPivot = new THREE.Group();
    planetRoot.add(satPivot);
    satellitePivotRef.current = satPivot;

    const satGeo = new THREE.SphereGeometry(0.44, 32, 32);
    const satMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
    const satMesh = new THREE.Mesh(satGeo, satMat);
    satMesh.position.set(3.8, 0.65, 0);
    satPivot.add(satMesh);
    satelliteMeshRef.current = satMesh;

    // C. 연주 고리/소행성대 (SLOT-Y: 띠 메쉬 대신 수천 개의 잘게 부서진 성간 파티클 클라우드)
    const presetY = getThemePreset(yearKey);
    const belt = createAsteroidBeltParticles(presetY, 1.0, 2200);
    belt.points.rotation.x = .28;
    belt.points.rotation.y = 0.12;
    planetRoot.add(belt.points);
    asteroidBeltPointsRef.current = belt.points;

    // 마우스 / 터치 인터랙션
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !planetRootRef.current) return;
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      planetRootRef.current.rotation.y += deltaX * 0.008;
      planetRootRef.current.rotation.x += deltaY * 0.008;

      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1 || !planetRootRef.current) return;
      const deltaX = e.touches[0].clientX - previousMousePosition.current.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.current.y;

      planetRootRef.current.rotation.y += deltaX * 0.008;
      planetRootRef.current.rotation.x += deltaY * 0.008;

      previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = () => {
      isDragging.current = false;
    };

    const dom = renderer.domElement;
    const onContextLost = (event: Event) => { event.preventDefault(); setGraphicsError("3D 연결이 잠시 끊겼어요. 복구를 기다려주세요."); };
    const onContextRestored = () => setGraphicsError(null);
    dom.addEventListener("webglcontextlost", onContextLost);
    dom.addEventListener("webglcontextrestored", onContextRestored);
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dom.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = Math.max(1, containerRef.current.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Reduced motion starts paused. Explicit user play can opt into gentle motion.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      isAutoRotatingRef.current = !reducedMotion.matches;
      setIsAutoRotating(isAutoRotatingRef.current);
    };
    updateMotionPreference();
    reducedMotion.addEventListener("change", updateMotionPreference);
    let previousTime = performance.now();
    const onVisibility = () => { previousTime = performance.now(); };
    document.addEventListener("visibilitychange", onVisibility);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    let animationFrameId: number;
    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = safeDelta(now, previousTime);
      previousTime = now;
      if (document.hidden) return;
      if (!isDragging.current && isAutoRotatingRef.current) {
        motionTimeRef.current += dt;
        const t = motionTimeRef.current;
        // Body spin, moon revolution/spin and belt orbit are independent of view drag.
        if (mainPlanetRef.current) {
          mainPlanetRef.current.rotation.y = t * .13;
          animateSurface(mainPlanetRef.current.material, dt);
        }
        if (satellitePivotRef.current) satellitePivotRef.current.rotation.y = t * .24;
        if (satelliteMeshRef.current) {
          satelliteMeshRef.current.rotation.y = t * .19;
          animateSurface(satelliteMeshRef.current.material, dt);
        }
        if (asteroidBeltPointsRef.current) asteroidBeltPointsRef.current.rotation.y = .12 + t * .065;
      }
      renderer.render(scene, camera);
    };
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", updateMotionPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      disposeObject(scene);
      dom.removeEventListener("webglcontextlost", onContextLost);
      dom.removeEventListener("webglcontextrestored", onContextRestored);
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, []);

  // 2. 테마 & 70:30 마스크 실시간 업데이트 (메모리 해제 및 초기 렌더 보장)
  useEffect(() => {
    if (!mainPlanetRef.current || !satelliteMeshRef.current || !asteroidBeltPointsRef.current) return;

    // 1) 간지 프리셋 조회
    const presetD = getThemePreset(dayKey);    // SLOT-D (일주 70%)
    const presetM = getThemePreset(monthKey);  // SLOT-M (월주 30%)
    const presetH = getThemePreset(hourKey);   // SLOT-H (시주 위성)
    const presetY = getThemePreset(yearKey);   // SLOT-Y (연주 고리)

    // Shared sphere UV/material path for all four ganzi slots.
    disposeMaterial(mainPlanetRef.current.material as THREE.Material);
    mainPlanetRef.current.material = createPlanetMaterial(presetD, presetM, maskStyle, 1024);
    const satMesh = satelliteMeshRef.current;
    satMesh.visible = !isUnknownTime;
    disposeMaterial(satMesh.material as THREE.Material);
    satMesh.material = createPlanetMaterial(presetH, undefined, maskStyle, 512);

    // 7) 연주 소행성대 파티클 업데이트 (SLOT-Y: 테마 변경 시 파티클 갱신)
    if (asteroidBeltPointsRef.current && planetRootRef.current) {
      planetRootRef.current.remove(asteroidBeltPointsRef.current);
      disposeObject(asteroidBeltPointsRef.current);

      const presetY = getThemePreset(yearKey);
      const newBelt = createAsteroidBeltParticles(presetY, 1.0, 2200);
      newBelt.points.rotation.x = .28;
      newBelt.points.rotation.y = 0.12;
      planetRootRef.current.add(newBelt.points);
      asteroidBeltPointsRef.current = newBelt.points;
    }
  }, [dayKey, monthKey, hourKey, yearKey, maskStyle, isUnknownTime]);

  const handleToggleAutoRotate = () => {
    isAutoRotatingRef.current = !isAutoRotatingRef.current;
    setIsAutoRotating(isAutoRotatingRef.current);
  };

  const handleResetRotation = () => {
    motionTimeRef.current = 0;
    mainPlanetRef.current?.rotation.set(0, 0, 0);
    satellitePivotRef.current?.rotation.set(0, 0, 0);
    satelliteMeshRef.current?.rotation.set(0, 0, 0);
    asteroidBeltPointsRef.current?.rotation.set(.28, .12, 0);
    if (mainPlanetRef.current) resetSurface(mainPlanetRef.current.material);
    if (satelliteMeshRef.current) resetSurface(satelliteMeshRef.current.material);
    if (planetRootRef.current) {
      planetRootRef.current.rotation.set(0, 0, 0);
    }
  };

  const handleCaptureSnapshot = () => {
    if (!rendererRef.current) return;
    try {
      const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `사주행성_${dayKey}_${monthKey}.png`;
      a.click();
      setSnapshotToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setSnapshotToast(false), 2500);
    } catch {
      alert("이미지 저장 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="relative w-full h-full min-h-[440px] rounded-[32px] overflow-hidden bg-gradient-to-b from-[#0A0D18] via-[#10162A] to-[#151D36] border border-white/10 shadow-2xl">
      {graphicsError && <div role="status" className="absolute inset-0 z-20 flex items-center justify-center p-8 text-center text-sm text-white bg-[#0A0D18]/90">{graphicsError}</div>}
      {/* 3D WebGL 캔버스 컨테이너 */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 조작 힌트 및 상단 컨트롤 버튼 오버레이 */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10.5px] font-medium text-white/80 shadow-sm">
          드래그하여 360° 회전 관찰
        </span>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={handleToggleAutoRotate}
            className="px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-[10.5px] font-medium text-white transition-all shadow-sm flex items-center gap-1"
            aria-pressed={isAutoRotating}
            title={isAutoRotating ? "천체 움직임 일시정지" : "천체 움직임 시작"}
          >
            <span>{isAutoRotating ? "움직임 멈춤" : "움직임 재생"}</span>
          </button>

          <button
            onClick={handleResetRotation}
            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white transition-all shadow-sm"
            title="행성 각도 초기화"
          >
            <RotateCcw className="h-3.5 w-3.5 text-doryeong-gold" />
          </button>

          <button
            onClick={handleCaptureSnapshot}
            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white transition-all shadow-sm"
            title="행성 캡처 이미지 저장"
          >
            <Camera className="h-3.5 w-3.5 text-doryeong-gold" />
          </button>
        </div>
      </div>

      {/* 캡처 성공 토스트 */}
      {snapshotToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs px-4 py-2 rounded-xl backdrop-blur-md shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Camera className="h-4 w-4 text-emerald-400" />
          <span>내 사주 행성 고해상도 이미지가 저장되었습니다! ✨</span>
        </div>
      )}

      {/* 4기둥 실시간 슬롯 뱃지 오버레이 */}
      <div className="absolute bottom-4 left-4 right-4 z-10 grid grid-cols-4 gap-1.5 text-center pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md border border-white/15 rounded-xl p-2 text-white">
          <span className="text-[9px] text-doryeong-gold font-bold block">주 표면 (70%)</span>
          <span className="text-xs font-bold font-serif">{dayKey}</span>
          <span className="text-[9px] text-white/60 block">일주</span>
        </div>
        <div className="bg-black/60 backdrop-blur-md border border-white/15 rounded-xl p-2 text-white">
          <span className="text-[9px] text-blue-300 font-bold block">보조 표면 (30%)</span>
          <span className="text-xs font-bold font-serif">{monthKey}</span>
          <span className="text-[9px] text-white/60 block">월주</span>
        </div>
        <div className="bg-black/60 backdrop-blur-md border border-white/15 rounded-xl p-2 text-white">
          <span className="text-[9px] text-amber-300 font-bold block">위성 구체</span>
          <span className="text-xs font-bold font-serif">{isUnknownTime ? "미상" : hourKey}</span>
          <span className="text-[9px] text-white/60 block">시주</span>
        </div>
        <div className="bg-black/60 backdrop-blur-md border border-white/15 rounded-xl p-2 text-white">
          <span className="text-[9px] text-rose-300 font-bold block">고리/소행성</span>
          <span className="text-xs font-bold font-serif">{yearKey}</span>
          <span className="text-[9px] text-white/60 block">연주</span>
        </div>
      </div>
    </div>
  );
}
