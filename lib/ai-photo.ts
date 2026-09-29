// 食材・過ごし方の写真を、OpenAI の画像の AI で作る（F-09）。
// キーは環境変数 OPENAI_API_KEY に置く（値はファイルに書かない）。
// 写真の雰囲気は、デザイン見本に合わせて「明るい自然光・白やベージュ・文字やロゴなし」にそろえる。
// ドテラの商品（瓶・ボトル・パッケージ）は AI で描かない（requirements.md の決まり）。

import OpenAI from "openai";

const MODEL = "gpt-image-2.5-flare";

export function aiPhotosEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// 枠の縦横の比に合う大きさ（16 の倍数、比は 1:3〜3:1 まで）
function sizeFor(ratio: number): string {
  const r = Math.min(3, Math.max(1 / 3, ratio));
  const round16 = (n: number) => Math.max(256, Math.round(n / 16) * 16);
  if (Math.abs(r - 1) < 0.1) return "1024x1024";
  return r > 1 ? `1536x${round16(1536 / r)}` : `${round16(1536 * r)}x1536`;
}

export type PhotoKind = "food" | "scene";

function buildPrompt(desc: string, en: string, kind: PhotoKind): string {
  const subject = `Subject: ${desc}${en ? ` (${en})` : ""}.`;
  const common = [
    "Photorealistic. No text, no letters, no logos, no labels, no watermarks.",
    "Do not show any product bottles, supplement bottles, essential oil bottles or branded packaging.",
  ];
  if (kind === "food") {
    // 見本の食材写真のように：白い器・白っぽい背景・食材だけを大きく
    return [
      "A clean close-up food photograph of a single ingredient for a wellness seminar slide.",
      subject,
      "The food fills most of the frame, on a simple white plate or small white bowl, on a plain white or light cream background.",
      "Soft bright natural light, gentle soft shadow, fresh and appetizing, high detail, slightly from above (about 45 degrees).",
      "No people, no hands, no room interior, no other dishes, minimal props.",
      ...common,
    ].join(" ");
  }
  return [
    "A soft, bright lifestyle photograph for a gentle wellness seminar slide.",
    subject,
    "Natural window light, airy and calm, warm neutral tones (white, beige, soft wood), shallow depth of field, simple uncluttered background, Japanese atmosphere.",
    "If people appear, show hands or figures from behind, not close-up faces.",
    ...common,
  ].join(" ");
}

export class PhotoGenerationError extends Error {}

export async function generatePhoto(desc: string, en: string, ratio: number, kind: PhotoKind = "scene"): Promise<string> {
  const client = new OpenAI({ timeout: 110 * 1000, maxRetries: 1 });
  const res = await client.images.generate({
    model: MODEL,
    prompt: buildPrompt(desc, en, kind),
    size: sizeFor(ratio),
    quality: "medium",
    output_format: "jpeg",
    output_compression: 82,
    n: 1,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new PhotoGenerationError("写真を受け取れませんでした");
  return `data:image/jpeg;base64,${b64}`;
}
