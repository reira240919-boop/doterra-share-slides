// 公開する見本か、自分用か（npm run *:mine のときだけ自分用）。案件一覧表と同じ分け方。
// - 自分用：パソコンの中だけで動く（127.0.0.1）。資料・イラスト・ボトル写真・AI のキーを使って、本当にスライドを作る
// - 見本（公開用・Vercel）：作っておいた 9 月の見本を出すだけ。AI は動かさず、資料やキーも Vercel に載せない
// Vercel には NEXT_PUBLIC_DATA_MODE を設定しないこと（公開 URL は必ず見本になる）
export const IS_MINE = process.env.NEXT_PUBLIC_DATA_MODE === "mine";
