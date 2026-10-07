import * as THREE from "three";
import { TEN_STEM_SPIRITS, getSpiritStemPreset, type ElementalSpiritData } from "./spirit-profiles";
import { getThemePreset, getSurfaceFamily } from "./theme-library";
import { createPlanetMaterial, animateSurface, resetSurface, setSurfaceReliefScale, setSurfaceBarkMix } from "./surface-material";
import { ZODIAC_FEATURES, type ZodiacBranch } from "./spirit-profiles";
import { createZodiacPet } from "./spirit-zodiac-pet";
import { disposeObject } from "./render-resources";
import { createSpiritGeometry, type SpiritQuality } from "./spirit-geometry";
import { createSpiritCrownEffects, animateSurfaceEffects, disposeSurfaceEffects } from "./surface-effects";
import type { MaskStyle } from "./uv-mask";

export { TEN_STEM_SPIRITS, getSpiritStemPreset } from "./spirit-profiles";
export type { ElementalSpiritData } from "./spirit-profiles";

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
  avatarPivot: THREE.Group;
  eyeLeft: THREE.Mesh;
  eyeRight: THREE.Mesh;
  propGroup: THREE.Group;
  /** Deprecated alias for the day-branch animal. It never orbits. */
  petPivot?: THREE.Group;
  zodiacPet: THREE.Group;
  /** Deprecated compatibility alias. This is the same day-branch animal. */
  monthPet: THREE.Group;
  mapping: {bodyStem:string;bodyBranch:string;petBranch:string;backgroundStem:string;backgroundBranch:string};
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
  group.userData.pillarRoles={body:"day-stem",pet:"day-branch",background:"month-pillar"};
  const materials:THREE.Material[]=[];
  const material=createPlanetMaterial(day,undefined,"pangaea",128);
  setSurfaceReliefScale(material,0);
  if(family==="forest")setSurfaceBarkMix(material,1);
  materials.push(material);
  const accent=createPlanetMaterial(day,undefined,"pangaea",128);
  setSurfaceReliefScale(accent,0);materials.push(accent);
  const form=createSpiritGeometry(day,material,accent,quality);
  form.group.position.x=-.42;group.add(form.group);
  const crownEffects=createSpiritCrownEffects(day,.34);form.head.add(crownEffects);

  const pet=createZodiacPet(dayPillar.branch,quality);
  pet.group.position.set(1.10,0,.12);group.add(pet.group);
  const groundGeometry=new THREE.CircleGeometry(1.30,quality==="low"?40:64);
  groundGeometry.scale(1,.52,1);groundGeometry.rotateX(-Math.PI/2);
  const groundMaterial=new THREE.MeshStandardMaterial({color:0x718087,roughness:1,transparent:true,opacity:.16,depthWrite:false});
  const ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.name="shared-ground-plane";ground.position.set(.15,-.004,.08);group.add(ground);
  const mapping={bodyStem:day.stem,bodyBranch:dayPillar.branch,petBranch:dayPillar.branch,backgroundStem:month.stem,backgroundBranch:monthPillar.branch};
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
  const reset=()=>{currentTime=0;reactionStart=-100;for(const mat of materials)resetSurface(mat);group.rotation.set(0,0,0);form.group.rotation.set(0,0,0);update(0,0);};
  const dispose=()=>{
    if(disposed)return;disposed=true;disposeSurfaceEffects(crownEffects);
    group.traverse(object=>{if((object as THREE.InstancedMesh).isInstancedMesh)(object as THREE.InstancedMesh).dispose();});
    disposeObject(group);group.removeFromParent();group.clear();
  };
  reset();
  return {group,data,avatarPivot:form.group,bodyMesh:form.bodyMesh,eyeLeft:form.eyeLeft,eyeRight:form.eyeRight,propGroup:form.crown,
    petPivot:pet.group,zodiacPet:pet.group,monthPet:pet.group,mapping,yearBelt:undefined,
    update,triggerReaction,triggerSquish:triggerReaction,reset,dispose};
}
