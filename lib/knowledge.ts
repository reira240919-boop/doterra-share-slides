// 体質の PDF から取り出した文字データ（private/knowledge.json）を読み、
// 指定した月に関係するページを拾う。
// knowledge.json は npm run build:knowledge で作る。URL では開けない場所に置いている。

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SeasonInfo } from "./season";

type Chunk = { source: string; page: number; text: string; via: "text" | "ocr" };
type SourceSummary = {
  file: string;
  pages: number;
  textPages: number;
  ocrPages: number;
  unreadPages: number[];
};
type KnowledgeFile = { builtAt: string; sources: SourceSummary[]; chunks: Chunk[] };

export type Excerpt = { id: number; source: string; page: number; text: string };
export type UnreadSource = { file: string; unread: number; pages: number };

// AI に渡す資料の量の上限（多すぎると要点がぼやける）
const MAX_PAGES = 14;
const MAX_CHARS = 26000;

const KNOWLEDGE_PATH = path.join(process.cwd(), "private", "knowledge.json");

export async function loadKnowledge(): Promise<KnowledgeFile | null> {
  try {
    return JSON.parse(await readFile(KNOWLEDGE_PATH, "utf8")) as KnowledgeFile;
  } catch {
    return null;
  }
}

// 画像だけで、まだ文字にできていないページがある資料
export function unreadSources(knowledge: KnowledgeFile): UnreadSource[] {
  return knowledge.sources
    .filter((s) => s.unreadPages.length > 0)
    .map((s) => ({ file: s.file, unread: s.unreadPages.length, pages: s.pages }));
}

function countOf(text: string, word: string): number {
  if (!word) return 0;
  return text.split(word).length - 1;
}

// その月・季節の言葉が多く出てくるページほど高い点にする
function score(text: string, month: number, season: SeasonInfo): number {
  let total = 0;
  total += countOf(text, `${month}月`) * 6;
  total += countOf(text, season.season) * 4;
  total += countOf(text, season.organ) * 3;
  for (const word of season.keywords) total += countOf(text, word);
  // 文字数の多いページが有利になりすぎないよう、長さで少しならす
  return total / Math.sqrt(Math.max(text.length, 200) / 200);
}

export function pickExcerpts(knowledge: KnowledgeFile, month: number, season: SeasonInfo): Excerpt[] {
  const ranked = knowledge.chunks
    .map((chunk) => ({ chunk, points: score(chunk.text, month, season) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points);

  const picked: Chunk[] = [];
  let chars = 0;
  for (const { chunk } of ranked) {
    if (picked.length >= MAX_PAGES) break;
    if (chars + chunk.text.length > MAX_CHARS) continue;
    picked.push(chunk);
    chars += chunk.text.length;
  }

  const order = knowledge.sources.map((s) => s.file);
  picked.sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source) || a.page - b.page);
  return picked.map((c, i) => ({ id: i + 1, source: c.source, page: c.page, text: c.text }));
}
