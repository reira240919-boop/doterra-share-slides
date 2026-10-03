// デザイン見本（5月・春）の雰囲気の型で、PowerPoint を作る。
// 寸法は 1280×720 の画面の点（px）で書き、PowerPoint のインチ（1 インチ＝96px）に直して置く。
// 使う部品は、四角・丸・線・文字・画像だけ。キャンバで文字も配置も直せる。
// 写真はまだ入れない（写真を入れる場所に、うすい点線の枠と「写真：〇〇」のメモを置く）。

import type PptxGenJS from "pptxgenjs";
import type { DeckImage, DeckInput, DeckItem, DeckSlide } from "./deck";
import { deckPalette, type DeckPalette } from "./deck-palette";

// キャンバの書体の一覧に出ている名前のまま指定する（担当者の指定）
const SERIF = "Noto Serif Japanese"; // 本文すべて
const SANS = SERIF; // 写真の枠のメモなど、小さな文字も同じ書体にそろえる
const COVER_TITLE = "IPAex 明朝"; // 表紙の大きい文字（題）
const COVER_SMALL = "セザンヌ"; // 表紙の小さい文字（ひとこと）

const X = (px: number) => px / 96; // 画面の点 → インチ
const PT = (px: number) => Math.round(px * 0.75 * 10) / 10; // 画面の文字の大きさ → ポイント

type Ctx = { pptx: PptxGenJS; s: PptxGenJS.Slide; pal: DeckPalette; d: DeckSlide };

type TextOpts = {
  size: number; // px
  color?: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  spacing?: number; // 字の間（文字の大きさに対する割合）
  lineH?: number;
  font?: string;
  wrap?: boolean;
};

// ---- 小さな部品 ----

// 文字の幅のおおよそ（全角 1、半角 0.55）
function textWidth(text: string, size: number, spacing = 0): number {
  const longest = text.split("\n").reduce((m, line) => Math.max(m, [...line].reduce((w, c) => w + (c.charCodeAt(0) < 0x2000 ? 0.55 : 1), 0)), 0);
  return longest * size * (1 + spacing);
}

function runsWithHighlight(text: string, highlight: string, color: string, accent: string): PptxGenJS.TextProps[] {
  const at = highlight ? text.indexOf(highlight) : -1;
  if (at < 0) return [{ text, options: { color } }];
  const runs: PptxGenJS.TextProps[] = [];
  if (at > 0) runs.push({ text: text.slice(0, at), options: { color } });
  runs.push({ text: highlight, options: { color: accent } });
  if (at + highlight.length < text.length) runs.push({ text: text.slice(at + highlight.length), options: { color } });
  return runs;
}

function text(ctx: Ctx, body: string | PptxGenJS.TextProps[], x: number, y: number, w: number, h: number, o: TextOpts) {
  if (!body || (Array.isArray(body) && body.length === 0)) return;
  const size = PT(o.size);
  ctx.s.addText(body, {
    x: X(x), y: X(y), w: X(w), h: X(h),
    fontFace: o.font ?? SERIF,
    fontSize: size,
    color: o.color ?? ctx.pal.text,
    align: o.align ?? "left",
    valign: o.valign ?? "top",
    charSpacing: o.spacing ? Math.round(size * o.spacing * 10) / 10 : 0,
    lineSpacingMultiple: o.lineH ?? 1.25,
    margin: 0,
    fit: "shrink",
    ...(o.wrap === false ? { wrap: false } : {}),
  });
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string | null, o: { line?: string; lineW?: number; dash?: boolean; radius?: number; round?: boolean } = {}) {
  const { pptx, s } = ctx;
  const shape = o.round ? pptx.ShapeType.ellipse : o.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
  s.addShape(shape, {
    x: X(x), y: X(y), w: X(w), h: X(h),
    fill: fill ? { color: fill } : ({ type: "none" } as PptxGenJS.ShapeFillProps),
    line: o.line ? { color: o.line, width: o.lineW ?? 0.75, dashType: o.dash ? "dash" : "solid" } : { color: fill ?? "FFFFFF", width: 0, transparency: 100 },
    ...(o.radius ? { rectRadius: o.radius } : {}),
  });
}

function line(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, o: { width?: number; dotted?: boolean } = {}) {
  ctx.s.addShape(ctx.pptx.ShapeType.line, {
    x: X(x), y: X(y), w: X(w), h: X(h),
    line: { color, width: o.width ?? 0.75, dashType: o.dotted ? "sysDot" : "solid" },
  });
}

// 写真を入れる場所。写真があれば置き、無ければうすい点線の枠と「写真：〇〇」のメモを置く
function photoSlot(ctx: Ctx, x: number, y: number, w: number, h: number, photo: string, round = false, image?: DeckImage) {
  if (image) {
    const boxRatio = w / h;
    if (Math.abs(image.ratio / boxRatio - 1) < 0.08) {
      ctx.s.addImage({ data: image.data, x: X(x), y: X(y), w: X(w), h: X(h), rounding: round });
    } else {
      // 商品写真のように比が違う写真は、切らずに枠の中に収める
      let iw = w;
      let ih = w / image.ratio;
      if (ih > h) {
        ih = h;
        iw = h * image.ratio;
      }
      ctx.s.addImage({ data: image.data, x: X(x + (w - iw) / 2), y: X(y + (h - ih) / 2), w: X(iw), h: X(ih) });
    }
    return;
  }
  box(ctx, x, y, w, h, ctx.pal.softer, { line: ctx.pal.line, dash: true, round });
  const note = !photo ? "写真" : /商品写真/.test(photo) ? `${photo.replace(/（.*）$/, "")}（キャンバで入れる）` : `写真：${photo}`;
  text(ctx, note, x + w * 0.12, y, w * 0.76, h, { size: 11, color: ctx.pal.muted, align: "center", valign: "middle", font: SANS });
}

// 女性イラスト：枠の中に、縦横の比を保って下そろえで置く
function illustration(ctx: Ctx, img: DeckImage | undefined, x: number, y: number, w: number, h: number) {
  if (!img) return;
  let iw = w;
  let ih = w / img.ratio;
  if (ih > h) {
    ih = h;
    iw = h * img.ratio;
  }
  ctx.s.addImage({ data: img.data, x: X(x + (w - iw) / 2), y: X(y + h - ih), w: X(iw), h: X(ih) });
}

// 上いっぱいの色の帯（白い文字）
function topBand(ctx: Ctx, label: string, y = 36) {
  box(ctx, 0, y, 1280, 58, ctx.pal.band);
  text(ctx, label, 36, y, 1200, 58, { size: 30, color: "FFFFFF", valign: "middle", spacing: 0.2 });
}

// 左から出る色のラベル（白い文字）。右端の位置を返す
function labelBlock(ctx: Ctx, label: string, x: number, y: number, size = 30, maxW = 1100): number {
  // キャンバの書体は少し横に広いので、幅に余裕を持たせて、改行させない。入りきらないときは文字を小さくする
  const need = (s: number) => textWidth(label, s, 0.2) * 1.15 + 80;
  while (size > 16 && need(size) > maxW) size -= 1;
  const w = Math.min(need(size), maxW);
  box(ctx, x, y, w, size * 1.95, ctx.pal.band);
  text(ctx, label, x + 36, y, w - 40, size * 1.95, { size, color: "FFFFFF", valign: "middle", spacing: 0.2, wrap: false });
  return x + w;
}

// 下線付きの見出し（真ん中）
function underlinedHeading(ctx: Ctx, heading: string, y: number, size = 30) {
  const w = Math.min(textWidth(heading, size, 0.18) + 20, 1160);
  text(ctx, runsWithHighlight(heading, ctx.d.highlight, ctx.pal.text, ctx.pal.accent), (1280 - w) / 2, y, w, size * 1.5, { size, align: "center", valign: "middle", spacing: 0.18 });
  line(ctx, (1280 - w) / 2, y + size * 1.55, w, 0, ctx.pal.text);
}

// 色で塗った小さな帯（真ん中、白い文字）
function centerPill(ctx: Ctx, label: string, y: number, size = 24) {
  if (!label) return;
  // イラストに重ならない幅まで
  // 長い文は、帯に収まるまで文字を小さくする
  const fs = Math.max(16, Math.min(size, 700 / (textWidth(label, 1, 0.15) || 1)));
  const w = Math.min(textWidth(label, fs, 0.18) + 80, 760);
  box(ctx, (1280 - w) / 2, y, w, 52, ctx.pal.band);
  text(ctx, label, (1280 - w) / 2, y, w, 52, { size: fs, color: "FFFFFF", align: "center", valign: "middle", spacing: 0.15 });
}

const items = (d: DeckSlide, max: number): DeckItem[] => d.items.slice(0, max);

// 中身のかたまりを、使える範囲（top〜bottom）の上下の真ん中に置いたときの上の位置
const middle = (top: number, bottom: number, block: number) => top + Math.max(0, (bottom - top - block) / 2);

const lineCount = (text: string) => text.split("\n").filter(Boolean).length;

// AI が文の頭に付けた番号（「①」「1.」「1 」など）を外す。「70種類」のような数字は残す
const dropNumber = (text: string) => text.trim().replace(/^([①-⑳]\s*|[0-9０-９]{1,2}([.．、)）]|\s)\s*)/, "");

// ---- 型 ----

function coverFrame(ctx: Ctx) {
  const { pal, d } = ctx;
  const B = 22;
  box(ctx, 0, 0, 1280, B, pal.band);
  box(ctx, 0, 720 - B, 1280, B, pal.band);
  box(ctx, 0, 0, B, 720, pal.band);
  box(ctx, 1280 - B, 0, B, 720, pal.band);
  box(ctx, 760, B, 300, 330, pal.soft);
  box(ctx, B, 430, 120, 268, pal.soft);
  if (d.lead) text(ctx, `“${d.lead}”`, 150, 225, 980, 40, { size: 24, color: pal.muted, align: "right", spacing: 0.18, font: COVER_SMALL });
  text(ctx, d.heading, 150, 271, 980, 100, { size: 60, color: pal.accent, align: "right", valign: "middle", spacing: 0.12, font: COVER_TITLE });
  illustration(ctx, d.illustration, 150, 360, 330, 330);
}

function coverSoft(ctx: Ctx) {
  const { pal, d } = ctx;
  box(ctx, 820, 0, 460, 340, pal.soft);
  box(ctx, 0, 400, 110, 190, pal.soft);
  if (d.lead) text(ctx, d.lead, 100, 211, 700, 36, { size: 22, color: pal.accent, spacing: 0.2, font: COVER_SMALL });
  text(ctx, runsWithHighlight(d.heading, d.highlight, pal.text, pal.accent), 100, 255, 900, 100, { size: 50, valign: "middle", spacing: 0.12, font: COVER_TITLE });
  illustration(ctx, d.illustration, 470, 330, 420, 390);
}

function bubbles(ctx: Ctx) {
  const { pal, d } = ctx;
  underlinedHeading(ctx, d.heading, 36);
  if (d.lead) text(ctx, d.lead, 140, 100, 1000, 48, { size: 22, color: pal.muted, align: "center", spacing: 0.1, lineH: 1.5 });
  const slots = [
    [170, 170, 230], [470, 150, 200], [745, 175, 220], [1020, 190, 190], [560, 420, 210], [850, 440, 200],
  ];
  const order: Record<number, number[]> = { 3: [0, 2, 4], 4: [0, 2, 4, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
  const list = items(d, 6);
  const pick = order[list.length] ?? order[6].slice(0, list.length);
  list.forEach((it, i) => {
    const [x, y, size] = slots[pick[i]];
    box(ctx, x, y, size, size, pal.soft, { round: true });
    box(ctx, x - 8, y - 8, size + 10, size + 10, null, { round: true, line: pal.deep });
    text(ctx, it.label, x + 12, y, size - 24, size, { size: 22, align: "center", valign: "middle", lineH: 1.5 });
  });
  illustration(ctx, d.illustration, 150, 410, 300, 300);
}

function circleRow(ctx: Ctx) {
  const { pal, d } = ctx;
  underlinedHeading(ctx, d.heading, 36);
  if (d.lead) text(ctx, d.lead, 140, 100, 1000, 70, { size: 22, color: pal.muted, align: "center", spacing: 0.1, lineH: 1.5 });
  const list = items(d, 6);
  const cw = 1120 / Math.max(list.length, 1);
  const size = Math.min(190, cw - 40);
  const hasText = list.some((it) => it.text);
  const y0 = middle(175, 590, size + (hasText ? 104 : 0));
  list.forEach((it, i) => {
    const cx = 80 + cw * i + cw / 2;
    box(ctx, cx - size / 2, y0, size, size, pal.soft, { round: true });
    text(ctx, it.label, cx - size / 2 + 14, y0, size - 28, size, { size: 22, align: "center", valign: "middle", lineH: 1.5, spacing: 0.08 });
    if (it.text) text(ctx, it.text, cx - cw / 2 + 12, y0 + size + 24, cw - 24, 80, { size: 20, color: pal.muted, align: "center", lineH: 1.6 });
    if (i > 0) line(ctx, 80 + cw * i, y0 + 20, 0, size + (hasText ? 84 : 0) - 20, pal.line);
  });
  centerPill(ctx, d.band, 612);
  illustration(ctx, d.illustration, 1040, 540, 170, 165);
}

function flowBoxes(ctx: Ctx) {
  const { pal, d } = ctx;
  topBand(ctx, d.section || d.heading);
  if (d.section) {
    text(ctx, runsWithHighlight(d.heading, d.highlight, pal.text, pal.accent), 80, 122, 820, 40, { size: 24, spacing: 0.15 });
    line(ctx, 80, 164, Math.min(textWidth(d.heading, 24, 0.15), 820), 0, pal.text);
  }
  if (d.lead) text(ctx, d.lead, 80, 180, 800, 32, { size: 20, color: pal.muted, spacing: 0.15 });
  const list = items(d, 4);
  const n = Math.max(list.length, 1);
  // 右側のイラストと重ならないよう、四角が 4 つのときは少し細くする
  const bw = n >= 4 ? 175 : 230;
  const gap = n >= 4 ? 30 : 60;
  list.forEach((it, i) => {
    const x = 80 + i * (bw + gap);
    box(ctx, x, 290, bw, 120, pal.deep, { radius: 0.1 });
    text(ctx, it.label, x + 10, 290, bw - 20, 120, { size: 22, color: "FFFFFF", align: "center", valign: "middle", spacing: 0.12, lineH: 1.4 });
    if (i < n - 1) line(ctx, x + bw, 350, gap, 0, pal.muted, { dotted: true, width: 1.5 });
    if (it.text) text(ctx, it.text, x, 430, bw, 90, { size: 21, align: "center", spacing: 0.1, lineH: 1.6 });
  });
  illustration(ctx, d.illustration, 890, 200, 320, 350);
  if (d.band) {
    box(ctx, 0, 610, 1280, 110, pal.band);
    text(ctx, d.band, 60, 610, 1160, 110, { size: 24, color: "FFFFFF", align: "center", valign: "middle", spacing: 0.15, lineH: 1.6 });
  }
}

function pointList(ctx: Ctx) {
  const { pal, d } = ctx;
  topBand(ctx, d.section || "セルフケア・養生法");
  box(ctx, 80, 150, 112, 28, null, { radius: 0.5, line: pal.text });
  text(ctx, "POINT", 80, 150, 112, 28, { size: 16, align: "center", valign: "middle", spacing: 0.25 });
  text(ctx, runsWithHighlight(d.heading, d.highlight, pal.text, pal.accent), 80, 192, 580, 56, { size: 28, spacing: 0.12, valign: "middle" });
  if (d.lead) text(ctx, d.lead, 80, 262, 560, 140, { size: 20, color: pal.muted, lineH: 2, spacing: 0.1 });
  if (d.band) {
    text(ctx, d.band, 80, 408, 580, 34, { size: 21, spacing: 0.12 });
    line(ctx, 80, 444, Math.min(textWidth(d.band, 21, 0.12), 580), 0, pal.text);
  }
  illustration(ctx, d.illustration, 80, 470, 250, 240);
  const list = items(d, 5);
  const row = Math.min(104, 520 / Math.max(list.length, 1));
  line(ctx, 700, 150, 0, row * (list.length - 0.4), pal.line);
  list.forEach((it, i) => {
    const y = 150 + row * i;
    box(ctx, 687, y, 26, 26, pal.band, { round: true });
    text(ctx, String(i + 1), 687, y, 26, 26, { size: 14, color: "FFFFFF", align: "center", valign: "middle", font: SANS });
    text(ctx, it.label, 735, y - 5, 500, 36, { size: 22, spacing: 0.12, valign: "middle" });
    if (it.text) text(ctx, it.text, 735, y + 34, 500, row - 38, { size: 20, color: pal.muted, lineH: 1.5 });
  });
}

function labelCircles(ctx: Ctx) {
  const { pal, d } = ctx;
  const right = labelBlock(ctx, d.section || d.heading, 0, 60);
  const quote = d.section ? d.heading : d.lead;
  if (quote) text(ctx, runsWithHighlight(`“${quote}”`, d.highlight, pal.text, pal.accent), right + 30, 66, 1250 - right - 30, 46, { size: 24, valign: "middle", spacing: 0.12 });
  const list = items(d, 3);
  const xs = list.length === 2 ? [330, 700] : [150, 515, 880];
  list.forEach((it, i) => {
    const x = xs[i];
    if (it.photo) {
      photoSlot(ctx, x, 190, 250, 250, it.photo, true, it.photoImage);
      text(ctx, it.label, x, 452, 250, 40, { size: 24, align: "center", valign: "middle", spacing: 0.12 });
    } else {
      box(ctx, x, 190, 250, 250, pal.soft, { round: true });
      text(ctx, it.label, x + 20, 190, 210, 250, { size: 22, align: "center", valign: "middle", spacing: 0.1, lineH: 1.5 });
    }
    line(ctx, x + 95, 500, 60, 0, pal.band);
    if (it.text) text(ctx, it.text, x - 10, 512, 270, 60, { size: 20, color: pal.muted, align: "center", spacing: 0.1, lineH: 1.5 });
  });
  centerPill(ctx, d.band, 600);
  illustration(ctx, d.illustration, 1020, 490, 190, 210);
}

function photoRow(ctx: Ctx) {
  const { pal, d } = ctx;
  topBand(ctx, d.heading);
  if (d.lead) text(ctx, d.lead, 80, 108, 1100, 70, { size: 22, color: pal.muted, spacing: 0.1, lineH: 1.5 });
  const list = items(d, 6);
  const cw = 1120 / Math.max(list.length, 1);
  const size = Math.min(250, cw - 40);
  const hasText = list.some((it) => it.text);
  const y0 = middle(185, d.band ? 595 : 690, size + 12 + 56 + (hasText ? 64 : 0));
  list.forEach((it, i) => {
    const x = 80 + cw * i + (cw - size) / 2 - 6;
    box(ctx, x + 12, y0 + 12, size, size, pal.soft);
    photoSlot(ctx, x, y0, size, size, it.photo, false, it.photoImage);
    text(ctx, it.label, 80 + cw * i, y0 + size + 22, cw, 34, { size: 21, color: pal.accent, align: "center", spacing: 0.15 });
    if (it.text) text(ctx, it.text, 80 + cw * i + 6, y0 + size + 62, cw - 12, 60, { size: 20, color: pal.muted, align: "center", lineH: 1.5 });
  });
  if (d.band) {
    box(ctx, 0, 610, 1280, 110, pal.softer);
    text(ctx, runsWithHighlight(d.band, d.highlight, pal.text, pal.accent), 80, 610, 900, 110, { size: 24, valign: "middle", spacing: 0.12 });
  }
  // 下の帯にかかるように置く（見本の食材ページと同じ置き方）
  illustration(ctx, d.illustration, 1040, 550, 170, 160);
}

function headerCards(ctx: Ctx) {
  const { pal, d } = ctx;
  labelBlock(ctx, d.section || d.heading, 0, 50);
  illustration(ctx, d.illustration, 1000, 16, 200, 170);
  const withSub = Boolean(d.section && d.heading);
  if (withSub) text(ctx, runsWithHighlight(d.heading, d.highlight, pal.text, pal.accent), 70, 138, 900, 40, { size: 24, spacing: 0.12 });
  const list = items(d, 4);
  const n = Math.max(list.length, 1);
  const gap = 24;
  const cw = (1140 - gap * (n - 1)) / n;
  const rows = Math.max(...list.map((it) => lineCount(it.text)), 1);
  const cardH = Math.min(360, Math.max(220, 58 + 40 + rows * 40 + 30));
  const y0 = middle(withSub ? 190 : 140, 690, cardH + (d.band ? 90 : 0));
  list.forEach((it, i) => {
    const x = 70 + i * (cw + gap);
    box(ctx, x, y0, cw, cardH, pal.softer);
    box(ctx, x, y0, cw, 58, pal.deep);
    text(ctx, it.label, x + 10, y0, cw - 20, 58, { size: 22, color: "FFFFFF", align: "center", valign: "middle", spacing: 0.12 });
    if (it.text) text(ctx, runsWithHighlight(it.text, d.highlight, pal.text, pal.accent), x + 18, y0 + 84, cw - 36, cardH - 100, { size: 20, align: "center", lineH: 2, spacing: 0.1 });
  });
  if (d.band) text(ctx, runsWithHighlight(d.band, d.highlight, pal.text, pal.accent), 60, y0 + cardH + 50, 1160, 40, { size: 24, align: "center", valign: "middle", spacing: 0.15 });
}

function photoFeature(ctx: Ctx) {
  const { pal, d } = ctx;
  box(ctx, 150, 175, 360, 360, pal.soft, { round: true });
  photoSlot(ctx, 190, 140, 360, 360, d.photo, true, d.photoImage);
  text(ctx, runsWithHighlight(`“${d.heading}”`, d.highlight, pal.text, pal.accent), 620, 110, 640, 60, { size: 28, valign: "middle", spacing: 0.12 });
  const list = items(d, 5);
  text(ctx, list.map((it) => `・${it.label}`).join("\n"), 650, 192, 540, 230, { size: 22, lineH: 2.0, spacing: 0.12 });
  if (d.lead) text(ctx, d.lead, 640, 430, 340, 190, { size: 20, color: pal.muted, lineH: 1.6, spacing: 0.08 });
  illustration(ctx, d.illustration, 1000, 390, 190, 230);
  if (d.band) {
    box(ctx, 0, 630, 1280, 90, pal.band);
    text(ctx, d.band, 60, 630, 1160, 90, { size: 24, color: "FFFFFF", align: "center", valign: "middle", spacing: 0.15 });
  }
}

function productCards(ctx: Ctx) {
  const { pal, d } = ctx;
  photoSlot(ctx, 30, 250, 340, 300, d.photo || "商品写真（キャンバで入れる）", false, d.photoImage);
  text(ctx, runsWithHighlight(d.heading, d.highlight, pal.accent, pal.accent), 60, 36, 1100, 56, { size: 34, valign: "middle", spacing: 0.12 });
  if (d.lead) text(ctx, d.lead, 60, 96, 1100, 50, { size: 20, color: pal.muted, spacing: 0.1, lineH: 1.5 });
  if (d.section) text(ctx, `「${d.section}」`, 420, 150, 820, 36, { size: 22, color: pal.accent, align: "center", spacing: 0.12 });
  const list = items(d, 3);
  const n = Math.max(list.length, 1);
  const gap = 20;
  const cw = (820 - gap * (n - 1)) / n;
  list.forEach((it, i) => {
    const x = 420 + i * (cw + gap);
    box(ctx, x, 215, cw, 330, "FFFFFF", { line: pal.line, radius: 0.08 });
    text(ctx, String(i + 1).padStart(2, "0"), x + cw - 70, 225, 54, 36, { size: 28, color: pal.line, align: "right" });
    text(ctx, it.label, x + 12, 260, cw - 24, 34, { size: 20, align: "center", spacing: 0.12 });
    if (it.photo) photoSlot(ctx, x + 16, 300, cw - 32, 92, it.photo, false, it.photoImage);
    if (it.text) text(ctx, it.text, x + 16, it.photo ? 404 : 310, cw - 32, 130, { size: 20, lineH: 1.6 });
  });
  if (d.band) {
    box(ctx, 400, 580, 880, 100, pal.band);
    text(ctx, d.band, 440, 580, 820, 100, { size: 22, color: "FFFFFF", valign: "middle", spacing: 0.12, lineH: 1.7 });
  }
  illustration(ctx, d.illustration, 40, 560, 150, 150);
}

function labelNumbered(ctx: Ctx) {
  const { pal, d } = ctx;
  const marks = ["①", "②", "③", "④", "⑤"];
  // 上：ラベル＋番号付きの文（左）、写真（右）
  labelBlock(ctx, d.heading, 90, 50, 26, 650);
  const list = items(d, 4);
  text(ctx, list.map((it, i) => `${marks[i]} ${dropNumber(it.label)}`).join("\n"), 100, 124, 660, 210, { size: list.length >= 4 ? 20 : 22, lineH: 2.0, spacing: 0.1 });
  box(ctx, 800, 70, 380, 230, pal.soft);
  photoSlot(ctx, 770, 45, 380, 230, d.photo || "商品写真（キャンバで入れる）", false, d.photoImage);
  // 下の左：ラベル＋番号付きの文
  if (d.section) labelBlock(ctx, d.section, 90, 380, 26);
  const lines = d.band.split("\n").map(dropNumber).filter(Boolean);
  if (lines.length > 0) text(ctx, lines.map((l, i) => `${marks[i] ?? "・"} ${l}`).join("\n"), 100, 458, 600, 220, { size: 22, lineH: 2.0, spacing: 0.1 });
  // 下の右：図（ウェルネスピラミッドなど）があれば大きく置き、強調の一文はその下に添える
  if (d.sideImage) {
    illustration(ctx, d.sideImage, 740, 360, 470, 270);
    if (d.lead) text(ctx, d.lead, 740, 640, 470, 50, { size: 20, color: pal.accent, align: "center", valign: "middle", spacing: 0.1 });
    return;
  }
  // 図が無いときは、強調の一文を淡い箱に入れて大きく見せる（右下が空かないように）。イラストがあれば箱の角に添える
  if (d.lead) {
    box(ctx, 740, 360, 460, 290, pal.softer, { radius: 0.06 });
    line(ctx, 780, 400, 60, 0, pal.accent, { width: 1.5 });
    text(ctx, d.lead, 780, 420, d.illustration ? 250 : 380, 200, { size: 24, color: pal.accent, valign: "middle", lineH: 1.7, spacing: 0.1 });
  }
  illustration(ctx, d.illustration, d.lead ? 1020 : 960, d.lead ? 450 : 430, 190, 230);
}

function checklist(ctx: Ctx) {
  const { pal, d } = ctx;
  underlinedHeading(ctx, d.heading, 36);
  if (d.lead) text(ctx, d.lead, 140, 100, 1000, 64, { size: 20, color: pal.muted, align: "center", spacing: 0.1, lineH: 1.5 });
  // チェック欄の型は、表と見出しで埋まるのでイラストは置かない
  const list = items(d, 3);
  const n = Math.max(list.length, 1);
  const gap = 40;
  // 箱の幅は、いちばん長いチェック項目に合わせる（広がりすぎて右が空かないように）。並びは真ん中にそろえる
  const longest = Math.max(...list.flatMap((it) => it.text.split("\n").map((t) => textWidth(`□ ${t}`, 20, 0.06))), 200);
  const cw = Math.min((1060 - gap * (n - 1)) / n, longest + 90);
  const left = (1280 - (cw * n + gap * (n - 1))) / 2;
  const rows = Math.max(...list.map((it) => lineCount(it.text)), 1);
  const boxH = Math.min(420, 120 + rows * 50);
  const y0 = middle(170, 660, boxH + (d.band ? 80 : 0));
  list.forEach((it, i) => {
    const x = left + i * (cw + gap);
    box(ctx, x, y0, cw, boxH, pal.softer);
    text(ctx, it.label, x + 10, y0 + 18, cw - 20, 64, { size: 22, color: pal.accent, align: "center", valign: "middle", spacing: 0.1, lineH: 1.4 });
    const checks = it.text.split("\n").filter(Boolean).map((t) => `□ ${t}`).join("\n");
    text(ctx, checks, x + 28, y0 + 100, cw - 44, boxH - 110, { size: 20, lineH: 2, spacing: 0.06 });
  });
  if (d.band) text(ctx, d.band, 60, y0 + boxH + 40, 1160, 40, { size: 22, align: "center", valign: "middle", spacing: 0.15 });
}

function keyMessage(ctx: Ctx) {
  const { pal, d } = ctx;
  if (d.section) labelBlock(ctx, d.section, 0, 50);
  if (d.lead) text(ctx, d.lead, 60, 150, 1000, 90, { size: 20, lineH: 1.8, spacing: 0.12 });
  text(ctx, runsWithHighlight(d.heading, d.highlight, pal.text, pal.accent), 60, 260, 1160, 70, { size: 36, align: "center", valign: "middle", spacing: 0.12 });
  const list = items(d, 3);
  const size = 150;
  const gap = 60;
  const total = list.length * size + (list.length - 1) * gap;
  list.forEach((it, i) => {
    const x = (1280 - total) / 2 + i * (size + gap);
    box(ctx, x, 360, size, size, pal.band, { round: true });
    const len = [...it.label].length;
    const fs = len <= 2 ? 34 : len === 3 ? 28 : len === 4 ? 24 : 20;
    text(ctx, it.label, x + 10, 360, size - 20, size, { size: fs, color: "FFFFFF", align: "center", valign: "middle", lineH: 1.3 });
    if (it.text) text(ctx, it.text, x - 30, 525, size + 60, 64, { size: 20, color: pal.muted, align: "center", lineH: 1.5 });
  });
  centerPill(ctx, d.band, 620);
  illustration(ctx, d.illustration, 50, 420, 210, 270);
}

function summaryBox(ctx: Ctx) {
  const { pal, d } = ctx;
  box(ctx, 140, 90, 1000, 560, pal.softer);
  const label = d.heading || "今日のまとめ";
  const w = textWidth(label, 24, 0.15) + 60;
  box(ctx, (1280 - w) / 2, 62, w, 56, pal.band, { radius: 0.15 });
  text(ctx, label, (1280 - w) / 2, 62, w, 56, { size: 24, color: "FFFFFF", align: "center", valign: "middle", spacing: 0.15 });
  text(ctx, items(d, 4).map((it) => `・${it.label}`).join("\n"), 290, 160, 800, 200, { size: 23, lineH: 2.0, spacing: 0.12 });
  if (d.lead) text(ctx, d.lead, 180, 380, 920, 84, { size: 22, align: "center", lineH: 1.8, spacing: 0.12 });
  illustration(ctx, d.illustration, 850, 420, 260, 200);
  text(ctx, d.band || "最後まで、ご清聴ありがとうございました。", 180, 594, 920, 34, { size: 18, color: pal.muted, align: "center", spacing: 0.15 });
}

const DRAW: Record<DeckSlide["layout"], (ctx: Ctx) => void> = {
  coverFrame, coverSoft, bubbles, circleRow, flowBoxes, pointList, labelCircles, photoRow,
  headerCards, photoFeature, productCards, labelNumbered, checklist, keyMessage, summaryBox,
};

async function build(input: DeckInput) {
  const { default: PptxGenJSClass } = await import("pptxgenjs");
  const pptx = new PptxGenJSClass();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 × 7.5 インチ ＝ 1280 × 720 px
  pptx.title = `${input.year}年${input.month}月 シェア会`;
  const pal = deckPalette(input.season);
  for (const d of input.slides) {
    const s = pptx.addSlide();
    s.background = { color: "FFFFFF" };
    DRAW[d.layout]({ pptx, s, pal, d });
  }
  return pptx;
}

export async function buildDeckBlob(input: DeckInput): Promise<Blob> {
  const pptx = await build(input);
  return (await pptx.write({ outputType: "blob" })) as Blob;
}

// ファイル名に使えない文字をよける
function safeName(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, "").trim();
}

export function deckFileName(year: number, month: number, pom: string): string {
  return `シェア会_${year}年${month}月_${safeName(pom) || "スライド"}.pptx`;
}

// フォルダ保存が使えないブラウザでは、ふつうのダウンロードで保存する
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
