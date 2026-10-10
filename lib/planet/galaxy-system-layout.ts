import * as THREE from 'three';
import { MAX_LIVING_RADIAL_RELIEF } from './living-surface-shader';
import { asteroidBeltVisualRadius } from './asteroid-belt';
import { getSpiralArmPosition } from './spiral-galaxy';
import { hashSeed, seededRandom } from './surface-math';

export const GALAXY_OWNER_SCALE = 1.3;
export const GALAXY_FRIEND_SCALE = .88;
export const GALAXY_BELT_SCALE = .58;
export const GALAXY_MOON_DISTANCE = 2.2;
export const GALAXY_MOON_SCALE = .28;
export const GALAXY_VISUAL_GAP = .6;
const MARGIN = 1e-5, MAX_ARM_SHIFT = Math.PI / 4;

export function galaxySystemVisualRadius(scale: number, hasMoon: boolean): number {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Galaxy body scale must be finite and positive.');
  return Math.max(scale * (1 + MAX_LIVING_RADIAL_RELIEF), asteroidBeltVisualRadius(scale * GALAXY_BELT_SCALE),
    hasMoon ? scale * (GALAXY_MOON_DISTANCE + GALAXY_MOON_SCALE * (1 + MAX_LIVING_RADIAL_RELIEF)) : 0);
}

export type GalaxyRotationDirections = Readonly<{body: number; belt: number; moonOrbit: number; moonSpin: number}>;

/** Stable ID + independent component stream; never called from the frame loop. */
export function galaxyRotationDirection(personID: string, componentID: string): -1 | 1 {
  return seededRandom(hashSeed(`galaxy-direction:v1:${personID.length}:${personID}:${componentID}`))() < .5 ? -1 : 1;
}

export function galaxyRotationDirections(personID: string): GalaxyRotationDirections {
  return {body: galaxyRotationDirection(personID,'body-spin'), belt: galaxyRotationDirection(personID,'year-ring'),
    moonOrbit: galaxyRotationDirection(personID,'moon:hour:orbit'), moonSpin: galaxyRotationDirection(personID,'moon:hour:spin')};
}

interface Placement {
  isOwner: boolean;
  armIndex: number;
  baseRadius: number;
  baseAngle: number;
  worldPos: THREE.Vector3;
  verticalOffset: number;
  visualRadius: number;
}
interface Lane {radius: number; members: Placement[]}
const wrap = (angle: number) => Math.atan2(Math.sin(angle),Math.cos(angle));

/** Equal-radius systems keep a constant phase difference using the original
 * radius-based orbit speed. Different lanes have disjoint swept radial bounds.
 * The fixed owner is a reserved annulus. No per-frame collision displacement. */
export function spaceGalaxySystems<T extends Placement>(nodes: T[], gap: number): T[] {
  const owner = nodes.find(n=>n.isOwner), lanes: Lane[] = [];
  const clearance = Math.max(GALAXY_VISUAL_GAP,gap);
  function radialSafe(radius: number, node: T, selected?: Lane): boolean {
    if(owner && Math.abs(radius-owner.baseRadius) < owner.visualRadius+node.visualRadius+clearance+MARGIN) return false;
    return lanes.every(lane=>lane===selected || lane.members.every(other=>
      Math.abs(radius-lane.radius) >= node.visualRadius+other.visualRadius+clearance+MARGIN));
  }
  function angleFor(lane: Lane,node: T): number | undefined {
    if(!radialSafe(lane.radius,node,lane))return;
    const preferred = getSpiralArmPosition(node.armIndex,lane.radius,node.baseAngle,0),
      angle = Math.atan2(preferred.z,preferred.x), offsets = [0];
    for(const other of lane.members){
      const ratio=(node.visualRadius+other.visualRadius+clearance+MARGIN)/(2*lane.radius);
      if(ratio>=1)return;
      const delta=wrap(Math.atan2(other.worldPos.z,other.worldPos.x)-angle), separation=2*Math.asin(ratio);
      offsets.push(wrap(delta-separation-MARGIN),wrap(delta+separation+MARGIN));
    }
    offsets.sort((a,b)=>Math.abs(a)-Math.abs(b)||a-b);
    for(const offset of offsets){
      if(Math.abs(offset)>MAX_ARM_SHIFT)continue;
      const x=Math.cos(angle+offset)*lane.radius,z=Math.sin(angle+offset)*lane.radius;
      if(lane.members.every(other=>Math.hypot(x-other.worldPos.x,z-other.worldPos.z) >=
        node.visualRadius+other.visualRadius+clearance+MARGIN*.5))return node.baseAngle+offset;
    }
  }
  for(const node of nodes){
    if(node.isOwner)continue;
    const preferredRadius=node.baseRadius;
    let selected: Lane | undefined, angle: number | undefined;
    // Keep affinity's arm and nearest feasible existing lane before opening a
    // new one. Previously placed systems are never moved by an appended arrival.
    for(const lane of [...lanes].sort((a,b)=>Math.abs(a.radius-preferredRadius)-Math.abs(b.radius-preferredRadius))){
      const candidate=angleFor(lane,node);if(candidate!==undefined){selected=lane;angle=candidate;break;}
    }
    if(!selected){
      // The extra margin absorbs sum/subtraction roundoff at the owner's
      // boundary while keeping the strict radial safety predicate unchanged.
      const minimum=owner?owner.baseRadius+owner.visualRadius+node.visualRadius+clearance+MARGIN*2:node.visualRadius+clearance;
      const candidates=[Math.max(minimum,preferredRadius)];
      for(const lane of lanes){
        const other=Math.max(...lane.members.map(n=>n.visualRadius)),width=other+node.visualRadius+clearance+MARGIN;
        candidates.push(lane.radius-width-MARGIN,lane.radius+width+MARGIN);
      }
      const radius=candidates.filter(r=>r>=minimum&&radialSafe(r,node)).sort((a,b)=>Math.abs(a-preferredRadius)-Math.abs(b-preferredRadius)||a-b)[0];
      if(radius===undefined)throw new Error('No finite galaxy orbit lane could be placed.');
      selected={radius,members:[]};lanes.push(selected);angle=node.baseAngle;
    }
    node.baseRadius=selected.radius;node.baseAngle=angle!;
    node.worldPos.copy(getSpiralArmPosition(node.armIndex,node.baseRadius,node.baseAngle,node.verticalOffset));
    selected.members.push(node);
  }
  return nodes;
}
