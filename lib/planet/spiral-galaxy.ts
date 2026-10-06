import * as THREE from "three";
import { seededRandom } from "./surface-math";

/**
 * 4개 대나선팔을 지닌 3D 나선은하 생성기
 * Hyper3D / GPT-6 Astra '실제 궤도 물리학 은하' 레퍼런스 스타일
 * - 황금빛 은하핵 (Galactic Core Bulge)
 * - 4개 로그 나선팔 (4 Logarithmic Spiral Arms with Differential Spin)
 * - 초미세 항성 먼지 및 발광 거대성 2계층 파티클 시스템
 */

// 1. 부드러운 원형 광채 텍스처 (정사각형 점 대신 부드러운 방사형 빛망울 렌더링)
export function createStarGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    gradient.addColorStop(0.2, "rgba(235, 245, 255, 0.85)");
    gradient.addColorStop(0.5, "rgba(180, 220, 255, 0.35)");
    gradient.addColorStop(0.8, "rgba(120, 180, 255, 0.08)");
    gradient.addColorStop(1.0, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// 2. 은하핵 블룸 광채 스프라이트 텍스처
export function createCoreGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255, 250, 230, 1.0)");
    gradient.addColorStop(0.25, "rgba(255, 225, 140, 0.75)");
    gradient.addColorStop(0.5, "rgba(255, 185, 70, 0.35)");
    gradient.addColorStop(0.75, "rgba(255, 140, 30, 0.12)");
    gradient.addColorStop(1.0, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface SpiralGalaxyBuildResult {
  galaxyGroup: THREE.Group;
  fineStarsPoints: THREE.Points;
  brightStarsPoints: THREE.Points;
  coreSprite: THREE.Sprite;
  starCount: number;
}

export function buildSpiralGalaxy(starCount: number = 42000): SpiralGalaxyBuildResult {
  const random = seededRandom(20261002);
  const galaxyGroup = new THREE.Group();
  const starTex = createStarGlowTexture();
  const coreTex = createCoreGlowTexture();

  // A. 은하핵 블룸 발광 스프라이트
  const coreMat = new THREE.SpriteMaterial({
    map: coreTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const coreSprite = new THREE.Sprite(coreMat);
  coreSprite.scale.set(7.5, 7.5, 1.0);
  galaxyGroup.add(coreSprite);

  // B. 1계층: 40,000여 개의 미세 항성 먼지 (Dense Fine Stars)
  const fineCount = Math.floor(starCount * 0.9);
  const finePositions = new Float32Array(fineCount * 3);
  const fineColors = new Float32Array(fineCount * 3);

  // C. 2계층: 4,000여 개의 주요 발광 거대성/성단 노드 (Bright Anchor Stars)
  const brightCount = starCount - fineCount;
  const brightPositions = new Float32Array(brightCount * 3);
  const brightColors = new Float32Array(brightCount * 3);

  // 가우시안 랜덤 근사 함수 (Box-Muller)
  const randomGaussian = (mean = 0, stdev = 1) => {
    const u = 1 - random();
    const v = random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
  };

  // 4개 대나선팔 설정
  const armsCount = 4;
  const maxRadius = 18.0;

  // 1) 미세 항성 생성
  for (let i = 0; i < fineCount; i++) {
    // 25% 확률로 중심핵 영역, 65% 확률로 4개 나선팔, 10% 확률로 성간 원반 먼지
    const dice = random();
    let r = 0;
    let theta = 0;
    let y = 0;

    let cr = 1.0, cg = 1.0, cb = 1.0;

    if (dice < 0.24) {
      // 은하핵 (Bulge)
      r = Math.pow(random(), 1.8) * 3.4;
      theta = random() * Math.PI * 2;
      y = randomGaussian(0, 0.42 * (1 - r / 4.0));

      // 핵 영역: 따뜻한 골드, 샴페인 크림 색상
      const t = r / 3.4;
      cr = 1.0;
      cg = 0.88 - t * 0.1;
      cb = 0.55 + t * 0.25;
    } else if (dice < 0.90) {
      // 4개 나선팔 (Logarithmic Spiral Arms)
      const armIndex = i % armsCount;
      const baseArmAngle = (armIndex * Math.PI * 2) / armsCount;

      // 반경 분포: 중심 근처부터 외곽까지 (중간 영역 밀도 높임)
      const u = random();
      r = 2.0 + Math.pow(u, 1.2) * (maxRadius - 2.0);

      // 나선 방정식: Hyper3D 레퍼런스와 정확히 일치하는 4대 나선곡률
      // r = 2.0 -> thetaOffset ~ 3.5rad, r = 18 -> thetaOffset ~ 12.8rad (약 1.5회 회전)
      const spiralTwist = 2.45 * Math.pow(r, 0.58);

      // 나선팔 두께 산포 (외곽으로 갈수록 폭이 자연스럽게 넓어짐)
      const armWidth = 0.32 + 0.05 * r;
      const rJitter = randomGaussian(0, armWidth);
      const angleJitter = randomGaussian(0, armWidth / Math.max(1.5, r));

      r = Math.max(0.8, r + rJitter);
      theta = baseArmAngle + spiralTwist + angleJitter;

      // 은하 원반 수직 두께: 얇고 샤프한 원반형
      const diskThickness = 0.24 * Math.exp(-r / 15.0);
      y = randomGaussian(0, diskThickness);

      // 색상 그래디언트: 황금핵 -> 백색 주계열성 -> 외곽 청백색/시안 성간 가스
      if (r < 5.2) {
        // 황금 샴페인/상아색
        cr = 1.0;
        cg = 0.94;
        cb = 0.72;
      } else if (r < 10.5) {
        // 다이아몬드 순백색 ~ 아이스 블루
        cr = 0.92;
        cg = 0.96;
        cb = 1.0;
      } else {
        // 외곽 나선팔의 신비로운 시안 블루 (레퍼런스 이미지 강조색)
        cr = 0.55 + random() * 0.25;
        cg = 0.84 + random() * 0.15;
        cb = 1.0;
      }
    } else {
      // 나선팔 사이의 성간 원반 완충 먼지 (Diffuse Disk Halo)
      r = random() * maxRadius;
      theta = random() * Math.PI * 2;
      y = randomGaussian(0, 0.35);

      cr = 0.75;
      cg = 0.82;
      cb = 0.95;
    }

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    finePositions[i * 3] = x;
    finePositions[i * 3 + 1] = y;
    finePositions[i * 3 + 2] = z;

    fineColors[i * 3] = cr;
    fineColors[i * 3 + 1] = cg;
    fineColors[i * 3 + 2] = cb;
  }

  // 2) 발광 거대성 / 성단 주요 앵커별 생성 (Bright Stars)
  for (let j = 0; j < brightCount; j++) {
    const armIndex = j % armsCount;
    const baseArmAngle = (armIndex * Math.PI * 2) / armsCount;

    const u = random();
    const r = 2.5 + Math.pow(u, 1.1) * (maxRadius - 2.5);
    const spiralTwist = 2.45 * Math.pow(r, 0.58);
    const angleJitter = randomGaussian(0, 0.16);

    const theta = baseArmAngle + spiralTwist + angleJitter;
    const y = randomGaussian(0, 0.2);

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    brightPositions[j * 3] = x;
    brightPositions[j * 3 + 1] = y;
    brightPositions[j * 3 + 2] = z;

    // 강렬한 광채를 띤 푸른 거성 & 황금 거성
    if (random() < 0.3) {
      brightColors[j * 3] = 1.0;
      brightColors[j * 3 + 1] = 0.85;
      brightColors[j * 3 + 2] = 0.5;
    } else {
      brightColors[j * 3] = 0.7;
      brightColors[j * 3 + 1] = 0.92;
      brightColors[j * 3 + 2] = 1.0;
    }
  }

  // 버퍼 지오메트리 조립
  const fineGeo = new THREE.BufferGeometry();
  fineGeo.setAttribute("position", new THREE.BufferAttribute(finePositions, 3));
  fineGeo.setAttribute("color", new THREE.BufferAttribute(fineColors, 3));

  const fineMat = new THREE.PointsMaterial({
    size: 0.18,
    map: starTex,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const fineStarsPoints = new THREE.Points(fineGeo, fineMat);
  galaxyGroup.add(fineStarsPoints);

  const brightGeo = new THREE.BufferGeometry();
  brightGeo.setAttribute("position", new THREE.BufferAttribute(brightPositions, 3));
  brightGeo.setAttribute("color", new THREE.BufferAttribute(brightColors, 3));

  const brightMat = new THREE.PointsMaterial({
    size: 0.42,
    map: starTex,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const brightStarsPoints = new THREE.Points(brightGeo, brightMat);
  galaxyGroup.add(brightStarsPoints);

  return {
    galaxyGroup,
    fineStarsPoints,
    brightStarsPoints,
    coreSprite,
    starCount,
  };
}

/**
 * 특정 나선팔 및 반경에 해당하는 3D 좌표를 산출합니다.
 * 사주 인연 행성들을 나선팔 경로 위에 정확히 안착시키기 위해 사용합니다.
 */
export function getSpiralArmPosition(
  armIndex: number,
  radius: number,
  armOffsetRadian: number = 0,
  verticalJitter: number = 0
): THREE.Vector3 {
  const baseArmAngle = ((armIndex % 4) * Math.PI * 2) / 4;
  const spiralTwist = 2.45 * Math.pow(radius, 0.58);
  const theta = baseArmAngle + spiralTwist + armOffsetRadian;

  const x = Math.cos(theta) * radius;
  const z = Math.sin(theta) * radius;
  const y = verticalJitter;

  return new THREE.Vector3(x, y, z);
}
