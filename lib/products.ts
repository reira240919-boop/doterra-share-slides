// ドテラ商品の写真（担当者が用意した公式写真）と、ミネラルのページに添える図。AI では描かず、これを使い回す。
// private/products/ に置く（URL では開けない）。
//   phossil-group.png     … PHOSSILミネラルのボトル 5 本（横長の枠に使う）
//   phossil-single.png    … 上の写真から 1 本だけ切り抜いたもの（縦長・正方形の枠に使う）
//   wellness-pyramid.png  … ドテラ ウェルネスピラミッドの図（以前のミネラル資料から切り抜き）

import { readFile } from "node:fs/promises";
import path from "node:path";
import { emptyPhotoSlots, isProductSlot, type DeckImage, type DeckSlide } from "./deck";

const DIR = path.join(process.cwd(), "private", "products");

async function load(file: string, ratio: number): Promise<DeckImage | null> {
  try {
    const buf = await readFile(path.join(DIR, file));
    return { data: `data:image/png;base64,${buf.toString("base64")}`, ratio, desc: "PHOSSILミネラル（公式写真）" };
  } catch {
    return null;
  }
}

// 枠の縦横の比に合わせて、5 本か 1 本の写真を選ぶ
export async function phossilImage(boxRatio: number): Promise<DeckImage | null> {
  return boxRatio >= 1.2 ? load("phossil-group.png", 1000 / 562) : load("phossil-single.png", 117 / 378);
}

// 写真の説明が PHOSSILミネラルの商品を指しているか
export function isPhossilPhoto(desc: string): boolean {
  return /PHOSSIL|フォシル|ミネラルの?(ボトル|瓶|商品)|商品写真/.test(desc);
}

export async function pyramidImage(): Promise<DeckImage | null> {
  return load("wellness-pyramid.png", 1115 / 693);
}

// ミネラルのページに、ボトルの公式写真とウェルネスピラミッドの図を付ける
export async function attachMineralImages(slides: DeckSlide[]): Promise<DeckSlide[]> {
  const out = [...slides];
  for (const slot of emptyPhotoSlots(out)) {
    if (!isProductSlot(slot) || out[slot.slide].topic !== "mineral") continue;
    const image = await phossilImage(slot.ratio);
    if (!image) continue;
    if (slot.item < 0) out[slot.slide] = { ...out[slot.slide], photoImage: image };
    else out[slot.slide] = { ...out[slot.slide], items: out[slot.slide].items.map((it, j) => (j === slot.item ? { ...it, photoImage: image } : it)) };
  }
  const pyramid = await pyramidImage();
  if (pyramid) {
    for (let i = 0; i < out.length; i++) {
      if (out[i].topic === "mineral" && out[i].layout === "labelNumbered") out[i] = { ...out[i], sideImage: pyramid };
    }
  }
  return out;
}
