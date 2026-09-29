import type { NextConfig } from "next";

const IS_MINE = process.env.NEXT_PUBLIC_DATA_MODE === "mine";

const nextConfig: NextConfig = {
  // 自分用（npm run *:mine）は作業フォルダを分けて、見本と同時に起動してもぶつからないようにする
  distDir: IS_MINE ? ".next-mine" : ".next",
  // 体質の PDF・女性イラストの元ファイル・見本の PDF は、サーバーの処理に同梱しない。公開用（見本）は private/ も同梱しない
  outputFileTracingExcludes: {
    "*": ["./*.pdf", "./女性イラスト/**", "./デザイン見本/**", "./内容の流れ_見本/**", ...(IS_MINE ? [] : ["./private/**"])],
  },
  // 自分用だけ、スライドを作る処理が資料・イラスト・ボトル写真を読む（URL では開けない）
  ...(IS_MINE
    ? {
        outputFileTracingIncludes: {
          "/api/generate": ["./private/knowledge.json", "./private/mineral-notes.md", "./private/illustrations.json", "./private/illustrations/**", "./private/products/**"],
        },
      }
    : {}),
};

export default nextConfig;
