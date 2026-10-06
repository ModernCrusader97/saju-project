import * as THREE from "three";

/** Shared by the day-branch avatar and the month-branch miniature companion. */
export const ZODIAC_FEATURES = {
  자: { branch: "자", animal: "rat", label: "쥐", silhouette: "round-ears" },
  축: { branch: "축", animal: "ox", label: "소", silhouette: "outward-horns" },
  인: { branch: "인", animal: "tiger", label: "호랑이", silhouette: "rounded-ears-and-stripes" },
  묘: { branch: "묘", animal: "rabbit", label: "토끼", silhouette: "long-ears" },
  진: { branch: "진", animal: "dragon", label: "용", silhouette: "forked-horns" },
  사: { branch: "사", animal: "snake", label: "뱀", silhouette: "scaled-crown" },
  오: { branch: "오", animal: "horse", label: "말", silhouette: "leaf-ears-and-mane" },
  미: { branch: "미", animal: "sheep", label: "양", silhouette: "curled-horns" },
  신: { branch: "신", animal: "monkey", label: "원숭이", silhouette: "cupped-ears" },
  유: { branch: "유", animal: "rooster", label: "닭", silhouette: "scalloped-crest" },
  술: { branch: "술", animal: "dog", label: "개", silhouette: "floppy-ears" },
  해: { branch: "해", animal: "pig", label: "돼지", silhouette: "pointed-ears" },
} as const;

export type ZodiacBranch = keyof typeof ZODIAC_FEATURES;
type Point = readonly [number, number, number];

/**
 * Original elemental animal accents, in head-local coordinates. The reference
 * head has radii (.32, .40, .24), with its face toward +Z. Scale the whole group
 * with the head for a pet; geometry and identity remain identical at either size.
 *
 * The group owns its geometries only. Its material is borrowed, never cloned,
 * changed, or disposed here. Dispose a complete avatar once, or dispose only the
 * geometries when removing features independently from their material's owner.
 * No textures, randomness, animation callbacks, or tail-mount assumptions.
 */
export function createZodiacFeatures(
  branch: string,
  material: THREE.Material,
  quality: "low" | "high" = "high",
): THREE.Group {
  const resolved: ZodiacBranch = Object.prototype.hasOwnProperty.call(ZODIAC_FEATURES, branch)
    ? branch as ZodiacBranch : "자";
  const info = ZODIAC_FEATURES[resolved];
  const group = new THREE.Group();
  group.name = `zodiac-features:${info.animal}`;
  group.userData = { branch: resolved, animal: info.animal, quality, materialOwned: false };
  const low = quality === "low";

  function add(name: string, geometry: THREE.BufferGeometry, position: Point = [0, 0, 0], lean = 0) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.z = lean;
    group.add(mesh);
    return mesh;
  }

  function oval(name: string, position: Point, radii: Point, lean = 0) {
    const geometry = new THREE.SphereGeometry(1, low ? 10 : 14, low ? 6 : 9);
    geometry.scale(...radii);
    return add(name, geometry, position, lean);
  }

  function leaf(name: string, position: Point, radii: Point, lean = 0) {
    const geometry = new THREE.SphereGeometry(1, low ? 8 : 12, low ? 8 : 10);
    const vertices = geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const y = vertices.getY(i);
      // Narrow upper shoulders create a pointed leaf/ear rather than a capsule.
      const taper = 1 - Math.max(0, y) * .68;
      vertices.setXYZ(i, vertices.getX(i) * radii[0] * taper,
        y * radii[1], vertices.getZ(i) * radii[2] * taper);
    }
    geometry.computeVertexNormals();
    return add(name, geometry, position, lean);
  }

  function horn(name: string, points: readonly Point[], radius: number, tipRadius = .002) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, "centripetal");
    const segments = low ? 12 : 18, sides = low ? 6 : 8;
    const geometry = new THREE.TubeGeometry(curve, segments, 1, sides, false);
    const vertices = geometry.getAttribute("position");
    const point = new THREE.Vector3();
    for (let row = 0; row <= segments; row++) {
      const u = row / segments;
      curve.getPointAt(u, point);
      const width = radius * Math.pow(1 - u, .72) + tipRadius * u;
      for (let side = 0; side <= sides; side++) {
        const i = row * (sides + 1) + side;
        vertices.setXYZ(i, point.x + (vertices.getX(i) - point.x) * width,
          point.y + (vertices.getY(i) - point.y) * width,
          point.z + (vertices.getZ(i) - point.z) * width);
      }
    }
    geometry.computeVertexNormals();
    return add(name, geometry);
  }

  switch (resolved) {
    case "자":
      for (const side of [-1, 1]) {
        oval("rat-round-ear", [side * .265, .405, -.025], [.155, .165, .067], -side * .15);
      }
      break;
    case "축":
      for (const side of [-1, 1]) {
        oval("ox-low-ear", [side * .315, .285, -.02], [.125, .051, .056], side * .15);
        horn("ox-outward-horn", [
          [side * .205, .325, -.045], [side * .385, .4, -.055],
          [side * .505, .515, -.065], [side * .51, .64, -.04],
        ], .073);
      }
      break;
    case "인":
      for (const side of [-1, 1]) {
        oval("tiger-rounded-ear", [side * .245, .375, -.015], [.113, .13, .067], -side * .23);
        // Raised elemental bands, never a separate fur color or a facial decal.
        for (let i = 0; i < 3; i++) {
          oval("tiger-temple-stripe", [side * (.264 + i * .024), .3 - i * .069, .105],
            [.063 - i * .007, .016, .025], -side * .56);
        }
      }
      break;
    case "묘":
      for (const side of [-1, 1]) {
        leaf("rabbit-long-ear", [side * .16, .59, -.025], [.09, .315, .049], -side * .13);
      }
      break;
    case "진":
      for (const side of [-1, 1]) {
        horn("dragon-main-horn", [
          [side * .18, .31, -.065], [side * .24, .49, -.09],
          [side * .31, .665, -.12], [side * .28, .79, -.13],
        ], .056);
        horn("dragon-horn-fork", [
          [side * .248, .515, -.095], [side * .385, .59, -.1],
          [side * .445, .715, -.12],
        ], .035);
        leaf("dragon-swept-ear", [side * .305, .295, -.11], [.064, .147, .041], -side * .9);
      }
      break;
    case "사":
      // An overlapping, upright scale crown; all three plates share the element.
      for (let i = -1; i <= 1; i++) {
        leaf("snake-crown-scale", [i * .13, i === 0 ? .49 : .4, -.045 - Math.abs(i) * .035],
          [i === 0 ? .115 : .095, i === 0 ? .24 : .18, .045], -i * .4);
      }
      break;
    case "오":
      for (const side of [-1, 1]) {
        leaf("horse-upright-ear", [side * .195, .48, -.045], [.086, .225, .053], -side * .2);
      }
      for (let i = 0; i < 3; i++) {
        leaf("horse-rear-mane", [0, .43 - i * .16, -.17 - i * .045],
          [.063, .16, .087], -.17 + i * .07);
      }
      break;
    case "미":
      for (const side of [-1, 1]) {
        // Open descending curls remain legible at pet scale, with a hollow center.
        horn("sheep-curled-horn", [
          [side * .235, .31, -.045], [side * .385, .425, -.06],
          [side * .505, .32, -.07], [side * .49, .13, -.035],
          [side * .365, .105, .005], [side * .35, .23, .015],
        ], .081, .022);
        oval("sheep-small-ear", [side * .31, .23, -.095], [.108, .047, .047], -side * .28);
      }
      break;
    case "신":
      for (const side of [-1, 1]) {
        // Closed lathed bowl: a shallow recess reads as a cupped ear even with
        // one opaque material, without DoubleSide or a second lining material.
        const profile = [[0, -.035], [.07, -.032], [.13, -.014], [.152, .018],
          [.15, .043], [.128, .057], [.075, .02], [0, .011]];
        const geometry = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), low ? 12 : 18);
        geometry.rotateX(Math.PI / 2);
        geometry.scale(1, 1.04, 1);
        add("monkey-cupped-ear", geometry, [side * .34, .17, -.04]);
      }
      break;
    case "유":
      // Three lobes sweep backward in depth, with a readable front-view comb.
      for (let i = 0; i < 3; i++) {
        oval("rooster-crest-lobe", [(i - 1) * .102, .46 + (i === 1 ? .095 : 0), -.055 - i * .045],
          [.086, .165 + (i === 1 ? .018 : 0), .051], (i - 1) * -.24);
      }
      break;
    case "술":
      for (const side of [-1, 1]) {
        oval("dog-floppy-ear", [side * .345, .105, -.03], [.099, .3, .064], side * .19);
        oval("dog-ear-fold", [side * .305, .33, -.035], [.09, .091, .065], side * .25);
      }
      break;
    case "해":
      for (const side of [-1, 1]) {
        leaf("pig-pointed-ear", [side * .228, .367, -.035], [.135, .185, .062], -side * .55);
      }
      break;
  }
  return group;
}
