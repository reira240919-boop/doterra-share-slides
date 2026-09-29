// デザイン見本（5月・春）の雰囲気で作るスライドの「型」と、その中身の形。
// AI はページごとに、内容に合う型（layout）を選び、この形で中身を返す（次の段階でつなぐ）。

export const DECK_LAYOUTS = {
  coverFrame: "表紙：色の枠＋淡い四角＋イラスト（5月の表紙）",
  coverSoft: "表紙：白地＋淡い四角＋大きなイラスト（春の表紙）",
  bubbles: "吹き出しの丸を散らす＋イラスト（春のお悩み）",
  circleRow: "丸を横に並べ、下にひとこと",
  flowBoxes: "見出しの帯＋四角を点線でつなぐ図＋下の帯（5月の不調）",
  pointList: "見出しの帯＋POINT＋番号リスト（5月のセルフケア）",
  labelCircles: "色のラベル＋丸3つ（写真か文字）＋下のラベル（春の肝の役割）",
  photoRow: "見出しの帯＋写真を横に並べる（ずらした色の四角）",
  headerCards: "色のラベル＋色の見出し付きカード（春のセルフケア）",
  photoFeature: "大きな写真＋右に箇条書き＋下の帯（5月の2枚目）",
  productCards: "商品写真＋番号付きカード＋色の帯（5月のタンジェリン）",
  labelNumbered: "色のラベル＋番号付きの文＋強調の一文＋写真（春のミネラル）",
  checklist: "見出し＋チェック欄付きの列（春のタイプ別チェック）",
  keyMessage: "大きな一文＋言葉を丸で強調＋イラスト（春の「不調のカギは」）",
  summaryBox: "淡い箱＋ラベル＋まとめ＋イラスト（春の今日のまとめ）",
} as const;
export type DeckLayout = keyof typeof DECK_LAYOUTS;

export type DeckItem = {
  label: string; // 丸・カード・番号の見出し（改行は \n）
  text: string; // 下のひとこと（改行は \n）
  photo: string; // 写真の枠を使う型で、どんな写真か
  photoEn?: string; // 写真の内容の英語の説明（画像の AI に渡す）
  photoImage?: DeckImage; // AI で作った写真、または商品の公式写真
};

export type DeckImage = {
  data: string; // data:image/png;base64,...
  ratio: number; // 横 ÷ 縦
  desc?: string; // どんな絵か（画面で見せる説明）
};

// ページの役目
export const DECK_TOPICS = {
  cover: "表紙",
  change: "今の時期の体の変化",
  focus: "この時期に気をつけたいこと",
  food: "おすすめの食材",
  lifestyle: "過ごし方",
  pom: "今月のPOM",
  mineral: "ドテラのミネラル",
  summary: "まとめ",
} as const;
export type DeckTopic = keyof typeof DECK_TOPICS;

export type DeckSlide = {
  topic: DeckTopic;
  layout: DeckLayout;
  section: string; // 帯やラベルに入る短い言葉（例：「セルフケア・養生法」）
  heading: string; // 見出し
  highlight: string; // 見出しの中で色を変える言葉
  lead: string; // ひとこと・説明
  items: DeckItem[];
  band: string; // 下の帯・下のラベルのひとこと
  photo: string; // 大きな写真・商品写真を使う型で、どんな写真か
  photoEn?: string;
  photoImage?: DeckImage;
  illustration?: DeckImage; // 女性イラスト（フォルダから選んだ 1 枚）
  sideImage?: DeckImage; // 添える図（ミネラルのページのウェルネスピラミッドなど）
};

export type DeckInput = {
  year: number;
  month: number;
  season: string;
  fileName: string;
  slides: DeckSlide[];
};

// ---- 写真の枠 ----
// 型ごとの写真の枠の縦横の比（横 ÷ 縦）。lib/deck-pptx.ts の枠の大きさと合わせる
const ITEM_PHOTO_RATIO: Partial<Record<DeckLayout, number>> = { photoRow: 1, labelCircles: 1, productCards: 228 / 92 };
const SLIDE_PHOTO_RATIO: Partial<Record<DeckLayout, number>> = { photoFeature: 1, labelNumbered: 380 / 230, productCards: 340 / 300 };

// item が -1 ならページの大きな写真。kind は、食材のページなら "food"（食材のアップの写真にする）
export type PhotoSlot = { slide: number; item: number; desc: string; en: string; ratio: number; kind: "food" | "scene" };

// 写真を入れる枠の一覧（まだ写真が入っていないものだけ）
export function emptyPhotoSlots(slides: DeckSlide[]): PhotoSlot[] {
  const slots: PhotoSlot[] = [];
  slides.forEach((s, i) => {
    const kind = s.topic === "food" ? "food" : "scene";
    const itemRatio = ITEM_PHOTO_RATIO[s.layout];
    if (itemRatio) {
      s.items.forEach((it, j) => {
        if (it.photo && !it.photoImage) slots.push({ slide: i, item: j, desc: it.photo, en: it.photoEn ?? "", ratio: itemRatio, kind });
      });
    }
    const slideRatio = SLIDE_PHOTO_RATIO[s.layout];
    if (slideRatio && s.photo && !s.photoImage) slots.push({ slide: i, item: -1, desc: s.photo, en: s.photoEn ?? "", ratio: slideRatio, kind });
  });
  return slots;
}

// 商品の写真の枠か（AI では作らない）
export function isProductSlot(slot: PhotoSlot): boolean {
  return /商品写真|ボトル|瓶|PHOSSIL|フォシル|パッケージ/.test(slot.desc);
}
