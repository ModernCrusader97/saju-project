import * as THREE from 'three';
import { ZODIAC_FEATURES, type ZodiacBranch } from './spirit-profiles';
import type { SpiritQuality } from './spirit-geometry';

export interface ZodiacPet { group: THREE.Group; update: (time: number) => void }
type Point = [number, number, number];

/** Temporary animal studies, not approved animal assets. The day branch chooses
 * anatomy; natural matte colors deliberately stay independent of elemental jade. */
export function createZodiacPet(branch: string, quality: SpiritQuality = 'high'): ZodiacPet {
  const resolved: ZodiacBranch = Object.hasOwn(ZODIAC_FEATURES, branch) ? branch as ZodiacBranch : '자';
  const info = ZODIAC_FEATURES[resolved], low = quality === 'low';
  const group = new THREE.Group(), rig = new THREE.Group(), head = new THREE.Group();
  group.name = `day-zodiac-pet:${info.animal}`;
  group.userData = { pillarRole: 'day-branch', branch: resolved, animal: info.animal, assetStatus: 'procedural-placeholder' };
  group.add(rig); rig.add(head); head.name = `${info.animal}-head`;
  const colors: Record<ZodiacBranch, [number, number, number]> = {
    자: [0x8d9498, 0xd9bbbd, 0xc5ccce], 축: [0x8e6650, 0xe4d6bc, 0x534335],
    인: [0xdca257, 0xeee1c8, 0x3d3831], 묘: [0xe7e5dc, 0xcdaeb1, 0xc8c3b6],
    진: [0x658b96, 0xd4cbb7, 0x486873], 사: [0x929b65, 0xd7d4ab, 0x67734b],
    오: [0xa17656, 0x483d35, 0xd8c4a9], 미: [0xe6dfca, 0xa18d74, 0xc7bea6],
    신: [0x9e7859, 0xddc6a3, 0x695440], 유: [0xe5d8b8, 0xb76558, 0x54747b],
    술: [0xc29e6c, 0xebe0c9, 0x826548], 해: [0xdab5b1, 0xc99390, 0x846e66],
  };
  const [coatColor, lightColor, accentColor] = colors[resolved];
  const material = (color: number, roughness = .84) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  const coat = material(coatColor), light = material(lightColor), accent = material(accentColor);
  const dark = material(0x303a37, .70), nose = material(0x655451), gold = material(0xc69c52);
  function oval(name: string, p: Point, radii: Point, mat = coat, parent: THREE.Object3D = rig, lean = 0) {
    const geometry = new THREE.SphereGeometry(1, low ? 12 : 18, low ? 8 : 12); geometry.scale(...radii);
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = `${info.animal}-${name}`;
    mesh.position.set(...p); mesh.rotation.z = lean; parent.add(mesh); return mesh;
  }
  function limb(name: string, a: Point, b: Point, radius: number, mat = coat, parent: THREE.Object3D = rig, tip = radius) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(tip, radius, delta.length(), low ? 8 : 12), mat);
    mesh.name = `${info.animal}-${name}`; mesh.position.copy(start.add(end).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(mesh);
  }
  function curve(name: string, points: Point[], radius: number, mat = coat, parent: THREE.Object3D = rig) {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), low ? 20 : 32, radius, low ? 6 : 8, false), mat);
    mesh.name = `${info.animal}-${name}`; parent.add(mesh);
  }
  function paws(hoof = false) {
    for (const x of [-.11, .11]) for (const z of [-.12, .15]) {
      if (hoof) limb('leg', [x, .07, z], [x, .25, z], .036);
      oval(hoof ? 'hoof' : 'paw', [x, .054, z], [.060, .054, .075], hoof ? accent : coat);
    }
  }
  function face(muzzle: Point = [.09, .065, .065], mat = light) {
    oval('muzzle', [0, -.055, .135], muzzle, mat, head);
    oval('nose', [0, -.015, .195], [.028, .022, .014], nose, head);
  }
  const quadruped = !['사', '진', '유'].includes(resolved);
  if (quadruped) {
    oval('body', [0, .255, -.01], [.165, .19, .235]);
    head.position.set(0, .49, .145); oval('head', [0, 0, 0], [.17, .165, .15], coat, head);
    paws(['축', '오', '해'].includes(resolved));
  }
  switch (resolved) {
    case '자':
      for (const s of [-1, 1]) { oval('round-ear', [s * .145, .13, -.015], [.105, .112, .038], coat, head); oval('ear-lining', [s * .145, .13, .018], [.075, .077, .009], light, head); }
      face([.09, .058, .10]); curve('long-tail', [[0, .14, -.20], [.14, .12, -.34], [.28, .12, -.30], [.29, .15, -.12]], .019, light);
      break;
    case '축':
      oval('broad-snout', [0, -.055, .14], [.125, .082, .07], light, head);
      for (const s of [-1, 1]) {
        oval('side-ear', [s * .20, .035, -.025], [.095, .04, .046], coat, head);
        curve('outward-horn', [[s * .13, .10, -.04], [s * .22, .17, -.05], [s * .26, .25, -.05]], .029, light, head);
        oval('nostril', [s * .046, -.04, .205], [.015, .012, .007], dark, head);
      }
      curve('tail', [[0, .26, -.24], [.06, .20, -.36], [.08, .08, -.36]], .022, coat);
      oval('tail-tuft', [.08, .07, -.36], [.034, .055, .032], accent);
      break;
    case '인':
      for (const s of [-1, 1]) {
        oval('round-ear', [s * .13, .135, -.02], [.075, .075, .041], accent, head);
        oval('ear-center', [s * .13, .135, .012], [.043, .042, .012], light, head);
        for (let i = 0; i < 3; i++) { oval('cheek-stripe', [s * .14, .07 - i * .048, .10], [.032, .013, .035], accent, head, s * .32); oval('body-stripe', [s * .15, .28, -.13 + i * .105], [.018, .10, .025], accent); }
      }
      face(); curve('striped-tail', [[0, .22, -.22], [.12, .22, -.35], [.20, .30, -.31]], .032, coat);
      oval('tail-tip', [.20, .30, -.31], [.035, .035, .036], accent);
      break;
    case '묘':
      for (const s of [-1, 1]) { oval('long-ear', [s * .075, .25, -.035], [.047, .205, .04], coat, head, -s * .11); oval('inner-ear', [s * .075, .25, .002], [.026, .155, .009], light, head, -s * .11); }
      face([.068, .044, .047], coat); oval('cotton-tail', [0, .21, -.27], [.10, .10, .09]);
      break;
    case '진':
      curve('serpentine-body', [[0, .12, -.32], [.03, .18, -.14], [-.035, .32, -.03], [0, .48, .12]], .105);
      head.position.set(0, .52, .15); oval('head', [0, 0, 0], [.13, .13, .14], coat, head);
      oval('long-snout', [0, -.025, .15], [.12, .067, .125], light, head);
      for (const s of [-1, 1]) {
        curve('antler', [[s * .085, .09, -.03], [s * .12, .22, -.09], [s * .17, .29, -.09]], .021, light, head);
        limb('antler-fork', [s * .12, .20, -.08], [s * .19, .21, -.10], .016, light, head, .004);
        limb('small-arm', [s * .07, .30, .05], [s * .19, .22, .12], .029);
        oval('claw', [s * .19, .22, .13], [.044, .028, .048], light);
        oval('foot', [s * .085, .049, -.09], [.06, .049, .10], light);
      }
      curve('tapered-tail', [[0, .12, -.31], [.15, .10, -.44], [.26, .14, -.39]], .04, accent);
      break;
    case '사': {
      const points: Point[] = Array.from({ length: 30 }, (_, i) => { const a = i / 29 * Math.PI * 2.1; return [.21 * Math.cos(a), .095 + i / 29 * .045, .17 * Math.sin(a)]; });
      points.push([.09, .21, .06], [0, .31, .16]); curve('coiled-body', points, .065);
      head.position.set(0, .35, .17); oval('head', [0, 0, 0], [.095, .075, .125], coat, head);
      oval('chin', [0, -.04, .03], [.079, .03, .10], light, head);
      for (let i = 0; i < 5; i++) oval('back-mark', [-.20 + i * .08, .145, -.095], [.023, .009, .04], accent);
      break;
    }
    case '오':
      oval('upright-neck', [0, .42, .11], [.095, .23, .115]);
      head.position.set(0, .65, .18); oval('long-muzzle', [0, -.04, .125], [.10, .105, .14], coat, head);
      for (const s of [-1, 1]) oval('pointed-ear', [s * .085, .18, -.025], [.039, .11, .03], coat, head, -s * .15);
      for (let i = 0; i < 4; i++) oval('mane', [0, .54 - i * .08, -.035], [.052, .085, .065], light);
      curve('long-tail', [[0, .25, -.24], [.02, .17, -.36], [.01, .025, -.37]], .036, light);
      break;
    case '미':
      for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9; oval('wool-curl', [.12 * Math.cos(a), .28 + .10 * Math.sin(a), -.08 + (i % 3) * .07], [.09, .085, .09]); }
      for (const s of [-1, 1]) {
        curve('curled-horn', [[s * .13, .09, -.025], [s * .22, .14, -.01], [s * .24, .04, .015], [s * .18, -.005, .026], [s * .16, .065, .03]], .026, light, head);
        oval('low-ear', [s * .18, -.015, .005], [.076, .033, .035], accent, head);
      }
      face([.075, .058, .063], light);
      break;
    case '신':
      oval('cream-face', [0, .006, .122], [.125, .125, .035], light, head);
      for (const s of [-1, 1]) { oval('round-ear', [s * .18, .015, -.005], [.082, .085, .041], coat, head); oval('ear-center', [s * .18, .015, .029], [.049, .052, .010], light, head); }
      face([.075, .052, .062]); curve('curled-tail', [[0, .18, -.23], [.20, .19, -.37], [.27, .36, -.34], [.18, .40, -.27], [.14, .31, -.28]], .022);
      break;
    case '유':
      oval('bird-body', [0, .27, -.03], [.16, .22, .19]); head.position.set(0, .50, .10);
      oval('bird-head', [0, 0, 0], [.108, .117, .106], coat, head);
      limb('beak', [0, -.015, .095], [0, -.03, .22], .044, gold, head, .005);
      for (let i = 0; i < 3; i++) oval('red-comb', [(i - 1) * .047, .11 + (i === 1 ? .025 : 0), 0], [.033, .065, .033], light, head);
      oval('red-wattle', [0, -.105, .07], [.035, .055, .028], light, head);
      for (const s of [-1, 1]) { oval('wing', [s * .145, .29, -.025], [.04, .12, .14], accent); limb('leg', [s * .065, .035, .015], [s * .065, .15, .015], .019, gold); limb('toe', [s * .065, .025, -.015], [s * .065, .025, .12], .018, gold); }
      for (let i = 0; i < 3; i++) curve('tail-feather', [[0, .30, -.17], [(i - 1) * .055, .43, -.29], [(i - 1) * .07, .39, -.43]], .025, accent);
      break;
    case '술':
      for (const s of [-1, 1]) oval('floppy-ear', [s * .16, -.04, -.015], [.055, .15, .052], accent, head, s * .18);
      face([.10, .07, .088]); oval('chest', [0, .29, .205], [.096, .12, .028], light);
      curve('raised-tail', [[0, .24, -.23], [.075, .36, -.31], [.15, .40, -.26]], .035);
      break;
    case '해':
      for (const s of [-1, 1]) oval('triangular-ear', [s * .105, .13, -.005], [.058, .105, .033], light, head, -s * .55);
      oval('broad-snout', [0, -.055, .145], [.10, .068, .067], light, head);
      for (const s of [-1, 1]) oval('nostril', [s * .035, -.047, .206], [.014, .019, .007], accent, head);
      curve('curly-tail', [[0, .20, -.24], [.055, .24, -.30], [.06, .18, -.33], [.005, .17, -.32], [.005, .23, -.32]], .014, light);
      break;
  }
  // Long muzzles need eyes above the snout; a snake's eyes stay on its smaller head.
  const eyeY = ['진', '오'].includes(resolved) ? .075 : .025;
  const eyeZ = resolved === '신' ? .157 : ['사', '진'].includes(resolved) ? .108 : .137;
  for (const s of [-1, 1]) oval('eye', [s * (resolved === '사' ? .052 : .065), eyeY, eyeZ], [.018, .024, .012], dark, head);
  head.rotation.set(-.07, -.22, 0); // Small upward glance toward the avatar, not its material.
  const bounds = new THREE.Box3().setFromObject(rig), size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(.66 / size.y, .62 / size.x, .85 / size.z);
  rig.scale.setScalar(scale); rig.position.y = -bounds.min.y * scale;
  group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  const update = (time: number) => {
    head.rotation.x = -.07 + Math.sin(time * .65) * .016;
    head.rotation.y = -.22 + Math.sin(time * .54) * .035;
    head.rotation.z = Math.sin(time * .72) * .018;
  };
  update(0); return { group, update };
}
