@AGENTS.md

## 要件

実装の指示書は `requirements.md`。仕様を変えたら `requirements.md` も合わせて直す。

## 自分用と公開用（見本）

`NEXT_PUBLIC_DATA_MODE=mine` のときだけ自分用（`lib/mode.ts` の `IS_MINE`）。案件一覧表と同じ分け方。

- 自分用：`127.0.0.1` だけで起動。合言葉なし。AI で本当にスライドと写真を作る。`distDir` は `.next-mine`
- 公開用（Vercel）：合言葉なし。`data/sample-deck.json`（9 月の見本）を返すだけ。AI・資料・キーは使わない。Vercel に `NEXT_PUBLIC_DATA_MODE` を設定しないこと
- 自分用はログイン時に自動で起動している：`~/Library/LaunchAgents/com.m39.doterra-slides-mine.plist`（`npm run start:mine` を 3201 で実行し、止まったら起動し直す）。ログは `~/Library/Logs/doterra-slides-mine.*.log`。止める：`launchctl bootout gui/$(id -u)/com.m39.doterra-slides-mine`

## コマンド

- `npm run dev` — 公開用（見本）を http://localhost:3200 で起動
- `npm run dev:mine` — 自分用を開発モードで http://localhost:3202 に起動
- `npm run mine:update` — 自分用を組み立て直して、自動起動している方（3201）を再起動する。自分用に効くコードを直したら実行する
- `npm run build` — 公開用の本番ビルド
- `npm run typecheck` — 型チェック
- `npm run build:knowledge` — 体質の PDF を文字にして `private/knowledge.json` を作る（画像だけのページは AI で読む）
- `python3 scripts/build-illustrations.py` — 女性イラストの小さいコピーと印（`private/illustrations*`）を作る
- `npm run build:sample -- <自分用で作った JSON>` — 公開用の見本 `data/sample-deck.json` を作る（写真を AI で作る）

## 構成

- `app/api/generate/route.ts` — スライドの中身を作る（自分用）／見本を返す（公開用）
- `app/api/photo/route.ts` — 写真 1 枚を AI で作る（自分用だけ）。画面から枠ごとに呼ぶ
- `lib/slides.ts` — AI への指示と、できた中身の確認（言い方・専門用語・商品名・必ず入れるページ）
- `lib/deck.ts` — ページの型（15 種類）と中身の形、写真の枠の一覧
- `lib/deck-pptx.ts` — 型ごとの PowerPoint の配置（1280×720 の点で書き、1 インチ＝96 点で置く）
- `lib/deck-palette.ts` — 季節ごとの淡い色
- `lib/save-folder.ts` — Chrome のフォルダ保存（「ドテラスライド/2026年9月/」）

大事な決まり:

- ドテラ商品の瓶・ボトルは AI で描かない。PHOSSILミネラルは `private/products/` の公式写真を使う
- 個別の商品名（オリジナル、カシスなど）は載せない。「PHOSSILミネラル」だけ
- 診断・「治る」「効く」・飲む量は書かない（`lib/slides.ts` の `NG_WORDS`）
- 体質の PDF・女性イラスト・`private/` は公開用に載せない（`.vercelignore`・`next.config.ts`）
