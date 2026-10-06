/** Experimental graphic-jelly face study. No humanoid rig or frame-count timing. */
export type Expression = 'calm' | 'curious' | 'warm';
export interface Node {
  rotation: {z: number};
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
}
export interface GLTFLike { parser: { associations: Map<Node, {nodes?: number}> } }
export interface Binding { rootNode: number; faceNodes: number[] }
const finite = (v: number) => Number.isFinite(v);
export function createJellyController(gltf: GLTFLike, binding: Binding) {
  const byIndex = new Map<number, Node>();
  for (const [object, association] of gltf.parser.associations) {
    if (association.nodes !== undefined) byIndex.set(association.nodes, object);
  }
  const root = byIndex.get(binding.rootNode);
  if (!root) throw new Error('Missing exact JellyExpressionRoot node association');
  const faces = binding.faceNodes.map(index => {
    const node = byIndex.get(index);
    if (!node?.morphTargetDictionary || !node.morphTargetInfluences) throw new Error(`Missing face node ${index}`);
    for (const key of ['Curious', 'Warm', 'Blink']) {
      const i = node.morphTargetDictionary[key];
      if (!Number.isInteger(i) || i < 0 || i >= node.morphTargetInfluences.length) throw new Error(`Missing ${key} on node ${index}`);
    }
    return node;
  });
  const initialZ = root.rotation.z;
  let expression: Expression = 'calm';
  let blinkTime: number | null = null;
  function apply(blink: number) {
    for (const node of faces) {
      const d = node.morphTargetDictionary!, w = node.morphTargetInfluences!;
      w[d.Curious] = (expression === 'curious' ? 1 : 0) * (1-blink);
      w[d.Warm] = (expression === 'warm' ? 1 : 0) * (1-blink);
      w[d.Blink] = blink;
    }
    // Blender local Y -4 degrees exports as glTF local Z +4 degrees.
    root!.rotation.z = initialZ + (expression === 'curious' ? Math.PI/45 : 0);
  }
  return {
    setExpression(value: Expression) {
      if (!['calm','curious','warm'].includes(value)) throw new Error('Unknown expression');
      expression = value; blinkTime = null; apply(0);
    },
    blink() { blinkTime = 0; apply(0); },
    update(dtSeconds: number) {
      if (!finite(dtSeconds) || dtSeconds < 0) throw new Error('Delta must be finite and nonnegative');
      if (blinkTime === null) return;
      blinkTime += dtSeconds;
      if (blinkTime >= .18) { blinkTime = null; apply(0); return; }
      const t = blinkTime/.18;
      apply(Math.sin(Math.PI*t)**2);
    },
    reset() { expression = 'calm'; blinkTime = null; apply(0); },
    get isBlinking() { return blinkTime !== null; },
  };
}
