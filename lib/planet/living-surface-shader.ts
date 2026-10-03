import * as THREE from 'three';
import { hashSeed } from './surface-math';
import { getSurfaceFamily, type GanziThemePreset } from './theme-library';

/** The WebGLRenderer shader hooks below target three r186's standard chunks.
 * Only a fixed, calibrated region mask is a texture. Everything that moves is
 * object-space procedural geometry/normal/albedo, with one scalar clock update.
 * No screen-space paint, UV drift, screen readback, or per-frame CPU texture work.
 */
export const LIVING_SURFACE_SHADER_VERSION = 'living-surface-r186-v2';
export const MAX_LIVING_RADIAL_RELIEF = .065;

export interface LivingSurfaceState {
  time: { value: number };
  reliefScale: { value: number };
  barkMix: { value: number };
  disposed: boolean;
}

const FAMILY_INDEX = { forest: 0, lava: 1, earth: 2, metal: 3, water: 4 } as const;
const EVEN_STEMS = new Set(['을', '정', '기', '신', '계']);

/** No loops, ray marching, texture-feedback passes, or variable iteration counts.
 * Smooth 3D value noise is seam/pole independent; three fixed octaves at most.
 */
const COMMON = /* glsl */`
uniform float uLsTime;
uniform float uLsReliefScale;
uniform float uLsBarkMix;
uniform sampler2D uLsMask;
uniform vec4 uLsDay;
uniform vec4 uLsMonth;
uniform vec3 uLsDayPrimary;
uniform vec3 uLsDaySecondary;
uniform vec3 uLsMonthPrimary;
uniform vec3 uLsMonthSecondary;
varying vec3 vLsDirection;
varying vec2 vLsUv;
varying float vLsRadius;

float lsHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(.17, .31, .73));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float lsNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lsHash(i), lsHash(i + vec3(1,0,0)), f.x),
                 mix(lsHash(i + vec3(0,1,0)), lsHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(lsHash(i + vec3(0,0,1)), lsHash(i + vec3(1,0,1)), f.x),
                 mix(lsHash(i + vec3(0,1,1)), lsHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float lsFractal(vec3 p) {
  return lsNoise(p) * .62 + lsNoise(p * 2.03 + 3.7) * .27 + lsNoise(p * 4.07 + 11.3) * .11;
}
// Inverse of THREE.SphereGeometry's x=-cos(phi)*sin(theta) convention.
// CanvasTexture's flipY means north is texture v=1, as in the geometry UVs.
vec2 lsDirectionUv(vec3 p) {
  return vec2(fract(atan(p.z, -p.x) / 6.28318530718 + 1.0), 1.0 - acos(clamp(p.y, -1.0, 1.0)) / 3.14159265359);
}
float lsMask(vec2 surfaceUv) {
  #if LS_HAS_MONTH == 1
    return texture2D(uLsMask, surfaceUv).a;
  #else
    return 1.0;
  #endif
}
// Low-frequency geometry is also used for a finite-difference vertex normal.
// profile = (yin variant, deterministic ganzi phase, roughness, relief amount).
float lsHeight(vec3 p, int family, vec4 profile) {
  float seed = profile.y;
  float variant = profile.x;
  float t = uLsTime;
  vec3 q = p * 4.0 + seed;
  if (family == 0) {
    float crowns = pow(lsNoise(p * 19.0 + seed), 2.0);
    float soil = lsNoise(q);
    return .007 + soil * .009 + crowns * .028
      + crowns * sin(dot(p, vec3(17.0, 3.0, 9.0)) + t * .8) * .0018;
  }
  if (family == 1) {
    vec3 warp = p * 6.5 + vec3(sin(t * .21 + p.y * 6.0), cos(t * .17 + p.z * 5.0), sin(t * .19 + p.x * 7.0)) * .42;
    float molten = 1.0 - smoothstep(.055, .20, abs(lsNoise(warp + seed) - .5));
    float bubbles = pow(max(0.0, sin(dot(p, vec3(31.0, 19.0, 23.0)) + t * 1.9 + seed)), 4.0);
    return .008 + lsNoise(q) * .012 + molten * (.007 + bubbles * .032);
  }
  if (family == 2) {
    float strata = sin(p.y * 37.0 + lsNoise(q) * 7.0);
    float dunes = pow(.5 + .5 * sin(dot(p, vec3(8.0, 13.0, 5.0)) + lsNoise(q) * 4.0), 2.0);
    return .008 + dunes * .026 + strata * (.004 + variant * .004);
  }
  if (family == 3) {
    float liquid = sin(dot(p, vec3(9.0, 6.0, -4.0)) + t * .7 + seed)
      * sin(dot(p, vec3(-5.0, 12.0, 7.0)) - t * .52);
    return .008 + mix(lsNoise(q * 1.5) * .013, liquid * .016 + .016, variant);
  }
  float swell = sin(dot(p, vec3(8.0, 5.0, 3.0)) - t * .8 + seed) * .004;
  float waves = sin(dot(p, vec3(22.0, 9.0, -12.0)) - t * 1.7 + seed) * .0045
    + sin(dot(p, vec3(-13.0, 29.0, 7.0)) + t * 1.3) * .003;
  return .012 + swell + waves;
}
float lsBlendedHeight(vec3 p, float region) {
  float dayHeight = lsHeight(p, LS_DAY_FAMILY, uLsDay) * (.75 + uLsDay.w * .35);
  #if LS_HAS_MONTH == 1
    return mix(lsHeight(p, LS_MONTH_FAMILY, uLsMonth) * (.75 + uLsMonth.w * .35), dayHeight, region) * uLsReliefScale;
  #else
    return dayHeight * uLsReliefScale;
  #endif
}
`;

const FRAGMENT = /* glsl */`
struct LivingSample {
  vec3 color;
  vec3 glow;
  float rough;
  float metal;
  float microHeight;
  float coat;
};
LivingSample lsSample(vec3 p, int family, vec4 profile, vec3 primary, vec3 secondary) {
  LivingSample s;
  float t = uLsTime, seed = profile.y, variant = profile.x;
  vec3 q = p * 5.0 + seed;
  float broad = lsNoise(q);
  float grain = lsNoise(p * 145.0 + seed);
  s.color = mix(primary, secondary, broad);
  s.glow = vec3(0.0);
  s.rough = profile.z;
  s.metal = 0.0;
  s.coat = 0.0;
  s.microHeight = 0.0;
  if (family == 0) {
    float canopy = lsFractal(p * 16.0 + seed);
    float path = 1.0 - smoothstep(.035, .095, abs(broad - .5));
    float crown = smoothstep(.28, .72, canopy);
    vec3 soil = mix(vec3(.053, .026, .013), vec3(.20, .115, .045), grain);
    vec3 foliage = mix(primary * .58, secondary * .72, crown);
    foliage *= .70 + grain * .43;
    s.color = mix(foliage, soil, path * .72);
    s.rough = .85 + grain * .13;
    s.microHeight = (canopy * .005 + grain * .00065) * (1.0 - path * .6);
    // Opt-in authored tree bodies use bark; planets/leaves retain their canopy.
    // The override happens inside the forest sample, before the same 70/30 mix.
    if (uLsBarkMix > 0.0) {
      float longitude = atan(p.z, p.x);
      float verticalWarp = lsNoise(vec3(p.y * 7.0, seed, 2.0)) * 2.8;
      float barkGroove = pow(.5 + .5 * sin(longitude * 29.0 + verticalWarp), 2.5);
      float barkChips = lsNoise(vec3(p.x * 43.0, p.y * 5.0, p.z * 43.0) + seed);
      vec3 bark = mix(vec3(.045, .017, .006), vec3(.245, .115, .039), .22 + barkGroove * .55 + barkChips * .20);
      bark *= .83 + grain * .23;
      s.color = mix(s.color, bark, uLsBarkMix);
      s.rough = mix(s.rough, .93 + grain * .06, uLsBarkMix);
      s.microHeight = mix(s.microHeight, barkGroove * .0031 + barkChips * .0014 + grain * .00025, uLsBarkMix);
    }
  } else if (family == 1) {
    vec3 warp = p * 6.5 + vec3(sin(t * .21 + p.y * 6.0), cos(t * .17 + p.z * 5.0), sin(t * .19 + p.x * 7.0)) * .42;
    float field = lsNoise(warp + seed);
    float molten = 1.0 - smoothstep(.035, .16, abs(field - .5));
    float thinCrust = lsNoise(p * 35.0 + seed + vec3(t * .09, 0.0, -t * .06));
    molten *= smoothstep(.16, .48, thinCrust);
    float core = pow(molten, 3.0);
    vec3 basalt = mix(vec3(.018, .014, .015), primary * .8, grain * .7);
    vec3 lava = mix(vec3(.61, .055, .003), secondary, core);
    s.color = mix(basalt, lava, molten);
    s.glow = mix(vec3(1.0, .085, .003), vec3(1.0, .42, .025), core) * molten * (.58 + core * .54);
    s.rough = mix(.94 - grain * .11, .26, molten);
    s.coat = molten * .22;
    s.microHeight = (grain - .5) * .0024 * (1.0 - molten) + thinCrust * molten * .0012;
  } else if (family == 2) {
    float strata = .5 + .5 * sin(p.y * 75.0 + lsNoise(q) * 9.0);
    float pebbles = pow(lsNoise(p * 87.0 + seed), 5.0);
    float glaze = variant * smoothstep(.66, .83, broad);
    s.color = mix(primary, secondary, .20 + strata * .36 + broad * .27);
    s.color *= .77 + grain * .32;
    s.color = mix(s.color, vec3(.12, .052, .025), pebbles * .75);
    s.rough = mix(.93 + grain * .06, .24, glaze);
    s.coat = glaze * .55;
    s.microHeight = grain * .0013 + pebbles * .0028 + strata * .0012;
  } else if (family == 3) {
    float flowing = .5 + .5 * sin(dot(p, vec3(31.0, 13.0, -17.0)) + broad * 5.0 + t * .5 * variant);
    float brushed = sin(p.y * 430.0 + broad * 11.0);
    s.color = mix(primary, secondary, .44 + broad * .25);
    s.color *= .93 + flowing * .07;
    s.metal = 1.0;
    s.rough = mix(.20 + grain * .065, .078 + flowing * .035, variant);
    s.microHeight = mix(brushed * .00009, flowing * .0003, variant);
    s.coat = .16;
  } else {
    float swell = sin(dot(p, vec3(22.0, 9.0, -12.0)) - t * 1.7 + seed);
    float ripple = sin(dot(p, vec3(74.0, 29.0, -37.0)) - t * 2.7 + broad * 4.0)
      + sin(dot(p, vec3(-41.0, 83.0, 18.0)) + t * 2.1);
    float foam = smoothstep(.87, .99, swell) * smoothstep(.76, .93, broad);
    s.color = mix(primary, secondary, .20 + broad * .50);
    s.color = mix(s.color, vec3(.59, .78, .73), foam * .65);
    s.rough = .11 + broad * .08 + foam * .35;
    s.coat = .82;
    s.microHeight = ripple * .00085 + grain * .00008;
  }
  s.microHeight *= .65 + profile.w * .6;
  return s;
}
LivingSample lsSurface(vec3 p, float region) {
  LivingSample day = lsSample(p, LS_DAY_FAMILY, uLsDay, uLsDayPrimary, uLsDaySecondary);
  #if LS_HAS_MONTH == 1
    LivingSample month = lsSample(p, LS_MONTH_FAMILY, uLsMonth, uLsMonthPrimary, uLsMonthSecondary);
    day.color = mix(month.color, day.color, region);
    day.glow = mix(month.glow, day.glow, region);
    day.rough = mix(month.rough, day.rough, region);
    day.metal = mix(month.metal, day.metal, region);
    day.microHeight = mix(month.microHeight, day.microHeight, region);
    day.coat = mix(month.coat, day.coat, region);
  #endif
  return day;
}
// Screen derivatives of an object-space height field perturb actual lighting
// normals, so PMREM reflections and moving glints follow the moving ripples.
vec3 lsPerturbNormal(vec3 surfacePosition, vec3 surfaceNormal, float height) {
  vec3 dx = dFdx(surfacePosition), dy = dFdy(surfacePosition);
  vec3 r1 = cross(dy, surfaceNormal), r2 = cross(surfaceNormal, dx);
  float det = dot(dx, r1);
  vec3 gradient = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
  return normalize(max(abs(det), 1e-10) * surfaceNormal - gradient);
}
`;

function replaceRequired(source: string, anchor: string, replacement: string): string {
  if (!source.includes(anchor)) throw new Error(`Living surface requires three r186 shader chunk: ${anchor}`);
  return source.replace(anchor, replacement);
}

/** Exported for exact-source tests without pretending a source check is GPU QA. */
export function patchLivingSurfaceShader(vertex: string, fragment: string): { vertex: string; fragment: string } {
  vertex = replaceRequired(vertex, '#include <common>', '#include <common>\n' + COMMON);
  vertex = replaceRequired(vertex, '#include <beginnormal_vertex>', /* glsl */`
    #include <beginnormal_vertex>
    vec3 lsDirection = normalize(position);
    float lsRegion = lsMask(uv);
    float lsRelief = lsBlendedHeight(lsDirection, lsRegion);
    vec3 lsTangent = normalize(cross(abs(lsDirection.y) < .95 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0), lsDirection));
    vec3 lsBitangent = cross(lsDirection, lsTangent);
    float lsStep = .006;
    vec3 lsDirectionX = normalize(lsDirection + lsTangent * lsStep);
    vec3 lsDirectionY = normalize(lsDirection + lsBitangent * lsStep);
    float lsDx = (lsBlendedHeight(lsDirectionX, lsMask(lsDirectionUv(lsDirectionX))) - lsRelief) / lsStep;
    float lsDy = (lsBlendedHeight(lsDirectionY, lsMask(lsDirectionUv(lsDirectionY))) - lsRelief) / lsStep;
    objectNormal = normalize(objectNormal - (lsTangent * lsDx + lsBitangent * lsDy) / (1.0 + lsRelief));
  `);
  vertex = replaceRequired(vertex, '#include <begin_vertex>', /* glsl */`
    #include <begin_vertex>
    vLsDirection = lsDirection;
    vLsUv = uv;
    float lsObjectRadius = length(position);
    // Meshes in the planet/galaxy/spirit canvases use uniform object scaling.
    // Matching the height to view-position units keeps moon glints size invariant.
    vLsRadius = lsObjectRadius * length(modelViewMatrix[0].xyz);
    transformed += lsDirection * lsObjectRadius * lsRelief;
  `);
  fragment = replaceRequired(fragment, '#include <common>', '#include <common>\n' + COMMON + FRAGMENT);
  fragment = replaceRequired(fragment, '#include <map_fragment>', /* glsl */`
    #include <map_fragment>
    LivingSample lsMaterial = lsSurface(normalize(vLsDirection), lsMask(vLsUv));
    diffuseColor.rgb *= lsMaterial.color;
  `);
  fragment = replaceRequired(fragment, '#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(lsMaterial.rough, .065, 1.0);');
  fragment = replaceRequired(fragment, '#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = lsMaterial.metal;');
  fragment = replaceRequired(fragment, '#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = lsPerturbNormal(-vViewPosition, normal, lsMaterial.microHeight * vLsRadius);');
  fragment = replaceRequired(fragment, '#include <clearcoat_normal_fragment_maps>', /* glsl */`
    #include <clearcoat_normal_fragment_maps>
    #ifdef USE_CLEARCOAT
      clearcoatNormal = normal;
    #endif
  `);
  fragment = replaceRequired(fragment, '#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = lsMaterial.glow;');
  fragment = replaceRequired(fragment, '#include <lights_physical_fragment>', /* glsl */`
    #include <lights_physical_fragment>
    #ifdef USE_CLEARCOAT
      material.clearcoat = lsMaterial.coat;
      material.clearcoatRoughness = clamp(max(.065, lsMaterial.rough * .58) + geometryRoughness, 0.0, 1.0);
    #endif
  `);
  return { vertex, fragment };
}

export function installLivingSurface(
  material: THREE.MeshPhysicalMaterial,
  day: GanziThemePreset,
  month: GanziThemePreset | undefined,
  mask: THREE.Texture | null,
): LivingSurfaceState {
  const state: LivingSurfaceState = { time: { value: 0 }, reliefScale: { value: 1 }, barkMix: { value: 0 }, disposed: false };
  const profile = (theme: GanziThemePreset) => new THREE.Vector4(
    EVEN_STEMS.has(theme.stem) ? 1 : 0,
    hashSeed(theme.key) / 4294967296 * 31,
    theme.surface.roughness,
    theme.surface.bumpScale,
  );
  const uniformMask = { value: mask as THREE.Texture | null };
  const uniforms = {
    uLsTime: state.time, uLsReliefScale: state.reliefScale, uLsBarkMix: state.barkMix, uLsMask: uniformMask,
    uLsDay: { value: profile(day) }, uLsMonth: { value: profile(month ?? day) },
    uLsDayPrimary: { value: new THREE.Color(day.surface.primaryColor) },
    uLsDaySecondary: { value: new THREE.Color(day.surface.secondaryColor) },
    uLsMonthPrimary: { value: new THREE.Color((month ?? day).surface.primaryColor) },
    uLsMonthSecondary: { value: new THREE.Color((month ?? day).surface.secondaryColor) },
  };
  const dayKind = FAMILY_INDEX[getSurfaceFamily(day)], monthKind = FAMILY_INDEX[getSurfaceFamily(month ?? day)];
  material.defines = { ...material.defines, LS_HAS_MONTH: month ? 1 : 0, LS_DAY_FAMILY: dayKind, LS_MONTH_FAMILY: monthKind };
  material.customProgramCacheKey = () => `${LIVING_SURFACE_SHADER_VERSION}:${dayKind}:${monthKind}:${month ? 1 : 0}`;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    const patched = patchLivingSurfaceShader(shader.vertexShader, shader.fragmentShader);
    shader.vertexShader = patched.vertex;
    shader.fragmentShader = patched.fragment;
  };
  material.userData.livingSurface = state;
  const onDispose = () => {
    if (state.disposed) return;
    state.disposed = true;
    uniformMask.value?.dispose();
    uniformMask.value = null;
    material.onBeforeCompile = () => {};
    delete material.userData.livingSurface;
    material.removeEventListener('dispose', onDispose);
  };
  material.addEventListener('dispose', onDispose);
  return state;
}
