/* SaJu jade evolving-light v002. Include after highp float precision declaration.
 * ES 1.00 default; ES 3.00 callers define SAJU_TEXTURE texture before inclusion.
 * RGBA8_UNORM, linear/non-color, NEAREST, CLAMP_TO_EDGE, no mipmaps.
 * RGB are three independent native FBM fields baked at FIXED positions.
 * Use highp float and highp sampler2D. Runtime positions and jade UVs never animate.
 */
#ifndef SAJU_JADE_EVOLUTION_GLSL
#define SAJU_JADE_EVOLUTION_GLSL
#ifdef GL_ES
precision highp sampler2D;
#endif
#ifndef SAJU_TEXTURE
#define SAJU_TEXTURE texture2D
#endif
const vec3 SAJU_EMISSION_RGB_LINEAR=vec3(0.001,0.65,0.08);
/* Valid only for the unchanged v001 body export. Input is undeformed mesh-local POSITION. */
vec3 sajuV001BodyGLTFLocalToGenerated(vec3 gltfLocalPosition){
    vec3 blenderPosition=vec3(gltfLocalPosition.x,-gltfLocalPosition.z,gltfLocalPosition.y);
    vec3 center=vec3(0.000006973743438720703,-0.000013902783393859863,1.1804927587509155);
    vec3 halfSize=vec3(0.877256453037262,0.4755038022994995,1.1923989057540894);
    return vec3(0.5)+(blenderPosition-center)/(2.0*halfSize);
}
/* Upload CPU-wrapped time in [0,6). Trigonometry controls weights, not coordinates. */
vec3 sajuEvolutionWeights(float seconds){
    float phase=mod(seconds,6.0)/2.0;
    float segment=floor(phase),u=fract(phase);
    float theta=1.5707963267948966*u*u*(3.0-2.0*u);
    float a=cos(theta),b=sin(theta);
    if(segment<0.5)return vec3(a,b,0.0);
    if(segment<1.5)return vec3(0.0,a,b);
    return vec3(b,0.0,a);
}
vec2 sajuAtlasTexelUV(vec3 integerGridIndex,bool flipV){
    vec2 tile=vec2(mod(integerGridIndex.z,16.0),floor(integerGridIndex.z/16.0));
    vec2 uv=(tile*128.0+integerGridIndex.xy+0.5)/vec2(2048.0,1024.0);
    if(flipV)uv.y=1.0-uv.y;return uv;
}
vec3 sajuReadAtlasTexel(sampler2D atlas,vec3 integerGridIndex,bool flipV){
    return SAJU_TEXTURE(atlas,sajuAtlasTexelUV(integerGridIndex,flipV)).rgb;
}
vec3 sajuSampleFieldsAtlas(sampler2D atlas,vec3 canonicalSourcePosition,bool flipV){
    vec3 grid=clamp(canonicalSourcePosition,0.0,1.0)*127.0;
    vec3 lo=floor(grid),hi=min(lo+1.0,vec3(127.0)),f=grid-lo;
    // Eight RGB center fetches. No cross-tile hardware interpolation or float extension.
    vec3 z0=mix(
        mix(sajuReadAtlasTexel(atlas,vec3(lo.x,lo.y,lo.z),flipV),sajuReadAtlasTexel(atlas,vec3(hi.x,lo.y,lo.z),flipV),f.x),
        mix(sajuReadAtlasTexel(atlas,vec3(lo.x,hi.y,lo.z),flipV),sajuReadAtlasTexel(atlas,vec3(hi.x,hi.y,lo.z),flipV),f.x),f.y);
    vec3 z1=mix(
        mix(sajuReadAtlasTexel(atlas,vec3(lo.x,lo.y,hi.z),flipV),sajuReadAtlasTexel(atlas,vec3(hi.x,lo.y,hi.z),flipV),f.x),
        mix(sajuReadAtlasTexel(atlas,vec3(lo.x,hi.y,hi.z),flipV),sajuReadAtlasTexel(atlas,vec3(hi.x,hi.y,hi.z),flipV),f.x),f.y);
    return mix(z0,z1,f.z);
}
float sajuBlendFields(vec3 fields,float seconds){return clamp(0.5+dot(sajuEvolutionWeights(seconds),fields-vec3(0.5)),0.0,1.0);}
struct SajuJadeEvolution{
    vec3 fields;
    float field;
    float emissionMask;
    float isolationMask;
    float reflectiveFraction;
    vec3 emissionRadiance;
};
SajuJadeEvolution sajuEvaluateJadeEvolution(sampler2D atlas,vec3 canonicalSourcePosition,float seconds,bool flipV){
    SajuJadeEvolution result;
    result.fields=sajuSampleFieldsAtlas(atlas, canonicalSourcePosition, flipV);
    result.field=sajuBlendFields(result.fields,seconds);
    result.emissionMask=clamp((result.field-0.50)/0.22,0.0,1.0);
    result.isolationMask=smoothstep(0.38,0.66,result.field);
    result.reflectiveFraction=1.0-result.isolationMask;
    result.emissionRadiance=SAJU_EMISSION_RGB_LINEAR*2.0*result.emissionMask;
    return result;
}
/* originalJadeBRDF = complete original non-emissive linear surface radiance,
 * including all reflection/transmission/coat/SSS lobes the host supports.
 * Apply before tone mapping. Do not alter exposure or bloom.
 */
vec3 sajuComposeLinear(vec3 originalJadeBRDF,SajuJadeEvolution evolution){return originalJadeBRDF*evolution.reflectiveFraction+evolution.emissionRadiance;}
#endif
