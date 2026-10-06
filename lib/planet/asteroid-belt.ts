import * as THREE from "three";
import { hashSeed, seededRandom } from "./surface-math";
import { GanziThemePreset } from "./theme-library";
import { createStarGlowTexture } from "./spiral-galaxy";

/**
 * 연주(SLOT-Y) 고리 또는 얇은 소행성대를 띠 메쉬 대신
 * 잘게 부서진 수천 개의 성간 암석·얼음 미립자 파티클 클라우드로 생성합니다.
 * (확정사항 기준서 v0.1: 연주 두 글자 -> 고리 또는 얇은 소행성대 단 1개)
 */

export interface AsteroidBeltResult {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  particleCount: number;
}

export function createAsteroidBeltParticles(
  yearPreset: GanziThemePreset,
  scale: number = 1.0,
  count: number = 1800
): AsteroidBeltResult {
  const random = seededRandom(hashSeed(yearPreset.key + ":belt"));
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // 연주 테마의 주/보조 색상 파싱
  const pCol = new THREE.Color(yearPreset.surface.primaryColor);
  const sCol = new THREE.Color(yearPreset.surface.secondaryColor);

  // 안쪽/바깥쪽 반경 (행성 본체와의 간격 유지)
  const innerRadius = 2.35 * scale;
  const outerRadius = 3.35 * scale;
  const beltWidth = outerRadius - innerRadius;

  for (let i = 0; i < count; i++) {
    // 1. 반경 분포 (가우시안 중심 집중 + 외곽 자연스러운 산란)
    const u = random();
    const v = random();
    const rNorm = (u + v) * 0.5;
    // 자연스러운 경계선 분산을 위한 미세 지터
    const jitter = (random() - 0.5) * 0.22 * scale;
    const r = innerRadius + rNorm * beltWidth + jitter;

    // 2. 궤도 각도
    const theta = random() * Math.PI * 2;

    // 3. 소행성대 3D 입체 두께 (성간 암석 부유 클라우드)
    const thickness = (random() - 0.5) * 0.22 * scale;

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y = thickness;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // 4. 연주 테마 파티클 색상 (주 색상, 보조 색상, 미세 발광 암석 파편)
    const colorMix = random();
    const particleColor = new THREE.Color().lerpColors(pCol, sCol, colorMix);

    // 20% 확률로 햇빛을 반사하는 밝은 광물성/얼음 하이라이트 파편
    if (random() < 0.20) {
      particleColor.lerp(new THREE.Color(0xFFFFFF), 0.65);
    }

    colors[i * 3] = particleColor.r;
    colors[i * 3 + 1] = particleColor.g;
    colors[i * 3 + 2] = particleColor.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const starTex = createStarGlowTexture();

  const material = new THREE.PointsMaterial({
    size: 0.08 * scale,
    map: starTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // XZ geometry: caller supplies fixed inclination, then local Y orbit.
  const points = new THREE.Points(geometry, material);

  return {
    points,
    geometry,
    material,
    particleCount: count,
  };
}
