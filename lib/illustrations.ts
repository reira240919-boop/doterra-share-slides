// 女性イラストの一覧（印付き）と、選んだ絵の読み込み。
// 元の「女性イラスト」フォルダではなく、余白を切って小さくしたコピー（private/illustrations/）を使う。
// どちらも URL では開けない。選ばれた絵だけを、自分用の画面への返事に入れて渡す（公開用では使わない）。
// 一覧とコピーは scripts/build-illustrations.py で作る。

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DeckImage } from "./deck";

export type IllustrationInfo = {
  id: string;
  ratio: number;
  desc: string;
  tags: string[];
  season: string;
};

const DIR = path.join(process.cwd(), "private", "illustrations");
const LIST = path.join(process.cwd(), "private", "illustrations.json");

// 人が描かれている絵か（四季のアイコンや花だけの絵は「人物なし」）
export const hasPerson = (x: IllustrationInfo) => !x.tags.includes("人物なし");

export async function loadIllustrationList(): Promise<IllustrationInfo[]> {
  try {
    const list = JSON.parse(await readFile(LIST, "utf8")) as IllustrationInfo[];
    return list.filter((x) => x.desc);
  } catch {
    return [];
  }
}

export async function loadIllustration(info: IllustrationInfo): Promise<DeckImage | null> {
  try {
    const buf = await readFile(path.join(DIR, `${path.basename(info.id)}.png`));
    return { data: `data:image/png;base64,${buf.toString("base64")}`, ratio: info.ratio, desc: info.desc };
  } catch {
    return null;
  }
}

// ---- イラスト用の場所がある型で、AI が絵を選ばなかったときの補い ----
// その型は右側や下にイラストの場所をとっているので、空いたままだと空白が目立つ

const NEEDS_ILLUSTRATION = new Set(["coverFrame", "coverSoft", "bubbles", "flowBoxes", "pointList", "keyMessage", "photoFeature", "summaryBox"]);

// ページの役目ごとに、合いやすい印（前にあるほど合う）
const TAGS_BY_TOPIC: Record<string, string[]> = {
  cover: ["リラックス", "飲み物・お茶", "笑顔・元気"],
  change: ["悩む・不調", "疲れ・眠い", "考える・問いかけ"],
  focus: ["悩む・不調", "考える・問いかけ", "説明する・ポイント", "疲れ・眠い"],
  food: ["食事", "料理", "飲み物・お茶"],
  lifestyle: ["眠る・休息", "リラックス", "運動・ストレッチ", "外出・散歩", "入浴", "肌・スキンケア"],
  pom: ["リラックス", "説明する・ポイント", "飲み物・お茶"],
  mineral: ["飲み物・お茶", "説明する・ポイント", "笑顔・元気"],
  summary: ["笑顔・元気", "説明する・ポイント", "リラックス"],
};

// 資料の季節の呼び方を、イラストの印の季節に合わせる
function seasonTag(season: string): string {
  if (season.includes("春")) return "春";
  if (season.includes("秋")) return "秋";
  if (season.includes("冬")) return "冬";
  return "夏";
}

// 絵が無いページのうち、補うべきページに、使っていない絵の id を選んで返す（slide の番号 → id）
export function pickMissingIllustrations(
  slides: { topic: string; layout: string; illustrationId: string }[],
  list: IllustrationInfo[],
  season: string,
): Map<number, string> {
  const used = new Set(slides.map((s) => s.illustrationId).filter(Boolean));
  const want = seasonTag(season);
  const picked = new Map<number, string>();
  slides.forEach((s, i) => {
    if (s.illustrationId || !NEEDS_ILLUSTRATION.has(s.layout)) return;
    const tags = TAGS_BY_TOPIC[s.topic] ?? [];
    const score = (x: IllustrationInfo) => {
      const t = tags.findIndex((tag) => x.tags.includes(tag));
      const tagScore = t < 0 ? 0 : 10 - t;
      const seasonScore = x.season === want ? 3 : x.season === "どの季節でも" ? 2 : 0;
      return tagScore * 10 + seasonScore;
    };
    const best = list
      .filter((x) => !used.has(x.id) && hasPerson(x) && (x.season === want || x.season === "どの季節でも"))
      .map((x) => ({ x, s: score(x) }))
      .filter((c) => c.s > 0)
      .sort((a, b) => b.s - a.s)[0]?.x;
    if (best) {
      used.add(best.id);
      picked.set(i, best.id);
    }
  });
  return picked;
}
