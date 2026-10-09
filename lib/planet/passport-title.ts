// The 920px frame leaves 24px of padding on each side of its centered title.
export function fitPassportTitle(ctx: CanvasRenderingContext2D, title: string): string {
  const fits = (text: string) => {
    const metrics = ctx.measureText(text);
    return Math.max(metrics.width, 2 * metrics.actualBoundingBoxLeft, 2 * metrics.actualBoundingBoxRight) <= 872;
  };
  for (let size = 72; size >= 36; size--) {
    ctx.font = `bold ${size}px serif`;
    if (fits(title)) return title;
  }

  let prefix = "";
  const graphemes = new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(title);
  for (const { segment } of graphemes) {
    if (!fits(prefix + segment + "…")) break;
    prefix += segment;
  }
  return prefix + "…";
}
