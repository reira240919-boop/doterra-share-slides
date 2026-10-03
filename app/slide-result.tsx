"use client";

import { useEffect, useState } from "react";
import type { UnreadSource } from "@/lib/knowledge";
import { DECK_LAYOUTS, DECK_TOPICS, type DeckSlide } from "@/lib/deck";
import { buildDeckBlob, deckFileName, downloadBlob } from "@/lib/deck-pptx";
import { canSaveToFolder, FolderPickCanceled, pickFolder, savedFolderName, saveToMonthFolder } from "@/lib/save-folder";
import type { WordingIssue } from "@/lib/slides";

export type GenerateResponse = {
  message: string;
  input: { year: number; month: number; pom: string; season: string };
  slides: DeckSlide[];
  issues: WordingIssue[];
  aiPhotos: boolean;
  sample?: boolean; // 公開用の見本のとき
  blog: { ok: true; sources: { title: string; url: string }[] } | { ok: false; reason: string };
  sources: { source: string; page: number }[];
  unreadSources: UnreadSource[];
};

// 見出しの中の強調する言葉だけ色を変える
function Highlighted({ text, word }: { text: string; word: string }) {
  const at = word ? text.indexOf(word) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="highlight-word">{word}</span>
      {text.slice(at + word.length)}
    </>
  );
}

// PowerPoint を担当者のパソコンに保存するボタン（F-06）
// Chrome では、選んだフォルダ（デスクトップの「ドテラスライド」）の中の年月フォルダに保存する
function SavePptx({ result, photoProgress }: { result: GenerateResponse; photoProgress: PhotoProgress }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [folderSupported, setFolderSupported] = useState(false);
  const { year, month, pom, season } = result.input;
  const monthName = `${result.input.year}年${result.input.month}月`;

  useEffect(() => {
    setFolderSupported(canSaveToFolder());
    savedFolderName().then(setFolder);
  }, []);

  // 写真を作っている間は保存させない（できていない写真が点線の枠のまま残るため）
  const photosRunning = photoProgress.running;

  async function handleSave() {
    if (saving || photosRunning) return;
    setSaving(true);
    setDone("");
    setError("");
    try {
      const fileName = deckFileName(year, month, pom);
      const blob = await buildDeckBlob({ year, month, season, fileName, slides: result.slides });
      if (canSaveToFolder()) {
        const place = await saveToMonthFolder({ year, month, fileName, blob });
        setFolder(await savedFolderName());
        setDone(`PowerPoint を保存しました（${place}）。`);
      } else {
        downloadBlob(blob, fileName);
        setDone(`PowerPoint を保存しました（${fileName}）。ブラウザの「ダウンロード」フォルダを見てください。`);
      }
    } catch (e) {
      if (e instanceof FolderPickCanceled) {
        setError("保存先のフォルダが選ばれなかったので、保存していません。もう一度押して、デスクトップの「ドテラスライド」を選んでください。");
      } else {
        console.error(e);
        setError("PowerPoint を保存できませんでした。もう一度押してください。続くときは「保存先を選び直す」を押してから試してください。");
      }
    }
    setSaving(false);
  }

  async function handleChangeFolder() {
    setDone("");
    setError("");
    try {
      await pickFolder();
      setFolder(await savedFolderName());
    } catch (e) {
      if (!(e instanceof FolderPickCanceled)) setError("保存先を選べませんでした。もう一度試してください。");
    }
  }

  return (
    <div className="save-box">
      <button type="button" onClick={handleSave} disabled={saving || photosRunning}>
        {saving
          ? "PowerPoint を保存しています…"
          : photosRunning
            ? `写真ができるまでお待ちください（${photoProgress.done + photoProgress.failed}/${photoProgress.total}）`
            : `PowerPoint を保存（${result.slides.length}枚）`}
      </button>
      {folderSupported ? (
        <p className="hint save-hint">
          {folder
            ? `保存先：「${folder}」の中の「${monthName}」フォルダ（無ければ作ります）`
            : `初めてのときは保存先を聞かれます。デスクトップの「ドテラスライド」を選んで「編集を許可」を押してください。次からは「${monthName}」のような年月フォルダに自動で保存します。`}
          {folder && (
            <>
              {" "}
              <button type="button" className="link-button" onClick={handleChangeFolder} disabled={saving}>
                保存先を選び直す
              </button>
            </>
          )}
        </p>
      ) : (
        <p className="hint save-hint">このブラウザでは、「ダウンロード」フォルダに保存します（Chrome なら年月フォルダに保存できます）。</p>
      )}
      <p className="hint save-hint">保存したファイルは、キャンバの「アップロード」から読み込むと、文字や配置を直せます。</p>
      <div aria-live="polite">
        {done && <p className="success form-message">{done}</p>}
        {error && <p className="error form-message">{error}</p>}
      </div>
    </div>
  );
}

export type PhotoProgress = { total: number; done: number; failed: number; running: boolean; error: string };

// 写真づくりの進み具合
function PhotoStatus({ result, progress }: { result: GenerateResponse; progress: PhotoProgress }) {
  if (result.sample) return null;
  if (!result.aiPhotos) {
    return (
      <div className="check check-warn">
        <p className="check-title">写真はまだ入っていません</p>
        <p>写真を作る AI の設定（OPENAI_API_KEY）が入っていないため、写真の場所は点線の枠のままです。</p>
      </div>
    );
  }
  if (progress.total === 0) return null;
  if (progress.running) {
    return (
      <p className="waiting form-message" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        写真を AI で作っています（{progress.done + progress.failed}/{progress.total}）。1〜3分ほどかかります。
        写真ができあがると、保存ボタンを押せるようになります。
      </p>
    );
  }
  return (
    <div className={progress.failed > 0 ? "check check-warn" : "check"} aria-live="polite">
      <p className="check-title">写真ができました（{progress.done}/{progress.total}枚）</p>
      {progress.failed > 0 && <p>{progress.failed}枚は作れなかったので、点線の枠のままです。{progress.error}</p>}
    </div>
  );
}

export default function SlideResult({ result, photoProgress }: { result: GenerateResponse; photoProgress: PhotoProgress }) {
  return (
    <section className="result" aria-labelledby="result-heading">
      <h2 id="result-heading">
        {result.input.year}年{result.input.month}月（{result.input.season}）・POM「{result.input.pom}」
      </h2>

      <SavePptx result={result} photoProgress={photoProgress} />

      {result.issues.length > 0 && (
        <div className="check check-warn" role="alert">
          <p className="check-title">言い方を確かめてほしい所があります</p>
          <p>自動で1回書き直しましたが、まだ次の言い方が残っています。使う前に言い換えてください。</p>
          <ul>
            {result.issues.map((i, n) => (
              <li key={n}>
                {i.slide}：「{i.text}」— {i.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.unreadSources.length > 0 && (
        <div className="check check-warn">
          <p className="check-title">まだ読めていない資料があります</p>
          <p>次の資料は画像だけのページがあり、今回の文章には使えていません。</p>
          <ul>
            {result.unreadSources.map((s) => (
              <li key={s.file}>
                {s.file}（{s.pages}ページ中 {s.unread}ページ）
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="slides">
        {result.slides.map((slide, n) => (
          <li key={n} className="slide">
            <p className="slide-label">
              {n + 1}枚目　{DECK_TOPICS[slide.topic]}
              <span className="slide-layout">{DECK_LAYOUTS[slide.layout].split("（")[0]}</span>
            </p>
            {slide.section && <p className="slide-section">{slide.section}</p>}
            <h3 className="slide-title">
              <Highlighted text={slide.heading} word={slide.highlight} />
            </h3>
            {slide.lead && <p className="slide-lead">{slide.lead}</p>}
            {slide.items.length > 0 && (
              <ul className="slide-items">
                {slide.items.map((it, i) => (
                  <li key={i}>
                    <span className="item-label">{it.label}</span>
                    {it.text && <span className="item-text">{it.text}</span>}
                    {it.photo && <span className="item-photo">写真：{it.photo}</span>}
                  </li>
                ))}
              </ul>
            )}
            {slide.band && <p className="slide-band">{slide.band}</p>}
            {slide.photo && <p className="item-photo">写真：{slide.photo}</p>}
            {slide.illustration?.desc && <p className="item-photo">イラスト：{slide.illustration.desc}</p>}
          </li>
        ))}
      </ol>

      <PhotoStatus result={result} progress={photoProgress} />

      {result.blog.ok ? (
        <details className="sources">
          <summary>ミネラルの枚で参考にしたブログ・記事（{result.blog.sources.length}件）</summary>
          {result.blog.sources.length > 0 ? (
            <ul>
              {result.blog.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>引用したアドレスは記録されませんでした。</p>
          )}
        </details>
      ) : (
        <div className="check check-warn">
          <p className="check-title">ブログの下調べはできませんでした</p>
          <p>{result.blog.reason} ミネラルの枚は、公式の商品ページと一般的な栄養の話だけで作っています。</p>
        </div>
      )}

      <details className="sources">
        <summary>文章づくりに使った資料のページ（{result.sources.length}ページ）</summary>
        <ul>
          {result.sources.map((s) => (
            <li key={`${s.source}-${s.page}`}>
              {s.source}　{s.page}ページ
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
