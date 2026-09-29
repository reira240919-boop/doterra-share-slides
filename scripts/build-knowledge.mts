// 体質の PDF 4 つを、アプリが読む文字データ（private/knowledge.json）に変える前処理。
// パソコンで実行する：npm run build:knowledge
//
// - 文字が取れるページは pdftotext で取り出す。
// - 文字が取れないページ（画像だけのページ）は、ページを画像にして Claude に書き起こしてもらう。
//   書き起こした結果は private/ocr-cache/ に残し、2 回目からは API を呼ばない。
// - ANTHROPIC_API_KEY が無いときは、画像だけのページを「未読」として記録して先へ進む。

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile, mkdtemp, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Anthropic from "@anthropic-ai/sdk";

const run = promisify(execFile);

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "private");
const CACHE_DIR = path.join(OUT_DIR, "ocr-cache");

const SOURCES = [
  "ホームドクターテキスト（体質改善）.pdf",
  "体質診断の読み解きについて.pdf",
  "消化力.pdf",
  "顔と体の関係の見方.pdf",
];

// これより文字が少ないページは、画像のページとみなす
const MIN_TEXT_CHARS = 40;
const OCR_CONCURRENCY = 4;
const MODEL = "claude-opus-5-5";

const OCR_PROMPT = `この画像は、体質改善の講座資料の 1 ページです。
ページにある文字を、上から順にすべて書き起こしてください。

- 書いてある言葉をそのまま写してください。言い換え、要約、補足はしないでください。
- 表は「項目：内容」の形で 1 行ずつ書いてください。
- 図の中の文字も書いてください。文字の無いイラストの説明は不要です。
- 読めない文字は「□」にしてください。
- 文字がまったく無いページなら「（文字なし）」とだけ書いてください。
- 書き起こした文字だけを返してください。前置きは要りません。`;

type Chunk = { source: string; page: number; text: string; via: "text" | "ocr" };
type SourceSummary = {
  file: string;
  pages: number;
  textPages: number;
  ocrPages: number;
  unreadPages: number[];
};

function clean(text: string): string {
  return text
    .replace(/\f/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function countChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function pageCount(file: string): Promise<number> {
  const { stdout } = await run("pdfinfo", [file]);
  const match = stdout.match(/^Pages:\s+(\d+)/m);
  if (!match) throw new Error(`ページ数が分かりません: ${file}`);
  return Number(match[1]);
}

async function extractText(file: string, page: number): Promise<string> {
  const { stdout } = await run("pdftotext", ["-f", String(page), "-l", String(page), "-enc", "UTF-8", file, "-"], {
    maxBuffer: 20 * 1024 * 1024,
  });
  return clean(stdout);
}

async function renderPage(file: string, page: number, workDir: string): Promise<Buffer> {
  const prefix = path.join(workDir, `p${page}`);
  await run("pdftoppm", [
    "-f", String(page), "-l", String(page),
    "-r", "110", "-jpeg", "-jpegopt", "quality=80", "-singlefile",
    file, prefix,
  ]);
  const jpg = `${prefix}.jpg`;
  const data = await readFile(jpg);
  await rm(jpg, { force: true });
  return data;
}

async function ocrPage(client: Anthropic, image: Buffer): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image.toString("base64") } },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("AI が書き起こしを断りました");
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return clean(text);
}

// 同時に動かす数を絞って順に処理する
async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

async function main() {
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  if (!client) {
    console.log("※ ANTHROPIC_API_KEY が無いので、画像だけのページは読まずに進めます。");
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const workDir = await mkdtemp(path.join(tmpdir(), "knowledge-"));

  const chunks: Chunk[] = [];
  const summaries: SourceSummary[] = [];

  try {
    for (const [index, file] of SOURCES.entries()) {
      const filePath = path.join(ROOT, file);
      if (!(await exists(filePath))) {
        console.log(`× 見つかりません: ${file}`);
        summaries.push({ file, pages: 0, textPages: 0, ocrPages: 0, unreadPages: [] });
        continue;
      }

      const pages = await pageCount(filePath);
      const summary: SourceSummary = { file, pages, textPages: 0, ocrPages: 0, unreadPages: [] };
      const needOcr: number[] = [];

      for (let page = 1; page <= pages; page++) {
        const text = await extractText(filePath, page);
        if (countChars(text) >= MIN_TEXT_CHARS) {
          chunks.push({ source: file, page, text, via: "text" });
          summary.textPages++;
        } else {
          needOcr.push(page);
        }
      }

      const cacheDir = path.join(CACHE_DIR, String(index + 1));
      await mkdir(cacheDir, { recursive: true });

      await runLimited(needOcr, OCR_CONCURRENCY, async (page) => {
        const cacheFile = path.join(cacheDir, `${page}.txt`);
        let text: string | null = null;

        if (await exists(cacheFile)) {
          text = await readFile(cacheFile, "utf8");
        } else if (client) {
          try {
            const image = await renderPage(filePath, page, workDir);
            text = await ocrPage(client, image);
            await writeFile(cacheFile, text, "utf8");
            process.stdout.write(`  読み取り: ${file} p.${page}\n`);
          } catch (error) {
            console.log(`  × 読み取り失敗: ${file} p.${page}（${(error as Error).message}）`);
          }
        }

        if (text === null) {
          summary.unreadPages.push(page);
          return;
        }
        summary.ocrPages++;
        if (countChars(text) > 0 && !text.includes("（文字なし）")) {
          chunks.push({ source: file, page, text, via: "ocr" });
        }
      });

      summary.unreadPages.sort((a, b) => a - b);
      summaries.push(summary);
      console.log(
        `○ ${file}：${pages}ページ（文字 ${summary.textPages}／画像から ${summary.ocrPages}／未読 ${summary.unreadPages.length}）`,
      );
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  chunks.sort((a, b) => SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source) || a.page - b.page);

  const output = { builtAt: new Date().toISOString(), sources: summaries, chunks };
  await writeFile(path.join(OUT_DIR, "knowledge.json"), JSON.stringify(output), "utf8");
  console.log(`\nprivate/knowledge.json を作りました（${chunks.length} ページ分）。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
