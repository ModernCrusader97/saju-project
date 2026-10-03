import * as THREE from "three";
import { getThemePreset, getSurfaceFamily, SIXTY_GANZI_KEYS } from "./theme-library";
import { createPlanetMaterial, animateSurface, resetSurface, setSurfaceReliefScale, setSurfaceBarkMix } from "./surface-material";
import { createAsteroidBeltParticles } from "./asteroid-belt";
import { disposeObject } from "./render-resources";
import { createSpiritGeometry, type SpiritQuality } from "./spirit-geometry";
import { hashSeed } from "./surface-math";
import { createSpiritCrownEffects, animateSurfaceEffects, disposeSurfaceEffects } from "./surface-effects";
import type { MaskStyle } from "./uv-mask";

export interface ElementalSpiritData {
  stem: string;
  element: "wood" | "fire" | "earth" | "metal" | "water";
  polarity: "yang" | "yin";
  name: string;
  speciesTitle: string;
  conceptDesc: string;
  personalityTraits: string[];
  primaryColor: string;
  secondaryColor: string;
  emissiveColor: string;
  roughness: number;
}

const PROFILES: Record<string, [ElementalSpiritData["element"], string, string, string, string[]]> = {
  갑: ["wood", "거목의 씨앗 · 트루티", "가지 사이에 숲을 품은 정령", "깊게 뿌리내린 씨앗에서 가지와 잎이 층층이 자라난 작은 숲.", ["우직함", "개척", "생명력"]],
  을: ["wood", "이끼 숲 · 플로라", "작은 틈에서 자라는 숲의 정령", "부드러운 이끼와 섬세한 잎사귀가 겹쳐 자라는 유연한 숲.", ["유연함", "친화력", "끈기"]],
  병: ["fire", "용암 불씨 · 솔라", "검은 돌 속에서 타오르는 정령", "검은 화산암 사이로 용암이 흐르고 작은 불꽃들이 피어오르는 불씨.", ["활력", "솔직함", "열정"]],
  정: ["fire", "작은 화산 · 루미", "잔잔한 열을 품은 불의 정령", "짙은 화산석 속에 따뜻한 빛을 간직하고 은은하게 타오르는 작은 불.", ["온기", "통찰", "섬세함"]],
  무: ["earth", "황금 사구 · 샌디", "모래와 지층으로 빚어진 정령", "거친 모래와 단단한 층들이 천천히 쌓여 태어난 둥근 대지의 조각.", ["신뢰", "포용", "뚝심"]],
  기: ["earth", "흙빛 도자 · 테라", "흙의 결을 품은 대지의 정령", "흙빛 도자와 작은 돌들이 포개진 차분하고 단단한 자연물.", ["다정함", "배려", "돌봄"]],
  경: ["metal", "티타늄 조각 · 아이언", "빛을 반사하는 금속의 정령", "차분한 티타늄 단층과 작은 금속 결정이 빛을 받아 다른 표정을 만드는 조각.", ["의리", "결단", "정직"]],
  신: ["metal", "수은 물방울 · 루나", "유려하게 맺힌 금속의 정령", "매끄러운 액체 금속 표면 위에 작은 은빛 방울들이 맺힌 정령.", ["정교함", "감각", "명료함"]],
  임: ["water", "큰 물결 · 아쿠아", "물결을 머금은 물의 정령", "깊은 물빛 방울의 양옆으로 작은 파도가 말려 올라가는 정령.", ["지혜", "자유", "유연함"]],
  계: ["water", "맑은 이슬 · 드롭", "빛을 담은 이슬의 정령", "잔잔한 물빛과 밝은 반사를 머금고 천천히 떠 있는 맑은 이슬.", ["공감", "다정함", "적응력"]],
};

/** Identity copy only. Every color and physical property comes from the common
 * 60-ganzi preset pipeline, also used by planets, moons and the year belt. */
export const TEN_STEM_SPIRITS: Record<string, ElementalSpiritData> = Object.fromEntries(
  Object.entries(PROFILES).map(([stem, [element,name,speciesTitle,conceptDesc,personalityTraits]], index) => {
    const key=SIXTY_GANZI_KEYS.find(item=>item.stem===stem)!.key;
    const preset=getThemePreset(key);
    return [stem,{stem,element,polarity:index%2===0?"yang":"yin",name,speciesTitle,conceptDesc,personalityTraits,
      primaryColor:preset.surface.primaryColor,secondaryColor:preset.surface.secondaryColor,
      emissiveColor:preset.surface.emissive ?? "#000000",roughness:preset.surface.roughness}];
  }),
);

export interface ElementalSpiritOptions {
  yearKey?: string;
  isUnknownTime?: boolean;
  maskStyle?: MaskStyle;
  quality?: SpiritQuality;
}
export interface ElementalSpiritInstance {
  group: THREE.Group;
  data: ElementalSpiritData;
  bodyMesh: THREE.Mesh;
  eyeLeft: THREE.Mesh;
  eyeRight: THREE.Mesh;
  propGroup: THREE.Group;
  petPivot?: THREE.Group;
  yearBelt?: THREE.Points;
  update: (time: number, deltaSeconds?: number) => void;
  triggerReaction: () => void;
  /** Backward-compatible interaction alias; no anatomy-stretching deformation. */
  triggerSquish: () => void;
  reset: () => void;
  dispose: () => void;
}

export function createElementalSpirit(
  dayKey="갑자", monthKey="병인", hourKey?:string, options:ElementalSpiritOptions={},
):ElementalSpiritInstance {
  const day=getThemePreset(dayKey), month=getThemePreset(monthKey);
  const family=getSurfaceFamily(day), quality=options.quality ?? "high", low=quality==="low";
  const data={...TEN_STEM_SPIRITS[day.stem],primaryColor:day.surface.primaryColor,secondaryColor:day.surface.secondaryColor,
    emissiveColor:day.surface.emissive ?? "#000000",roughness:day.surface.roughness};
  const group=new THREE.Group();group.name=`saju-spirit:${day.key}`;
  const floatGroup=new THREE.Group();group.add(floatGroup);
  const materials:THREE.Material[]=[];
  const material=createPlanetMaterial(day,month,options.maskStyle ?? "pangaea",low?256:384);
  // Preserve sculpted silhouettes and small facial marks. Procedural albedo and
  // micro-normal flow remain active; sphere radial displacement is not suitable
  // for the droplet lathe, trunk or miniature crown pieces.
  setSurfaceReliefScale(material,0);
  if(family==="forest")setSurfaceBarkMix(material,1);
  materials.push(material);
  const accent=createPlanetMaterial(day,undefined,"pangaea",128);
  setSurfaceReliefScale(accent,0);
  materials.push(accent);
  const form=createSpiritGeometry(day,material,accent,quality);
  floatGroup.add(form.group);
  const crownEffects=createSpiritCrownEffects(day,.72);
  floatGroup.add(crownEffects);

  // Two restrained marks, attached to the natural object itself. No human face,
  // sclera, lips, cheeks or limb anatomy; the silhouette does the storytelling.
  const face=new THREE.Group();face.name="simple-eye-marks";form.group.add(face);
  const eyeGeo=new THREE.SphereGeometry(.035,12,8);eyeGeo.scale(.78,1.3,.36);
  const eyeMat=new THREE.MeshBasicMaterial({color:0x071518});
  const eyeLeft=new THREE.Mesh(eyeGeo,eyeMat),eyeRight=new THREE.Mesh(eyeGeo,eyeMat);
  const eyeY=family==="forest"?.02:.07;
  eyeLeft.position.set(-.115,eyeY,form.faceDepth+.019);
  eyeRight.position.set(.115,eyeY,form.faceDepth+.019);
  face.add(eyeLeft,eyeRight);
  const glintGeo=new THREE.SphereGeometry(.007,6,4);
  const glintMat=new THREE.MeshBasicMaterial({color:0xf5f3e8});
  for(const eye of [eyeLeft,eyeRight]) {
    const glint=new THREE.Mesh(glintGeo,glintMat);glint.position.set(-.006,.012,.013);eye.add(glint);
  }

  // SLOT-H is a separate miniature natural object, always using its own pillar.
  let petPivot:THREE.Group|undefined;
  let petMesh:THREE.Mesh|undefined;
  if(hourKey && !options.isUnknownTime) {
    const hour=getThemePreset(hourKey);
    const petMaterial=createPlanetMaterial(hour,undefined,"pangaea",128);
    setSurfaceReliefScale(petMaterial,.18);materials.push(petMaterial);
    petPivot=new THREE.Group();petPivot.name=`hour-companion:${hour.key}`;group.add(petPivot);
    petMesh=new THREE.Mesh(new THREE.SphereGeometry(.145,low?20:28,low?14:20),petMaterial);
    petMesh.position.set(1.18,.22,0);petPivot.add(petMesh);
  }

  // SLOT-Y stays a single detached, fine-particle belt. No season/atmosphere shell.
  let yearBelt:THREE.Points|undefined;
  if(options.yearKey) {
    const belt=createAsteroidBeltParticles(getThemePreset(options.yearKey),.47,low?220:400);
    yearBelt=belt.points;yearBelt.name=`year-belt:${options.yearKey}`;
    yearBelt.position.y=-.65;yearBelt.rotation.set(.16,0,.09);
    belt.material.opacity=.52;belt.material.size=.018;
    group.add(yearBelt);
  }

  let currentTime=0, reactionStart=-100, disposed=false;
  const phase=hashSeed(day.key)%1000/1000*Math.PI*2;
  const update=(time:number,deltaSeconds?:number)=>{
    if(disposed || !Number.isFinite(time)) return;
    const t=Math.max(0,time), dt=Math.max(0,Math.min(.05,deltaSeconds ?? t-currentTime));
    currentTime=t;
    for(const mat of materials) animateSurface(mat,dt);
    form.update(t);
    animateSurfaceEffects(crownEffects,t,dt);
    const elapsed=Math.max(0,t-reactionStart);
    const reaction=elapsed<1.4?Math.sin(elapsed*8)*Math.exp(-elapsed*3.8):0;
    // Breath is a tiny rigid lift and lean, never random squash/stretch.
    floatGroup.position.y=Math.sin(t*1.15+phase)*.027+reaction*.045;
    floatGroup.rotation.z=Math.sin(t*.63+phase)*.018+reaction*.035;
    floatGroup.rotation.y=Math.sin(t*.39)*.055;
    const blinkPhase=(t+phase*.2)%5.2;
    const blink=blinkPhase>4.96?1-Math.sin((blinkPhase-4.96)/.24*Math.PI)*.85:1;
    eyeLeft.scale.y=eyeRight.scale.y=blink;
    if(petPivot) petPivot.rotation.y=t*.27;
    if(petMesh) {petMesh.position.y=.22+Math.sin(t*1.25+1)*.05;petMesh.rotation.y=t*.18;}
    if(yearBelt) yearBelt.rotation.y=t*.038;
  };
  const triggerReaction=()=>{reactionStart=currentTime;};
  const reset=()=>{
    currentTime=0;reactionStart=-100;
    for(const mat of materials) resetSurface(mat);
    group.rotation.set(0,0,0);update(0,0);
  };
  const dispose=()=>{
    if(disposed)return;disposed=true;
    disposeSurfaceEffects(crownEffects);
    group.traverse(object=>{if((object as THREE.InstancedMesh).isInstancedMesh)(object as THREE.InstancedMesh).dispose();});
    disposeObject(group);group.removeFromParent();group.clear();
  };
  reset();
  return {group,data,bodyMesh:form.bodyMesh,eyeLeft,eyeRight,propGroup:form.crown,petPivot,yearBelt,
    update,triggerReaction,triggerSquish:triggerReaction,reset,dispose};
}
