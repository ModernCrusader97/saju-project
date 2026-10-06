/* SaJu jade moving-light v001: include in a fragment shader after its precision line.
 * Default: GLSL ES 1.00. For GLSL ES 3.00 / desktop GLSL, define SAJU_TEXTURE texture
 * before including this module. Require highp float for 2048-wide texel centers.
 * Sample an uncolored red-channel scalar atlas with NEAREST and no mipmaps.
 * All positions are already in the native canonical Generated-coordinate system.
 * The optional body-only adapter below is verified for this v001 export.
 * No function alters the original base-color UVs.
 */
#ifndef SAJU_JADE_FLOW_GLSL
#define SAJU_JADE_FLOW_GLSL
#ifdef GL_ES
// A highp float default alone does not give texture samplers highp precision.
precision highp sampler2D;
#endif
#ifndef SAJU_TEXTURE
#define SAJU_TEXTURE texture2D
#endif

const float SAJU_TWO_PI = 6.28318530717958647692;
const float SAJU_PHASE_Z = 1.04719755119659774615;
const vec3 SAJU_FIELD_MIN = vec3(-0.2, -0.05, -0.3);
const vec3 SAJU_FIELD_MAX = vec3(1.2, 1.2, 1.1);
const vec3 SAJU_EMISSION_RGB_LINEAR = vec3(0.001, 0.65, 0.08);

/* Verified for the v001 body mesh only: undeformed mesh-local glTF POSITION.
 * This is not a generic glTF convention. Revalidate after transforms are baked.
 */
vec3 sajuV001BodyGLTFLocalToGenerated(vec3 gltfLocalPosition) {
    vec3 blenderPosition = vec3(gltfLocalPosition.x, -gltfLocalPosition.z, gltfLocalPosition.y);
    vec3 center = vec3(0.000006973743438720703, -0.000013902783393859863, 1.1804927587509155);
    vec3 halfSize = vec3(0.877256453037262, 0.4755038022994995, 1.1923989057540894);
    return vec3(0.5) + (blenderPosition - center) / (2.0 * halfSize);
}

vec3 sajuLoopOffset(float seconds) {
    // Send a CPU-wrapped value in [0, 6) to avoid long-running float clock drift.
    float tau = SAJU_TWO_PI * mod(seconds, 6.0) / 6.0;
    return vec3(
        0.14 * sin(tau),
        0.055 * (1.0 - cos(tau)),
        0.14 * (sin(tau + SAJU_PHASE_Z) - sin(SAJU_PHASE_Z))
    );
}

vec2 sajuAtlasTexelUV(vec3 integerGridIndex, bool flipV) {
    // gridIndex components are integer-valued floats in [0, 127].
    float tileX = mod(integerGridIndex.z, 16.0);
    float tileY = floor(integerGridIndex.z / 16.0);
    vec2 uv = (vec2(tileX, tileY) * 128.0 + integerGridIndex.xy + 0.5) / vec2(2048.0, 1024.0);
    if (flipV) uv.y = 1.0 - uv.y;
    return uv;
}

float sajuReadAtlasTexel(sampler2D atlas, vec3 integerGridIndex, bool flipV) {
    return SAJU_TEXTURE(atlas, sajuAtlasTexelUV(integerGridIndex, flipV)).r;
}

float sajuSampleScalarAtlas(sampler2D atlas, vec3 canonicalFieldPosition, bool flipV) {
    vec3 normalized = clamp((canonicalFieldPosition - SAJU_FIELD_MIN) / (SAJU_FIELD_MAX - SAJU_FIELD_MIN), 0.0, 1.0);
    vec3 grid = normalized * 127.0;
    vec3 lo = floor(grid);
    vec3 hi = min(lo + 1.0, vec3(127.0));
    vec3 f = grid - lo;
    // Eight center fetches: no cross-tile interpolation or float-linear extension.
    float z0 = mix(
        mix(sajuReadAtlasTexel(atlas, vec3(lo.x, lo.y, lo.z), flipV), sajuReadAtlasTexel(atlas, vec3(hi.x, lo.y, lo.z), flipV), f.x),
        mix(sajuReadAtlasTexel(atlas, vec3(lo.x, hi.y, lo.z), flipV), sajuReadAtlasTexel(atlas, vec3(hi.x, hi.y, lo.z), flipV), f.x), f.y);
    float z1 = mix(
        mix(sajuReadAtlasTexel(atlas, vec3(lo.x, lo.y, hi.z), flipV), sajuReadAtlasTexel(atlas, vec3(hi.x, lo.y, hi.z), flipV), f.x),
        mix(sajuReadAtlasTexel(atlas, vec3(lo.x, hi.y, hi.z), flipV), sajuReadAtlasTexel(atlas, vec3(hi.x, hi.y, hi.z), flipV), f.x), f.y);
    return mix(z0, z1, f.z);
}

struct SajuJadeFlow {
    float field;
    float emissionMask;
    float isolationMask;
    float reflectiveFraction;
    vec3 emissionRadiance;
};

SajuJadeFlow sajuEvaluateJadeFlow(sampler2D atlas, vec3 canonicalSourcePosition, float seconds, bool flipV) {
    SajuJadeFlow result;
    result.field = sajuSampleScalarAtlas(atlas, canonicalSourcePosition + sajuLoopOffset(seconds), flipV);
    result.emissionMask = clamp((result.field - 0.50) / (0.72 - 0.50), 0.0, 1.0);
    result.isolationMask = smoothstep(0.38, 0.66, result.field);
    result.reflectiveFraction = 1.0 - result.isolationMask;
    result.emissionRadiance = SAJU_EMISSION_RGB_LINEAR * 2.0 * result.emissionMask;
    return result;
}

/* originalJadeBRDF is the fully evaluated original non-emissive surface radiance
 * in LINEAR space, before tone mapping. It is NOT just the base-color texture.
 * The host must isolate every contributing jade lobe, including transmission,
 * clearcoat, specular and SSS where supported. Engine hook selection is external.
 */
vec3 sajuComposeLinear(vec3 originalJadeBRDF, SajuJadeFlow flow) {
    return originalJadeBRDF * flow.reflectiveFraction + flow.emissionRadiance;
}
#endif
