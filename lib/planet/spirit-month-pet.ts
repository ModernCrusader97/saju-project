import * as THREE from "three";
import type { GanziThemePreset } from "./theme-library";
import { createZodiacFeatures, ZODIAC_FEATURES, type ZodiacBranch } from "./spirit-zodiac";
import type { SpiritQuality } from "./spirit-geometry";

export interface MonthSpiritPet { group:THREE.Group; update:(time:number)=>void }

/** The month pillar is a small grounded companion, never an orbit or body blend.
 * Its stem supplies the shared element material; its branch supplies animal cues. */
export function createMonthSpiritPet(month:GanziThemePreset,material:THREE.Material,quality:SpiritQuality="high"):MonthSpiritPet {
  const low=quality==="low",group=new THREE.Group();group.name=`month-ground-pet:${month.key}`;
  group.userData.pillarRole="month-ground-pet";group.userData.stem=month.stem;group.userData.branch=month.branch;
  group.userData.animal=ZODIAC_FEATURES[month.branch as ZodiacBranch]?.animal ?? ZODIAC_FEATURES.자.animal;
  const sphere=(radius:number)=>new THREE.SphereGeometry(radius,low?14:22,low?10:16);
  const bodyGeo=sphere(1);bodyGeo.scale(.26,.23,.29);
  const body=new THREE.Mesh(bodyGeo,material);body.name="ground-pet-body";body.position.set(0,.285,0);group.add(body);
  const head=new THREE.Group();head.name="ground-pet-head";head.position.set(0,.51,.10);group.add(head);
  const headGeo=sphere(1);headGeo.scale(.20,.205,.177);
  const headMesh=new THREE.Mesh(headGeo,material);headMesh.name="ground-pet-element-head";head.add(headMesh);
  const features=createZodiacFeatures(month.branch,material,quality);features.scale.setScalar(.60);head.add(features);
  const eyeGeo=sphere(.022),eyeMat=new THREE.MeshBasicMaterial({color:0x15242b});
  for(const side of [-1,1]){
    const eye=new THREE.Mesh(eyeGeo,eyeMat);eye.scale.set(.8,1.15,.36);eye.position.set(side*.07,.022,.17);eye.name="ground-pet-eye";head.add(eye);
  }
  // Four low paws visibly share y=0 with the avatar's planted feet.
  const pawGeo=sphere(1);pawGeo.scale(.084,.068,.106);
  for(const x of [-.16,.16])for(const z of [-.15,.17]){
    const paw=new THREE.Mesh(pawGeo,material);paw.position.set(x,.069,z);paw.name="ground-pet-paw";group.add(paw);
  }
  const update=(time:number)=>{
    // Rigid head curiosity only. No y bob, root motion, orbit or body stretching.
    head.rotation.z=Math.sin(time*.72)*.026;head.rotation.y=Math.sin(time*.54)*.045;
  };
  update(0);return {group,update};
}
