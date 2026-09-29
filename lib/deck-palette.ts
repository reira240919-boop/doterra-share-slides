// デザイン見本の淡い色味で、季節ごとの色をそろえる。
// 春＝春の見本のピンク、初夏＝5月の見本の青、秋＝9月の案のピーチ。夏・梅雨・冬は同じ淡さで作った色。

export type DeckPalette = {
  band: string; // 見出しの帯・ラベル（白い文字をのせる）
  deep: string; // 流れ図の四角・カードの見出し（白い文字をのせる）
  soft: string; // 丸・ずらした四角
  softer: string; // 淡い箱・カードの地
  accent: string; // 強調の文字
  text: string;
  muted: string;
  line: string;
};

const P: Record<string, DeckPalette> = {
  春: { band: "E2B5C0", deep: "C7868F", soft: "F7E3E8", softer: "FCF3F5", accent: "C8677D", text: "55474B", muted: "9A8A8F", line: "EDD0D7" },
  初夏: { band: "9DB9D8", deep: "717C93", soft: "E4ECF5", softer: "F3F7FB", accent: "5E82B3", text: "4B5160", muted: "8D94A1", line: "CCDAEA" },
  夏: { band: "9CCFC4", deep: "6F958D", soft: "E2F2EE", softer: "F2F9F7", accent: "4E9C8C", text: "45514F", muted: "86958F", line: "C6E3DC" },
  "梅雨〜夏": { band: "B6ADD8", deep: "857CA8", soft: "ECE8F6", softer: "F6F4FB", accent: "7C6FB5", text: "4D4959", muted: "908B9C", line: "D8D2EC" },
  秋: { band: "E2B79C", deep: "A88A7A", soft: "F8EAE1", softer: "FCF5F1", accent: "D98A5E", text: "5B4E47", muted: "9A8C84", line: "EBD3C4" },
  冬: { band: "A9B6CF", deep: "6F7C98", soft: "E8ECF3", softer: "F4F6FA", accent: "5F73A0", text: "474B57", muted: "8B909C", line: "D0D8E6" },
};

export function deckPalette(season: string): DeckPalette {
  return P[season] ?? P["秋"];
}
