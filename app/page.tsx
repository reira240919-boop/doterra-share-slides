import { getAuthState } from "@/lib/auth";
import { IS_MINE } from "@/lib/mode";
import { yearOptions } from "@/lib/slide-input";
import PassphraseForm from "./passphrase-form";
import SlideForm from "./slide-form";

// 合言葉の状態は毎回確かめる
export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await getAuthState();

  return (
    <main className="container">
      <h1>シェア会スライドを作る</h1>
      {IS_MINE ? (
        <p className="mode-note">自分用（このパソコンの中だけで動いています）</p>
      ) : (
        <p className="mode-note">公開版は見本です。「作る」を押すと、作っておいた見本のスライドを出します（AI は動かしません）。</p>
      )}

      {auth === "not-configured" && (
        <section className="card notice" role="alert">
          <h2>合言葉がまだ設定されていません</h2>
          <p>
            このままではスライドを作れません。
            <br />
            このツールを管理している人に、合言葉の設定を頼んでください。
          </p>
        </section>
      )}

      {auth === "locked" && <PassphraseForm />}

      {auth === "unlocked" && <SlideForm years={yearOptions()} />}
    </main>
  );
}
