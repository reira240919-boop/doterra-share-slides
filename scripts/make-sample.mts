// 公開用（見本）に出すスライドを作る（パソコンで動かす）：
//   npm run build:sample -- <自分用で作ったスライドの JSON>
//
// 自分用で作ったスライドの中身（/api/generate の返事）をもとに、公開してよい形にして data/sample-deck.json に書く。
// - 女性イラストはすべて外す（GitHub を公開にしているので、イラストの画像を載せない）
// - ドテラ商品の写真は外す（点線の枠にする）
// - 食材・過ごし方の写真は AI で作って入れる（OPENAI_API_KEY が必要。写真 1 枚 5〜8 円ほど）

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generatePhoto } from "../lib/ai-photo";
import { emptyPhotoSlots, isProductSlot, type DeckSlide } from "../lib/deck";

const src = process.argv[2];
if (!src) {
  console.error("使い方：npm run build:sample -- <自分用で作ったスライドの JSON>");
  process.exit(1);
}

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const res = JSON.parse(readFileSync(src, "utf8"));
let slides: DeckSlide[] = res.slides.map((s: DeckSlide) => {
  const { illustration, photoImage, ...rest } = s;
  void illustration; // 女性イラストは公開用に載せない
  const keepPhoto = photoImage && !/商品写真|PHOSSIL/.test(s.photo) ? { photoImage } : {};
  const items = s.items.map(({ photoImage: p, ...it }) => (p && !/商品写真|PHOSSIL/.test(it.photo) ? { ...it, photoImage: p } : it));
  return { ...rest, ...keepPhoto, items };
});

const slots = emptyPhotoSlots(slides).filter((slot) => !isProductSlot(slot));
console.log(`写真を ${slots.length} 枚作ります`);
for (const slot of slots) {
  // 1 分あたりの上限にかからないよう、1 枚ずつ作る
  for (let tryNo = 0; tryNo < 3; tryNo++) {
    try {
      const data = await generatePhoto(slot.desc, slot.en, slot.ratio, slot.kind);
      const image = { data, ratio: slot.ratio };
      slides = slides.map((s, i) =>
        i !== slot.slide ? s : slot.item < 0 ? { ...s, photoImage: image } : { ...s, items: s.items.map((it, j) => (j === slot.item ? { ...it, photoImage: image } : it)) },
      );
      console.log(`  ○ ${slot.desc}`);
      break;
    } catch (error) {
      console.log(`  × ${slot.desc}（${(error as Error).message.slice(0, 80)}）${tryNo < 2 ? " → 20秒待ってやり直します" : ""}`);
      await new Promise((r) => setTimeout(r, 20000));
    }
  }
}

const sample = {
  input: res.input,
  slides,
  issues: [],
  aiPhotos: false,
  blog: res.blog?.ok ? { ok: true, sources: res.blog.sources } : { ok: false, reason: "見本のため下調べはしていません。" },
  sources: res.sources ?? [],
  unreadSources: [],
};
const out = path.join(ROOT, "data", "sample-deck.json");
writeFileSync(out, JSON.stringify(sample));
console.log(`data/sample-deck.json を作りました（${(JSON.stringify(sample).length / 1e6).toFixed(2)}MB）`);
