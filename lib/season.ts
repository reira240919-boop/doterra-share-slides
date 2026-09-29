// 月 → 季節の対応表。
// 時期の区切りは「ホームドクターテキスト（体質改善）」p.94「邪気について」の表に合わせている
// （春 2〜4月／初夏〜夏 5〜7月／梅雨 7月／秋 8〜10月／冬 11〜1月）。

export type SeasonInfo = {
  season: string; // 季節の呼び方
  organ: string; // 影響を受けやすい臓（中医学）
  evil: string; // 起こりやすい外からの影響（邪気）
  climate: string; // 気候の特徴（やさしい言い方）
  keywords: string[]; // 資料からこの時期の話を拾うための言葉
};

const WINTER: SeasonInfo = {
  season: "冬",
  organ: "腎",
  evil: "寒邪（かんじゃ：冷えの影響）",
  climate: "寒さと冷え込み",
  keywords: ["冬", "腎", "寒邪", "寒", "冷え", "温め", "黒"],
};

const SPRING: SeasonInfo = {
  season: "春",
  organ: "肝",
  evil: "風邪（ふうじゃ：風の影響）",
  climate: "気温の変化と風",
  keywords: ["春", "肝", "風邪", "風", "イライラ", "巡り", "青", "酸", "目"],
};

const EARLY_SUMMER: SeasonInfo = {
  season: "初夏",
  organ: "心",
  evil: "暑邪（しょじゃ：暑さの影響）",
  climate: "気温が上がり始める",
  keywords: ["夏", "初夏", "心", "暑邪", "暑", "熱", "汗", "赤", "苦"],
};

const RAINY: SeasonInfo = {
  season: "梅雨〜夏",
  organ: "脾",
  evil: "湿邪（しつじゃ：湿気の影響）と暑邪（しょじゃ：暑さの影響）",
  climate: "湿気が多く、蒸し暑い",
  keywords: ["梅雨", "長夏", "脾", "湿邪", "湿", "むくみ", "だるさ", "夏", "暑", "胃", "消化"],
};

const MIDSUMMER: SeasonInfo = {
  season: "夏",
  organ: "心",
  evil: "暑邪（しょじゃ：暑さの影響）",
  climate: "暑さと汗",
  keywords: ["夏", "心", "暑邪", "暑", "熱", "汗", "赤", "苦", "湿"],
};

const AUTUMN: SeasonInfo = {
  season: "秋",
  organ: "肺",
  evil: "燥邪（そうじゃ：乾燥の影響）",
  climate: "空気の乾燥",
  keywords: ["秋", "肺", "燥邪", "燥", "乾燥", "潤", "咳", "肌", "白", "大腸", "便秘"],
};

const BY_MONTH: Record<number, SeasonInfo> = {
  1: WINTER,
  2: SPRING,
  3: SPRING,
  4: SPRING,
  5: EARLY_SUMMER,
  6: MIDSUMMER,
  7: RAINY,
  8: AUTUMN,
  9: AUTUMN,
  10: AUTUMN,
  11: WINTER,
  12: WINTER,
};

export function seasonOf(month: number): SeasonInfo {
  return BY_MONTH[month];
}
