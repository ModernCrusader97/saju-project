import * as THREE from "three";
import { getThemePreset, getSurfaceFamily, SIXTY_GANZI_KEYS } from "./theme-library";
import { createPlanetMaterial, animateSurface, resetSurface, setSurfaceReliefScale, setSurfaceBarkMix } from "./surface-material";
import { createZodiacFeatures, ZODIAC_FEATURES, type ZodiacBranch } from "./spirit-zodiac";
import { createMonthSpiritPet } from "./spirit-month-pet";
import { disposeObject } from "./render-resources";
import { createSpiritGeometry, type SpiritQuality } from "./spirit-geometry";
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
  갑: ["wood", "갑목 · 숲의 분신", "곧게 자라는 숲의 기운", "단단한 수피와 층층이 자란 잎을 두른 원소 분신.", ["우직함", "개척", "생명력"]],
  을: ["wood", "을목 · 초록의 분신", "유연하게 뻗는 가지의 기운", "섬세한 가지와 부드러운 숲의 결을 지닌 원소 분신.", ["유연함", "친화력", "끈기"]],
  병: ["fire", "병화 · 불의 분신", "환하게 타오르는 불의 기운", "움직이는 용암의 빛과 위로 피어나는 불꽃을 지닌 원소 분신.", ["활력", "솔직함", "열정"]],
  정: ["fire", "정화 · 온기의 분신", "깊고 은은한 불의 기운", "따뜻한 빛을 간직하고 차분하게 타오르는 원소 분신.", ["온기", "통찰", "섬세함"]],
  무: ["earth", "무토 · 대지의 분신", "단단하게 받쳐 주는 대지의 기운", "모래와 지층의 결을 입고 안정감 있게 선 원소 분신.", ["신뢰", "포용", "뚝심"]],
  기: ["earth", "기토 · 흙의 분신", "생명을 품는 흙의 기운", "흙빛 도자와 고운 토양의 결을 지닌 원소 분신.", ["다정함", "배려", "돌봄"]],
  경: ["metal", "경금 · 강철의 분신", "곧고 선명한 금속의 기운", "티타늄 단층이 빛을 반사하는 견고한 원소 분신.", ["의리", "결단", "정직"]],
  신: ["metal", "신금 · 은빛의 분신", "정교하게 빛나는 금속의 기운", "유려한 액체 금속의 결을 지닌 세련된 원소 분신.", ["정교함", "감각", "명료함"]],
  임: ["water", "임수 · 물결의 분신", "크고 자유로운 물의 기운", "깊은 물빛과 흐르는 파도의 몸짓을 지닌 원소 분신.", ["지혜", "자유", "유연함"]],
  계: ["water", "계수 · 이슬의 분신", "맑고 섬세한 물의 기운", "잔잔한 물결과 밝은 반사를 지닌 원소 분신.", ["공감", "다정함", "적응력"]],
};

/** Spirit materials are stem-only. The branch changes animal features, not the
 * body material seed/properties; planet presets and their four-pillar rules stay intact. */
export function getSpiritStemPreset(stemOrKey:string) {
  const stem=stemOrKey.charAt(0);
  return getThemePreset(SIXTY_GANZI_KEYS.find(item=>item.stem===stem)?.key ?? "갑자");
}

/** Identity copy only. Every color and physical property comes from the common
 * shared preset/material pipeline. Spirit pillar roles are separate from planets. */
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
  /** Legacy canvas compatibility only; no year object in spirit mode. */
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
  /** Deprecated alias for the grounded month pet. It never orbits. */
  petPivot?: THREE.Group;
  monthPet: THREE.Group;
  mapping: {bodyStem:string;bodyBranch:string;petStem:string;petBranch:string};
  yearBelt?: THREE.Points;
  update: (time: number, deltaSeconds?: number) => void;
  triggerReaction: () => void;
  /** Backward-compatible interaction alias; no anatomy-stretching deformation. */
  triggerSquish: () => void;
  reset: () => void;
  dispose: () => void;
}

export function createElementalSpirit(
  dayKey="갑자", monthKey="병인", _hourKey?:string, options:ElementalSpiritOptions={},
):ElementalSpiritInstance {
  const dayPillar=getThemePreset(dayKey),monthPillar=getThemePreset(monthKey);
  const day=getSpiritStemPreset(dayPillar.stem),month=getSpiritStemPreset(monthPillar.stem);
  const family=getSurfaceFamily(day),quality=options.quality ?? "high";
  const data={...TEN_STEM_SPIRITS[day.stem]};
  const group=new THREE.Group();group.name=`saju-avatar:${dayPillar.key}`;
  group.userData.pillarRoles={body:"day-stem",features:"day-branch",pet:"month-stem-and-branch"};
  const materials:THREE.Material[]=[];
  const material=createPlanetMaterial(day,undefined,"pangaea",128);
  setSurfaceReliefScale(material,0);
  if(family==="forest")setSurfaceBarkMix(material,1);
  materials.push(material);
  const accent=createPlanetMaterial(day,undefined,"pangaea",128);
  setSurfaceReliefScale(accent,0);materials.push(accent);
  const form=createSpiritGeometry(day,material,accent,quality);
  form.group.position.x=-.27;group.add(form.group);
  const zodiac=createZodiacFeatures(dayPillar.branch,accent,quality);
  zodiac.name=`day-branch-features:${dayPillar.branch}`;form.head.add(zodiac);
  const crownEffects=createSpiritCrownEffects(day,.34);form.head.add(crownEffects);

  const petMaterial=createPlanetMaterial(month,undefined,"pangaea",128);
  setSurfaceReliefScale(petMaterial,0);materials.push(petMaterial);
  // Material is month-stem-only; the resolved month branch reaches the feature factory.
  const pet=createMonthSpiritPet({...month, key:monthPillar.key, branch:monthPillar.branch},petMaterial,quality);
  pet.group.position.set(.90,0,.10);group.add(pet.group);
  const groundGeometry=new THREE.CircleGeometry(1.30,quality==="low"?40:64);
  groundGeometry.scale(1,.52,1);groundGeometry.rotateX(-Math.PI/2);
  const groundMaterial=new THREE.MeshStandardMaterial({color:0x718087,roughness:1,transparent:true,opacity:.16,depthWrite:false});
  const ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.name="shared-ground-plane";ground.position.set(.15,-.004,.08);group.add(ground);
  const mapping={bodyStem:day.stem,bodyBranch:dayPillar.branch,petStem:month.stem,petBranch:monthPillar.branch};
  group.userData.mapping=mapping;
  group.userData.animal=ZODIAC_FEATURES[dayPillar.branch as ZodiacBranch]?.animal;

  let currentTime=0,reactionStart=-100,disposed=false;
  const update=(time:number,deltaSeconds?:number)=>{
    if(disposed||!Number.isFinite(time))return;
    const t=Math.max(0,time),dt=Math.max(0,Math.min(.05,deltaSeconds??t-currentTime));currentTime=t;
    for(const mat of materials)animateSurface(mat,dt);
    const elapsed=Math.max(0,t-reactionStart),reaction=elapsed<1.4?Math.sin(elapsed*5)*Math.exp(-elapsed*2.7):0;
    form.update(t,reaction);pet.update(t);animateSurfaceEffects(crownEffects,t,dt);
  };
  const triggerReaction=()=>{reactionStart=currentTime;};
  const reset=()=>{currentTime=0;reactionStart=-100;for(const mat of materials)resetSurface(mat);group.rotation.set(0,0,0);update(0,0);};
  const dispose=()=>{
    if(disposed)return;disposed=true;disposeSurfaceEffects(crownEffects);
    group.traverse(object=>{if((object as THREE.InstancedMesh).isInstancedMesh)(object as THREE.InstancedMesh).dispose();});
    disposeObject(group);group.removeFromParent();group.clear();
  };
  reset();
  return {group,data,bodyMesh:form.bodyMesh,eyeLeft:form.eyeLeft,eyeRight:form.eyeRight,propGroup:form.crown,
    petPivot:pet.group,monthPet:pet.group,mapping,yearBelt:undefined,
    update,triggerReaction,triggerSquish:triggerReaction,reset,dispose};
}
