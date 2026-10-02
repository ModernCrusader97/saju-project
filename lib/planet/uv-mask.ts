import { createSphereMask, type SurfaceMaskStyle } from "./surface-math";
export type MaskStyle = SurfaceMaskStyle;

/** Seam-identical 2:1 spherical mask. Soft blend is area-calibrated to 70% day. */
export function generate7030UVMask(style: MaskStyle = "pangaea", width = 1024, height = 512): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  const mask = createSphereMask(style, width, height);
  for (let i = 0; i < mask.length; i++) {
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = mask[i];
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Material data maps are linear, unlike the sRGB albedo canvas. */
export function createSurfacePropertyMap(mask: HTMLCanvasElement, day: number, month: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = mask.width; canvas.height = mask.height;
  const ctx = canvas.getContext("2d")!;
  const data = mask.getContext("2d")!.getImageData(0, 0, mask.width, mask.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const a = data.data[i + 3] / 255;
    const value = Math.round((day * a + month * (1 - a)) * 255);
    data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0); return canvas;
}

// 70:30 표면 텍스처 블렌딩 (Canvas 2D 방식 - WebGL 셰이더 오류 원천 차단)
export function blendPlanetSurfaces(
  canvasDay: HTMLCanvasElement,   // SLOT-D (70% 일주)
  canvasMonth: HTMLCanvasElement, // SLOT-M (30% 월주)
  maskCanvas: HTMLCanvasElement,  // 70:30 Mask
  width: number = 1024,
  height: number = 512
): HTMLCanvasElement {
  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = width;
  resultCanvas.height = height;
  const ctx = resultCanvas.getContext("2d")!;

  // 1. 월주 표면 (30% 베이스) 그리기
  ctx.drawImage(canvasMonth, 0, 0, width, height);

  // 2. 일주 표면을 마스크로 클리핑하여 70% 구역만 추출
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tCtx = tempCanvas.getContext("2d")!;

  tCtx.drawImage(canvasDay, 0, 0, width, height);
  tCtx.globalCompositeOperation = "destination-in";
  tCtx.drawImage(maskCanvas, 0, 0, width, height);

  // 3. 월주 베이스 위에 70% 일주 표면 얹기
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(tempCanvas, 0, 0);

  return resultCanvas;
}
