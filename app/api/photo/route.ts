import OpenAI from "openai";
import { NextResponse } from "next/server";
import { aiPhotosEnabled, generatePhoto } from "@/lib/ai-photo";
import { getAuthState } from "@/lib/auth";
import { IS_MINE } from "@/lib/mode";

// 写真 1 枚を AI で作る。スライドの文章ができたあと、画面から枠ごとに呼ぶ
// （まとめて作ると時間がかかりすぎるので、1 枚ずつ分けている）
export const maxDuration = 150;

export async function POST(request: Request) {
  // 見本（公開用）では写真を作らない
  if (!IS_MINE) return NextResponse.json({ error: "見本では写真を作りません。" }, { status: 404 });
  if ((await getAuthState()) !== "unlocked") {
    return NextResponse.json({ error: "合言葉の確認が切れています。ページを開き直してください。" }, { status: 401 });
  }
  if (!aiPhotosEnabled()) {
    return NextResponse.json({ error: "写真を作る AI の設定（OPENAI_API_KEY）が入っていません。" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const desc = typeof body?.desc === "string" ? body.desc.trim().slice(0, 200) : "";
  const en = typeof body?.en === "string" ? body.en.trim().slice(0, 300) : "";
  const ratio = Number(body?.ratio);
  const kind = body?.kind === "food" ? "food" : "scene";
  if (!desc || !Number.isFinite(ratio) || ratio <= 0) {
    return NextResponse.json({ error: "写真の内容が足りません。" }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await generatePhoto(desc, en, ratio, kind) });
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) {
      return NextResponse.json({ error: "写真を作る AI のキー（OPENAI_API_KEY）が正しくないようです。" }, { status: 503 });
    }
    if (error instanceof OpenAI.RateLimitError) {
      // 1 分あたりの上限にかかったとき。画面の側で少し待ってやり直す
      return NextResponse.json({ error: "写真を作る AI が混み合っているか、使える上限に達しています。" }, { status: 429 });
    }
    if (error instanceof OpenAI.BadRequestError) {
      return NextResponse.json({ error: "この内容の写真は作れませんでした。" }, { status: 422 });
    }
    console.error(error);
    return NextResponse.json({ error: "写真を作れませんでした。" }, { status: 500 });
  }
}
