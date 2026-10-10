import { IS_MINE } from "@/lib/mode";
import { yearOptions } from "@/lib/slide-input";
import SlideForm from "./slide-form";

// 年の選択肢（去年・今年・来年）を、開いた日に合わせて毎回作る
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="container">
      <h1>シェア会スライドを作る</h1>
      {IS_MINE ? (
        <p className="mode-note">自分用（このパソコンの中だけで動いています）</p>
      ) : (
        <p className="mode-note">公開版は見本です。「作る」を押すと、作っておいた見本のスライドを出します（AI は動かしません）。</p>
      )}

      <SlideForm years={yearOptions()} />
    </main>
  );
}
