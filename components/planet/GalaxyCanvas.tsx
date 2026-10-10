"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { bindSceneGestures } from "@/lib/planet/scene-gestures";
import * as THREE from "three";
import { createStudioEnvironment } from "@/lib/planet/scene-environment";
import { MAX_LIVING_RADIAL_RELIEF } from "@/lib/planet/living-surface-shader";
import { GuinPerson } from "@/lib/saju/types";
import { buildGalaxyNodes, GalaxyNode } from "@/lib/planet/galaxy-helper";
import { getStemThemePreset } from "@/lib/planet/theme-library";
import { createPlanetMaterial, animateSurface, resetSurface } from "@/lib/planet/surface-material";
import { createPlanetAppearance } from "@/lib/planet/planet-appearance";
import { animateSurfaceEffects, disposeSurfaceEffects } from "@/lib/planet/surface-effects";
import { setGalaxyOrbitPosition } from "@/lib/planet/galaxy-motion";
import type { MaskStyle } from "@/lib/planet/uv-mask";
import { safeDelta, damping, seededRandom, hashSeed } from "@/lib/planet/surface-math";
import { disposeObject } from "@/lib/planet/render-resources";
import { buildSpiralGalaxy } from "@/lib/planet/spiral-galaxy";
import { createAsteroidBeltParticles } from "@/lib/planet/asteroid-belt";
import {
  Sparkles,
  Eye,
  Users,
  Compass,
  Crosshair,
  Maximize2,
  Minimize2,
  Camera,
  Info,
  X,
} from "lucide-react";

interface GalaxyCanvasProps {
  guins: GuinPerson[];
  selectedPersonId?: string;
  onSelectPerson?: (person: GuinPerson) => void;
  distanceScale?: number;
  speedScale?: number;
  incomingPersonId?: string;
  ownerMaskStyle?: MaskStyle;
}

interface PlanetConnection {
  friendGroup: THREE.Group;
  line: THREE.Line;
  curve: THREE.QuadraticBezierCurve3;
  pulseMesh: THREE.Mesh;
  pulseT: number;
}

const disposeHierarchy = disposeObject;

// 3D 천체 HUD 라벨 스프라이트 생성기 (Hyper3D Astra 레퍼런스의 성단 레이블 스타일)
function createPlanetLabelSprite(
  name: string,
  badgeText: string,
  isOwner: boolean
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 260;
  canvas.height = 76;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // 배경 HUD 캡슐
    ctx.fillStyle = isOwner ? "rgba(22, 18, 10, 0.85)" : "rgba(8, 18, 32, 0.85)";
    ctx.strokeStyle = isOwner ? "rgba(255, 215, 100, 0.95)" : "rgba(80, 215, 255, 0.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(8, 8, 244, 60, 16);
    ctx.fill();
    ctx.stroke();

    // 발광 비콘 점
    ctx.fillStyle = isOwner ? "#FFD700" : "#00F0FF";
    ctx.shadowColor = isOwner ? "#FFD700" : "#00F0FF";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(30, 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 이름
    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(name, 48, 36);

    // 관계/궁합 서브텍스트
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = isOwner ? "#FFD700" : "#7DE2FC";
    ctx.fillText(badgeText, 48, 54);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.4, 1.0, 1.0);
  sprite.position.set(0, 1.95, 0);
  return sprite;
}

export default function GalaxyCanvas({
  guins,
  selectedPersonId,
  onSelectPerson,
  distanceScale = 1.0,
  speedScale = 1.0,
  incomingPersonId,
  ownerMaskStyle = "pangaea",
}: GalaxyCanvasProps) {
  const [graphicsError, setGraphicsError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Group references
  const galaxyGroupRef = useRef<THREE.Group | null>(null);
  const ownerGroupRef = useRef<THREE.Group | null>(null);
  const planetMeshesRef = useRef<
    Map<
      string,
      {
        group: THREE.Group;
        node: GalaxyNode;
        mesh: THREE.Mesh;
        effects: THREE.Group;
        hitbox?: THREE.Mesh;
        beltPoints?: THREE.Points;
        satPivot?: THREE.Group | null;
        satMesh?: THREE.Mesh | null;
      }
    >
  >(new Map());
  const connectionsRef = useRef<PlanetConnection[]>([]);

  // Camera Orbit State
  const cameraAngle = useRef({ theta: 0.45, phi: 0.52, radius: 22.0 });
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });

  // Camera Dynamic Fly-To & Realtime Tracking Target
  const trackedPlanetIdRef = useRef<string | null>(null);
  const cameraTarget = useRef(new THREE.Vector3(0, 0, 0));
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetRadius = useRef(22.0);

  // [Step 2] 시네마틱 착륙 도킹 애니메이션 참조
  const prevGuinIdsRef = useRef<Set<string>>(new Set());
  const landingAnimRef = useRef<{
    personId: string;
    group: THREE.Group;
    approachOffset: THREE.Vector3;
    elapsed: number;
    duration: number;
  } | null>(null);

  // Speed scale ref (리렌더링/씬 재생성 방지)
  const speedScaleRef = useRef(speedScale);
  useEffect(() => {
    speedScaleRef.current = speedScale;
  }, [speedScale]);

  const motionPausedRef = useRef(false);
  const simulationTimeRef = useRef(0);
  const toastTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [motionPaused, setMotionPaused] = useState(false);

  // UI States
  const [activePerson, setActivePerson] = useState<GuinPerson | null>(null);
  const [showOrbitGuides, setShowOrbitGuides] = useState(false);
  const [focusMode, setFocusMode] = useState<"galaxy" | "owner" | "friend">("galaxy");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPillarInspectModal, setShowPillarInspectModal] = useState(false);
  const [capturedNotice, setCapturedNotice] = useState(false);
  const [landingNotice, setLandingNotice] = useState<{
    name: string;
    relationTitle: string;
    affinity: number;
  } | null>(null);

  // 1. Scene & Environment 초기화
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const ownedPlanetMeshes = planetMeshesRef.current;
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 480;
    const low = window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1200);
    cameraRef.current = camera;
    updateCameraPosition();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
      antialias: !low,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true, // 캡처/스냅샷 지원
    });
    } catch {
      setGraphicsError("3D 화면을 사용할 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.");
      return;
    }
    let shaderFailed = false;
    renderer.debug.onShaderError = () => { shaderFailed = true; setGraphicsError("은하 재질을 그리지 못했어요. 아래 관계 카드는 계속 확인할 수 있어요."); };
    setGraphicsError(null);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1.25 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);
    let reflectionTarget: THREE.WebGLRenderTarget;
    try { reflectionTarget = createStudioEnvironment(renderer); scene.environment = reflectionTarget.texture; scene.environmentIntensity = 1.1; }
    catch { renderer.dispose(); renderer.forceContextLoss(); rendererRef.current = null; container.replaceChildren(); setGraphicsError("반사광을 준비하지 못했어요. 아래 사주 구성은 계속 확인할 수 있어요."); return; }

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const centerCoreLight = new THREE.PointLight(0xFFE6A0, 4.5, 45, 1.2);
    centerCoreLight.position.set(0, 0, 0);
    scene.add(centerCoreLight);

    const galaxySun = new THREE.DirectionalLight(0xffffff, 1.6);
    galaxySun.position.set(16, 22, 14);
    scene.add(galaxySun);

    const galaxyFill = new THREE.DirectionalLight(0x5075A5, 1.1);
    galaxyFill.position.set(-15, -10, -15);
    scene.add(galaxyFill);

    // 1-1. 최상위 은하 회전 그룹 생성
    const galaxyGroup = new THREE.Group();
    scene.add(galaxyGroup);
    galaxyGroupRef.current = galaxyGroup;

    // 1-2. Hyper3D Astra 레퍼런스 스타일 4대 나선팔 은하 메쉬 (42,000 파티클)
    const spiralGalaxy = buildSpiralGalaxy(low ? 9000 : 24000);
    galaxyGroup.add(spiralGalaxy.galaxyGroup);

    // 1-3. 원경 배경 은하 성단
    const bgStarGeo = new THREE.BufferGeometry();
    const bgStarCount = low ? 450 : 1200;
    const bgStarPositions = new Float32Array(bgStarCount * 3);
    const random = seededRandom(42186);
    for (let i = 0; i < bgStarCount; i++) {
      const r = 45 + random() * 65;
      const th = random() * Math.PI * 2;
      const ph = Math.acos(random() * 2 - 1);
      bgStarPositions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      bgStarPositions[i * 3 + 1] = (r * Math.sin(ph) * Math.sin(th)) * 0.5;
      bgStarPositions[i * 3 + 2] = r * Math.cos(ph);
    }
    bgStarGeo.setAttribute("position", new THREE.BufferAttribute(bgStarPositions, 3));
    const bgStarMat = new THREE.PointsMaterial({
      color: 0xCCE0FF,
      size: 0.14,
      transparent: true,
      opacity: 0.65,
    });
    const bgStarPoints = new THREE.Points(bgStarGeo, bgStarMat);
    scene.add(bgStarPoints);

    // 인터랙션
    const onClick = (e: MouseEvent) => {
      if (!cameraRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const hitCandidates: THREE.Object3D[] = [];
      planetMeshesRef.current.forEach((val) => {
        hitCandidates.push(val.mesh);
        if (val.hitbox) hitCandidates.push(val.hitbox);
      });

      const intersects = raycaster.intersectObjects(hitCandidates, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        planetMeshesRef.current.forEach((val) => {
          if (val.mesh === hit || val.hitbox === hit || val.group.children.includes(hit)) {
            setActivePerson(val.node.person);
            if (onSelectPerson) onSelectPerson(val.node.person);

            // 실시간 궤도 추적 락온
            trackPlanet(val.node.person.id, val.node.isOwner);
          }
        });
      }
    };

    const dom = renderer.domElement;
    let contextLost = false;
    const detachGestures = bindSceneGestures(dom, {
      dragging: active => { isDragging.current = active; }, tap: onClick,
      rotate: (dx, dy) => { cameraAngle.current.theta -= dx * .0065; cameraAngle.current.phi = Math.max(.18, Math.min(Math.PI / 2 - .04, cameraAngle.current.phi + dy * .0065)); updateCameraPosition(); },
      zoom: delta => { targetRadius.current = Math.max(6, Math.min(38, targetRadius.current + delta)); cameraAngle.current.radius = targetRadius.current; updateCameraPosition(); },
    });
    const onContextLost = (event: Event) => { event.preventDefault(); contextLost = true; setGraphicsError("3D 연결이 잠시 끊겼어요. 복구를 기다려주세요."); };
    const onContextRestored = () => {
      try { const restored = createStudioEnvironment(renderer); reflectionTarget.dispose(); reflectionTarget = restored; scene.environment = restored.texture; contextLost = false; shaderFailed = false; setGraphicsError(null); }
      catch { setGraphicsError("반사광을 복구하지 못했어요. 화면을 다시 열어주세요."); }
    };
    dom.addEventListener("webglcontextlost", onContextLost);
    dom.addEventListener("webglcontextrestored", onContextRestored);

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = Math.max(1, containerRef.current.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 렌더 애니메이션 루프
    let animationFrameId: number;
    let previousTime = performance.now();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => { motionPausedRef.current = reducedMotion.matches; setMotionPaused(reducedMotion.matches); };
    updateMotionPreference();
    reducedMotion.addEventListener("change", updateMotionPreference);
    const onVisibility = () => { previousTime = performance.now(); };
    document.addEventListener("visibilitychange", onVisibility);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = safeDelta(now, previousTime);
      previousTime = now;
      if (document.hidden || contextLost || shaderFailed) return;
      const curSpeed = motionPausedRef.current ? 0 : Math.max(0, Math.min(3, speedScaleRef.current));
      const motionDt = dt * curSpeed;
      simulationTimeRef.current += motionDt;
      const simulationTime = simulationTimeRef.current;

      // 1. 전체 은하 및 모든 행성의 동기화 공전 (4대 나선팔 스핀)
      if (galaxyGroupRef.current) {
        // Stars and each system have independent angular speeds, not one rigid parent spin.
        spiralGalaxy.galaxyGroup.rotation.y = simulationTime * .026;
        planetMeshesRef.current.forEach(({group, node}) => {
          if (node.isOwner) return;
          setGalaxyOrbitPosition(group.position, node.worldPos, simulationTime);
          const landing = landingAnimRef.current;
          if (landing?.group === group) {
            landing.elapsed += motionDt;
            const elapsed = reducedMotion.matches ? landing.duration : landing.elapsed;
            const t = Math.min(1, elapsed / landing.duration);
            // The moving orbit remains the destination. At t=1 both offset and
            // its first derivative are zero, so position and velocity join it.
            group.position.addScaledVector(landing.approachOffset, Math.pow(1 - t, 3));
            if (t >= 1) landingAnimRef.current = null;
          }
        });
      }

      // 2. 추적 대상 행성의 실시간 월드 좌표 갱신 (공전 이동 프레임 단위 완벽 추적)
      if (trackedPlanetIdRef.current) {
        const tracked = planetMeshesRef.current.get(trackedPlanetIdRef.current);
        if (tracked && tracked.group) {
          const worldPos = new THREE.Vector3();
          tracked.group.getWorldPosition(worldPos);
          cameraTarget.current.copy(worldPos);
        } else {
          trackedPlanetIdRef.current = null;
        }
      }

      // 3. 카메라 부드러운 줌 & 타깃(시선) 보간
      cameraAngle.current.radius += (targetRadius.current - cameraAngle.current.radius) * damping(5, dt);
      currentLookAt.current.lerp(cameraTarget.current, damping(5, dt));

      // 4. 자동 완만 선회 (드래그 중이 아닐 때)
      if (!isDragging.current) {
        if (trackedPlanetIdRef.current) {
          // 행성 추적 중: 은하 공전 각속도(0.0012)와 동기화하여 행성을 화면 중심에 완벽 고정
          cameraAngle.current.theta += 0.025 * motionDt;
        } else {
          // 은하 전체 조망: 완만하게 주변 선회
          cameraAngle.current.theta += 0.016 * motionDt;
        }
      }

      // 5. 매 프레임 카메라 위치 및 시선 갱신
      updateCameraPosition();

      // 6. 사주 행성 개별 자전, 연주 소행성대 회전 및 위성 공전
      planetMeshesRef.current.forEach(({ mesh, effects, beltPoints, satPivot, satMesh }) => {
        mesh.rotation.y += .16 * motionDt;
        animateSurface(mesh.material, motionDt);
        animateSurfaceEffects(effects, simulationTime, motionDt);

        if (beltPoints) {
          beltPoints.rotation.y += .075 * motionDt;
        }

        if (satPivot) {
          satPivot.rotation.y += .32 * motionDt;
          if (satMesh) {
            satMesh.rotation.y += .21 * motionDt;
            animateSurface(satMesh.material, motionDt);
          }
        }
      });

      // 7. 인연선 펄스 파티클 동적 갱신
      connectionsRef.current.forEach((conn) => {
        const origin = ownerGroupRef.current?.position ?? new THREE.Vector3();
        conn.curve.v0.copy(origin);
        conn.curve.v2.copy(conn.friendGroup.position);
        conn.curve.v1.copy(origin).add(conn.friendGroup.position).multiplyScalar(.5);
        conn.curve.v1.y += .9;
        const points = conn.curve.getPoints(24);
        const attribute = conn.line.geometry.getAttribute('position') as THREE.BufferAttribute;
        points.forEach((point, i) => attribute.setXYZ(i, point.x, point.y, point.z));
        attribute.needsUpdate = true;
        conn.line.geometry.computeBoundingSphere();
        conn.pulseT = (conn.pulseT + .22 * motionDt) % 1.0;
        const pPos = conn.curve.getPoint(conn.pulseT);
        conn.pulseMesh.position.copy(pPos);
      });

      renderer.render(scene, camera);
    };
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      toastTimersRef.current.forEach(clearTimeout);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", updateMotionPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      detachGestures();
      ownedPlanetMeshes.forEach(({ effects }) => disposeSurfaceEffects(effects));
      if (sceneRef.current) {
        disposeHierarchy(sceneRef.current);
      }
      dom.removeEventListener("webglcontextlost", onContextLost);
      dom.removeEventListener("webglcontextrestored", onContextRestored);
      scene.environment = null;
      reflectionTarget.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, []);

  function updateCameraPosition() {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraAngle.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.set(
      currentLookAt.current.x + x,
      currentLookAt.current.y + y,
      currentLookAt.current.z + z
    );
    cameraRef.current.lookAt(currentLookAt.current);
  }

  function trackPlanet(personId: string, isOwner: boolean) {
    trackedPlanetIdRef.current = personId;
    targetRadius.current = isOwner ? 6.2 : 5.2;
    cameraAngle.current.phi = 0.44;
    setFocusMode(isOwner ? "owner" : "friend");
  }

  const startTrackingPlanet = useCallback(trackPlanet, []);

  const flyCameraToOverview = useCallback(() => {
    trackedPlanetIdRef.current = null;
    cameraTarget.current.set(0, 0, 0);
    targetRadius.current = 22.0;
    cameraAngle.current.phi = 0.52;
    setFocusMode("galaxy");
  }, []);

  const resetGalaxyMotion = () => {
    simulationTimeRef.current = 0;
    landingAnimRef.current = null;
    planetMeshesRef.current.forEach(({mesh, effects, group, node, satPivot, satMesh, beltPoints}) => {
      mesh.rotation.set(0, 0, 0); resetSurface(mesh.material);
      animateSurfaceEffects(effects, 0, 0);
      group.position.copy(node.worldPos);
      if (satPivot) satPivot.rotation.set(.28, 0, .12);
      if (satMesh) { satMesh.rotation.set(0, 0, 0); resetSurface(satMesh.material); }
      if (beltPoints) beltPoints.rotation.set(.28, 0, 0);
    });
    connectionsRef.current.forEach(connection => { connection.pulseT = 0; });
    cameraAngle.current = {theta: .45, phi: .52, radius: 22};
    flyCameraToOverview();
  };

  const flyCameraToOwner = useCallback(() => {
    const ownerEntry = Array.from(planetMeshesRef.current.values()).find((v) => v.node.isOwner);
    if (ownerEntry) {
      startTrackingPlanet(ownerEntry.node.person.id, true);
      setActivePerson(ownerEntry.node.person);
      if (onSelectPerson) onSelectPerson(ownerEntry.node.person);
    }
  }, [startTrackingPlanet, onSelectPerson]);

  // 2. 인연 목록(guins) 변경 시 3D 은하 노드 & 관계선 동적 빌드
  useEffect(() => {
    if (!galaxyGroupRef.current || !sceneRef.current) return;
    const galaxyGroup = galaxyGroupRef.current;
    planetMeshesRef.current.forEach(({ effects }) => disposeSurfaceEffects(effects));

    const planetsToRemove: THREE.Object3D[] = [];
    galaxyGroup.children.forEach((c, idx) => {
      if (idx > 0) planetsToRemove.push(c);
    });
    planetsToRemove.forEach((c) => {
      disposeHierarchy(c);
      galaxyGroup.remove(c);
    });

    planetMeshesRef.current.clear();
    connectionsRef.current = [];
    ownerGroupRef.current = null;

    const nodes = buildGalaxyNodes(guins, distanceScale);
    const sharedSphereGeo = new THREE.SphereGeometry(1, 32, 32);
    sharedSphereGeo.computeBoundingSphere();
    if (sharedSphereGeo.boundingSphere) sharedSphereGeo.boundingSphere.radius *= 1 + MAX_LIVING_RADIAL_RELIEF;
    if (nodes.length === 0) sharedSphereGeo.dispose();
    const random = seededRandom(hashSeed(guins.map(g => g.id).join(":")));

    const prevGuinIds = prevGuinIdsRef.current;
    const isInitialMount = prevGuinIds.size === 0;
    const newlyArrivedNode = nodes.find(
      (n) => !n.isOwner && (!prevGuinIds.has(n.person.id) || n.person.id === incomingPersonId)
    );

    nodes.forEach((node) => {
      const planetGroup = new THREE.Group();
      const isOwner = node.isOwner;
      const scale = isOwner ? 1.3 : 0.88;

      // 4기둥의 천간만 시각화합니다. 원래 간지/계산 데이터는 node에 보존합니다.
      const pD = getStemThemePreset(node.dayKey);
      const pM = getStemThemePreset(node.monthKey);
      const pY = getStemThemePreset(node.yearKey);
      const pH = node.hourKey ? getStemThemePreset(node.hourKey) : null;

      // 70:30 표면 합성 (일간 70% + 월간 30%)
      const maskStyle = isOwner ? ownerMaskStyle : "pangaea";
      const { material, effects } = createPlanetAppearance(pD, pM, 1, maskStyle);
      const mainMesh = new THREE.Mesh(sharedSphereGeo, material);
      mainMesh.scale.set(scale, scale, scale);
      mainMesh.add(effects);
      animateSurfaceEffects(effects, simulationTimeRef.current, 0);
      planetGroup.add(mainMesh);

      // 연주 소행성대 파티클 (SLOT-Y: 단 1개 고리 또는 얇은 소행성대 파티클 클라우드)
      const belt = createAsteroidBeltParticles(pY, scale * 0.58, 1200);
      belt.points.rotation.x = .28;
      planetGroup.add(belt.points);

      // 시주 위성 구체 (SLOT-H)
      let satPivot: THREE.Group | null = null;
      let satMesh: THREE.Mesh | null = null;

      if (pH) {
        satPivot = new THREE.Group();
        satPivot.rotation.x = 0.28;
        satPivot.rotation.z = 0.12;
        planetGroup.add(satPivot);

        const satMat = createPlanetMaterial(pH, undefined, "pangaea", 256);
        satMesh = new THREE.Mesh(sharedSphereGeo, satMat);
        satMesh.scale.set(scale * 0.28, scale * 0.28, scale * 0.28);
        satMesh.position.set(scale * 2.2, 0, 0);
        satPivot.add(satMesh);
      }

      // 클릭 판정용 투명 히트박스 (작은 행성도 터치/마우스로 쉽게 선택 가능)
      const hitGeo = new THREE.SphereGeometry(scale * 1.8, 16, 16);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitbox = new THREE.Mesh(hitGeo, hitMat);
      planetGroup.add(hitbox);

      // 천체 HUD 라벨 스프라이트 부착 (Hyper3D 레퍼런스 스타일)
      const badgeText = isOwner
        ? "나의 중심별"
        : `${node.person.relationTitle} · 궁합 ${node.person.affinityScore || 90}점`;
      const labelSprite = createPlanetLabelSprite(node.person.name, badgeText, isOwner);
      labelSprite.position.set(0, scale * 1.6 + 0.5, 0);
      planetGroup.add(labelSprite);

      // [Step 2] 시네마틱 착륙 도킹 체크 (새로 도착한 친구 행성)
      const isNewlyArrived =
        !isOwner &&
        !isInitialMount &&
        newlyArrivedNode &&
        newlyArrivedNode.person.id === node.person.id;

      if (isNewlyArrived) {
        // 우주 저편에서 날아오는 초기 시작 좌표 (원경 고도)
        const startPos = new THREE.Vector3(
          node.worldPos.x * 2.8 + 8,
          13,
          node.worldPos.z * 2.8 + 8
        );
        planetGroup.position.copy(startPos);
        const orbitalPosition = new THREE.Vector3();
        setGalaxyOrbitPosition(orbitalPosition, node.worldPos, simulationTimeRef.current);

        landingAnimRef.current = {
          personId: node.person.id,
          group: planetGroup,
          approachOffset: startPos.clone().sub(orbitalPosition),
          elapsed: 0,
          duration: 2.8,
        };

        // 카메라 즉시 해당 행성 추적 락온
        startTrackingPlanet(node.person.id, false);
        setActivePerson(node.person);

        setLandingNotice({
          name: node.person.name,
          relationTitle: node.person.relationTitle,
          affinity: node.person.affinityScore || 90,
        });

        toastTimersRef.current.push(setTimeout(() => {
          setLandingNotice(null);
        }, 5500));
      } else {
        // 4대 나선팔 내 3D 안착 좌표 지정
        planetGroup.position.copy(node.worldPos);
      }

      if (isOwner) {
        ownerGroupRef.current = planetGroup;
      } else {
        const ownerPos = nodes.find((n) => n.isOwner)?.worldPos || new THREE.Vector3(0, 0, 0);
        const friendPos = node.worldPos;
        const mid = new THREE.Vector3(
          (ownerPos.x + friendPos.x) * 0.5,
          (ownerPos.y + friendPos.y) * 0.5 + 0.9,
          (ownerPos.z + friendPos.z) * 0.5
        );
        // Animated curve endpoints must not overwrite the original orbit anchors.
        const curve = new THREE.QuadraticBezierCurve3(ownerPos.clone(), mid, friendPos.clone());

        const curvePoints = curve.getPoints(24);
        const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xE6C875,
          transparent: true,
          opacity: 0.65,
        });
        const line = new THREE.Line(curveGeo, lineMat);
        galaxyGroup.add(line);

        const pulseGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const pulseMat = new THREE.MeshBasicMaterial({ color: 0xFFF0A0 });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        galaxyGroup.add(pulseMesh);

        connectionsRef.current.push({
          friendGroup: planetGroup,
          line,
          curve,
          pulseMesh,
          pulseT: random(),
        });
      }

      galaxyGroup.add(planetGroup);
      planetMeshesRef.current.set(node.person.id, {
        group: planetGroup,
        node,
        mesh: mainMesh,
        effects,
        hitbox,
        beltPoints: belt.points,
        satPivot,
        satMesh,
      });
    });

    // 은하 나선 궤도선 가이드 (얇고 섬세한 1px 원형 궤도선)
    if (showOrbitGuides) {
      const createOrbitLine = (radius: number) => {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= 64; i++) {
          const theta = (i / 64) * Math.PI * 2;
          points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
          color: 0x4A85C4,
          transparent: true,
          opacity: 0.25,
        });
        return new THREE.LineLoop(geo, mat);
      };

      galaxyGroup.add(createOrbitLine(5.8));
      galaxyGroup.add(createOrbitLine(8.6));
    }

    // 직전 은하 인연 ID 셋 저장
    prevGuinIdsRef.current = new Set(guins.map((g) => g.id));

    const currentSelected =
      guins.find((g) => g.id === selectedPersonId) || guins.find((g) => g.isMe) || null;
    setActivePerson(currentSelected);
  }, [guins, distanceScale, showOrbitGuides, incomingPersonId, ownerMaskStyle]);

  // 선택된 인연이 외부에서 바뀔 때 카메라 실시간 추적 포커싱
  useEffect(() => {
    if (!selectedPersonId) return;
    const target = planetMeshesRef.current.get(selectedPersonId);
    if (target) {
      startTrackingPlanet(target.node.person.id, target.node.isOwner);
      setActivePerson(target.node.person);
    }
  }, [selectedPersonId, startTrackingPlanet]);

  // 스냅샷/이미지 저장 기능
  const handleCaptureSnapshot = () => {
    if (!rendererRef.current || graphicsError) return;
    try {
      const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `우리은하_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      setCapturedNotice(true);
      toastTimersRef.current.push(setTimeout(() => setCapturedNotice(false), 2500));
    } catch {
      alert("이미지 저장 중 오류가 발생했습니다.");
    }
  };

  // 전체화면 토글
  const handleToggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={wrapperRef}
      data-scene="galaxy" data-scene-state={graphicsError ? "fallback" : "ready"}
      className={`galaxy-stage relative w-full h-full min-h-[460px] rounded-[32px] overflow-hidden bg-gradient-to-b from-[#020409] via-[#080E1C] to-[#0E172E] border border-white/10 shadow-2xl ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none min-h-screen" : ""
      }`}
    >
      {/* Three.js 캔버스 마운트 */}
      {graphicsError && <div role="status" className="scene-placeholder"><strong>{graphicsError}</strong><span>행성 없이도 같은 사람의 구성과 관계 카드를 읽을 수 있어요.</span><div className="scene-fallback-list">{guins.map(person => <button key={person.id} onClick={() => { setActivePerson(person); onSelectPerson?.(person); }}>{person.name}</button>)}</div></div>}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 상단 은하 타이틀 & 조작 안내 오버레이 (Hyper3D Astra HUD 스타일) */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-[11px] font-bold text-doryeong-gold flex items-center gap-1.5 shadow-md">
            <Sparkles className="h-3.5 w-3.5 text-doryeong-gold" />
            함께하는 사람들의 은하
          </span>
          <span className="text-[10px] text-white/70 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10 hidden md:inline-block font-mono">
            행성을 선택해 둘러보세요
          </span>
        </div>

        {/* 상단 컨트롤 버튼 (초점 전환, 캡처, 전체화면) */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {focusMode !== "galaxy" ? (
            <button
              onClick={flyCameraToOverview}
              className="px-2.5 py-1 rounded-full bg-cyan-950/80 hover:bg-cyan-900/90 backdrop-blur-md border border-cyan-400/40 text-[10.5px] font-medium text-cyan-200 transition-all flex items-center gap-1 shadow-sm"
              title="은하 전체 조망으로 복귀"
            >
              <Compass className="h-3 w-3 text-cyan-300" />
              <span>은하 전체 조망</span>
            </button>
          ) : (
            <button
              onClick={flyCameraToOwner}
              className="px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-[10.5px] font-medium text-white transition-all flex items-center gap-1 shadow-sm"
              title="나의 별로 카메라 포커스 및 공전 궤도 추적"
            >
              <Crosshair className="h-3 w-3 text-doryeong-gold" />
              <span>나의 별 추적</span>
            </button>
          )}

          <button
            onClick={() => { motionPausedRef.current = !motionPausedRef.current; setMotionPaused(motionPausedRef.current); }}
            aria-pressed={!motionPaused}
            className="px-2.5 py-1 rounded-full bg-black/60 border border-white/20 text-[10.5px] text-white"
            title="은하와 천체 움직임 일시정지 또는 재생"
          >{motionPaused ? "움직임 재생" : "움직임 멈춤"}</button>

          <button onClick={resetGalaxyMotion} className="px-2.5 py-1 rounded-full bg-black/60 border border-white/20 text-[10.5px] text-white" title="은하 시점과 천체 움직임 초기화">초기화</button>

          {/* 은하 항로선 토글 */}
          <button
            onClick={() => setShowOrbitGuides((prev) => !prev)}
            className="px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-[10.5px] font-medium text-white transition-all flex items-center gap-1 shadow-sm"
            title="나선 궤도 안내선 토글"
          >
            <Eye className="h-3 w-3 text-doryeong-gold" />
            <span className="hidden sm:inline">
              {showOrbitGuides ? "항로선" : "항로숨김"}
            </span>
          </button>

          {/* 스냅샷 이미지 저장 */}
          <button
            onClick={handleCaptureSnapshot}
            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white transition-all shadow-sm"
            title="은하 캡처 이미지 저장"
          >
            <Camera className="h-3.5 w-3.5 text-doryeong-gold" />
          </button>

          {/* 전체화면 토글 */}
          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white transition-all shadow-sm"
            title={isFullscreen ? "전체화면 종료" : "전체화면 모드"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5 text-white" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* 스냅샷 저장 알림 토스트 */}
      {capturedNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs px-4 py-2 rounded-xl backdrop-blur-md shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Camera className="h-4 w-4 text-emerald-400" />
          <span>우리은하 고해상도 이미지가 저장되었습니다! ✨</span>
        </div>
      )}

      {/* [Step 2] 시네마틱 착륙 도킹 HUD 알림 */}
      {landingNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-amber-950/95 via-purple-950/95 to-slate-950/95 border-2 border-doryeong-gold text-white px-5 py-3 rounded-2xl backdrop-blur-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="p-2 rounded-xl bg-doryeong-gold/20 text-doryeong-gold shrink-0">
            <Sparkles className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <p className="text-xs font-bold text-doryeong-gold flex items-center gap-1.5">
              <span>🚀 새로운 행성 착륙 도킹 성공!</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/30 text-rose-300 font-normal">
                궁합 {landingNotice.affinity}점
              </span>
            </p>
            <p className="text-xs text-white/90 font-serif mt-0.5">
              {landingNotice.name}님의 행성이 은하 나선팔에 궤도를 그리며 안착했습니다.
            </p>
          </div>
        </div>
      )}

      {/* 하단 활성화된 인연 요약 바 (행성 클릭 시 연동) */}
      {activePerson && (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-black/85 backdrop-blur-xl border border-white/20 rounded-2xl p-3 text-white shadow-2xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 font-serif ${
                activePerson.isMe
                  ? "bg-doryeong-gold text-doryeong-navy ring-2 ring-doryeong-gold/60 shadow-[0_0_12px_rgba(255,215,0,0.5)]"
                  : "bg-white/15 text-white border border-cyan-400/30"
              }`}
            >
              {activePerson.name.substring(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {activePerson.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-doryeong-gold/20 text-doryeong-gold border border-doryeong-gold/30">
                  {activePerson.isMe ? "나의 중심별" : activePerson.relationTitle}
                </span>
              </div>
              <p className="text-[11px] text-white/70 line-clamp-1 mt-0.5">
                {activePerson.advice}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!activePerson.isMe && (
              <span className="text-xs font-bold text-rose-300 bg-rose-500/20 border border-rose-400/30 px-2 py-0.5 rounded-full block">
                궁합 {activePerson.affinityScore}점
              </span>
            )}
            <button
              onClick={() => setShowPillarInspectModal(true)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all text-[11px] flex items-center gap-1"
              title="4기둥 행성 슬롯 상세 보기"
            >
              <Info className="h-3.5 w-3.5 text-doryeong-gold" />
              <span className="hidden sm:inline">슬롯 정보</span>
            </button>
          </div>
        </div>
      )}

      {/* 4기둥 슬롯 정밀 분석 모달 */}
      {showPillarInspectModal && activePerson && (
        <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0B101E] border border-white/20 rounded-2xl p-5 text-white shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="font-serif font-bold text-base text-doryeong-gold flex items-center gap-1.5">
                  <span>{activePerson.name}님의 사주 행성 구성</span>
                </h4>
                <p className="text-[10.5px] text-white/60">
                  4기둥의 천간만 행성에 반영 · 지지는 정령에 반영
                </p>
              </div>
              <button
                onClick={() => setShowPillarInspectModal(false)}
                className="text-white/60 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[10px] text-doryeong-gold font-bold block">
                  SLOT-D · 주 표면 (70%)
                </span>
                <p className="font-bold text-sm text-white font-serif">
                  {getStemThemePreset(activePerson.pillars?.dayKey || "갑자").stem}
                </p>
                <p className="text-[10px] text-white/60">일간 천간 테마</p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[10px] text-blue-300 font-bold block">
                  SLOT-M · 보조 표면 (30%)
                </span>
                <p className="font-bold text-sm text-white font-serif">
                  {getStemThemePreset(activePerson.pillars?.monthKey || "병인").stem}
                </p>
                <p className="text-[10px] text-white/60">월간 UV 마스크 영역</p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[10px] text-rose-300 font-bold block">
                  SLOT-Y · 고리/소행성대
                </span>
                <p className="font-bold text-sm text-white font-serif">
                  {getStemThemePreset(activePerson.pillars?.yearKey || "을축").stem}
                </p>
                <p className="text-[10px] text-white/60">연간 테마 단 1개 고리</p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[10px] text-amber-300 font-bold block">
                  SLOT-H · 위성 구체
                </span>
                <p className="font-bold text-sm text-white font-serif">
                  {activePerson.pillars?.hourKey ? getStemThemePreset(activePerson.pillars.hourKey).stem : "시간미상"}
                </p>
                <p className="text-[10px] text-white/60">
                  {activePerson.pillars?.hourKey ? "시의 천간 공전 위성" : "시간 미입력(제외)"}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPillarInspectModal(false)}
              className="w-full py-2.5 rounded-xl bg-doryeong-gold text-doryeong-navy font-bold text-xs"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 중앙 안내 (인연이 나 혼자일 때 친구 초대 안내) */}
      {guins.length === 1 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none text-center p-4 bg-black/50 backdrop-blur-md rounded-2xl border border-white/15 max-w-[280px]">
          <Users className="h-6 w-6 text-doryeong-gold mx-auto mb-2 opacity-90" />
          <p className="text-xs font-serif text-white font-bold">
            은하 나선팔에 인연 행성을 추가해보세요
          </p>
          <p className="text-[10.5px] text-white/75 mt-1 leading-relaxed">
            하단의 <strong>&#39;체험용 인연 행성 추가&#39;</strong>를 누르면 4대 나선팔을 따라 인연별들이 즉시 함께 공전합니다.
          </p>
        </div>
      )}
    </div>
  );
}
