import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { aiPhotosEnabled } from "@/lib/ai-photo";
import type { DeckSlide } from "@/lib/deck";
import { attachMineralImages } from "@/lib/products";
import { loadIllustration, loadIllustrationList, pickMissingIllustrations } from "@/lib/illustrations";
import { loadKnowledge, pickExcerpts, unreadSources } from "@/lib/knowledge";
import { loadMineralNotes, researchBlogs } from "@/lib/mineral-research";
import { seasonOf } from "@/lib/season";
import { generateSlides, SlideGenerationError } from "@/lib/slides";
import { validateSlideInput, yearOptions } from "@/lib/slide-input";
import { IS_MINE } from "@/lib/mode";
import sampleDeck from "@/data/sample-deck.json";

// AI が文章を作るのに 2〜3 分かかることがある
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = validateSlideInput(body ?? {}, yearOptions());
  if (!result.ok) {
    return NextResponse.json(
      { error: "入力が足りない項目があります。", fieldErrors: result.errors },
      { status: 400 },
    );
  }

  // 見本（公開用）：AI は動かさず、作っておいた 9 月の見本を返す
  if (!IS_MINE) {
    return NextResponse.json({
      ...sampleDeck,
      message: `これは見本です。公開版では、何月を選んでも作っておいた「${sampleDeck.input.year}年${sampleDeck.input.month}月・${sampleDeck.input.pom}」のスライドを出します。`,
      sample: true,
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "文章を作る AI の設定（ANTHROPIC_API_KEY）がまだ入っていません。管理している人に設定を頼んでください。",
      },
      { status: 503 },
    );
  }

  const knowledge = await loadKnowledge();
  if (!knowledge) {
    return NextResponse.json(
      { error: "体質の資料のデータが見つかりません。管理している人に、資料の読み込み（npm run build:knowledge）を頼んでください。" },
      { status: 503 },
    );
  }

  const { year, month, pom } = result.value;
  const season = seasonOf(month);
  const excerpts = pickExcerpts(knowledge, month, season);

  try {
    // ミネラルの枚のために、ブログの下調べと以前のミネラル資料を用意する。
    // 商品名は載せないので、ドテラ公式サイトは読みに行かない（読み取りを断られるため）
    const [blog, mineralNotes, illustrations] = await Promise.all([researchBlogs(), loadMineralNotes(), loadIllustrationList()]);

    const { slides: generated, issues } = await generateSlides({
      year, month, pom, season, excerpts, blog, mineralNotes, illustrations,
    });

    // AI が選んだ女性イラストだけを読み込んで付ける（URL は作らず、この返事の中だけで渡す）
    // イラスト用の場所がある型で、AI が絵を選ばなかったページには、内容に合う絵を補う
    for (const [i, id] of pickMissingIllustrations(generated, illustrations, season.season)) {
      generated[i] = { ...generated[i], illustrationId: id };
    }
    const byId = new Map(illustrations.map((x) => [x.id, x]));
    const withIllustrations: DeckSlide[] = await Promise.all(
      generated.map(async ({ illustrationId, ...slide }) => {
        const info = byId.get(illustrationId);
        const illustration = info ? await loadIllustration(info) : null;
        return illustration ? { ...slide, illustration } : slide;
      }),
    );

    // ミネラルのページに、ボトルの公式写真とウェルネスピラミッドの図を付ける（AI では描かない）
    const slides = await attachMineralImages(withIllustrations);

    return NextResponse.json({
      ok: true,
      message: `${year}年${month}月・POM「${pom}」の${slides.length}枚のスライドができました。`,
      input: { year, month, pom, season: season.season },
      slides,
      issues,
      aiPhotos: aiPhotosEnabled(),
      blog: blog.ok ? { ok: true, sources: blog.sources } : { ok: false, reason: blog.reason },
      sources: excerpts.map((e) => ({ source: e.source, page: e.page })),
      unreadSources: unreadSources(knowledge),
    });
  } catch (error) {
    if (error instanceof SlideGenerationError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    // 利用残高が足りないとき（待っても直らないので、足し方を伝える）
    if (error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)) {
      return NextResponse.json(
        { error: "文章を作る AI（Anthropic）の利用残高が足りません。Anthropic の管理画面（Plans & Billing）で残高を追加してから、もう一度押してください。" },
        { status: 402 },
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "文章を作る AI の設定（ANTHROPIC_API_KEY）が正しくないようです。管理している人に確認を頼んでください。" },
        { status: 503 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "AI が混み合っています。1分ほど待ってから、もう一度押してください。" },
        { status: 503 },
      );
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return NextResponse.json(
        { error: "文章づくりに時間がかかりすぎました。もう一度押してください。" },
        { status: 504 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "文章を作れませんでした。少し待ってから、もう一度押してください。" },
      { status: 500 },
    );
  }
}
