"use client";

import { useEffect, useRef, useState } from "react";
import { POM_MAX_LENGTH, validateSlideInput, type FieldErrors } from "@/lib/slide-input";
import { emptyPhotoSlots, isProductSlot, type DeckSlide, type PhotoSlot } from "@/lib/deck";
import SlideResult, { type GenerateResponse, type PhotoProgress } from "./slide-result";

const PHOTO_PARALLEL = 3; // 同時に作る写真の数
const RATE_LIMIT_WAIT_MS = 20000; // 1 分あたりの上限にかかったときに待つ時間
const RATE_LIMIT_RETRIES = 3;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1 つの写真の枠に、できた写真を入れた新しいスライドの並びを返す
function withPhoto(slides: DeckSlide[], slot: PhotoSlot, data: string): DeckSlide[] {
  const image = { data, ratio: slot.ratio };
  return slides.map((s, i) => {
    if (i !== slot.slide) return s;
    if (slot.item < 0) return { ...s, photoImage: image };
    return { ...s, items: s.items.map((it, j) => (j === slot.item ? { ...it, photoImage: image } : it)) };
  });
}

export default function SlideForm({ years }: { years: number[] }) {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [pom, setPom] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [photoProgress, setPhotoProgress] = useState<PhotoProgress>({ total: 0, done: 0, failed: 0, running: false, error: "" });
  const runId = useRef(0);

  function requestPhoto(slot: PhotoSlot) {
    return fetch("/api/photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desc: slot.desc, en: slot.en, ratio: slot.ratio, kind: slot.kind }),
    });
  }

  // スライドの文章が届いたら、写真の枠ごとに AI で写真を作って入れる（商品写真の枠は作らない）
  async function fillPhotos(first: GenerateResponse) {
    const id = ++runId.current;
    const slots = first.aiPhotos ? emptyPhotoSlots(first.slides).filter((slot) => !isProductSlot(slot)) : [];
    setPhotoProgress({ total: slots.length, done: 0, failed: 0, running: slots.length > 0, error: "" });
    let next = 0;
    const worker = async () => {
      while (next < slots.length && runId.current === id) {
        const slot = slots[next++];
        try {
          let res = await requestPhoto(slot);
          // 1 分あたりの上限にかかったら、少し待ってやり直す
          for (let i = 0; res.status === 429 && i < RATE_LIMIT_RETRIES && runId.current === id; i++) {
            await wait(RATE_LIMIT_WAIT_MS);
            res = await requestPhoto(slot);
          }
          const data = await res.json().catch(() => ({}));
          if (runId.current !== id) return;
          if (res.ok && data.data) {
            setResult((prev) => (prev ? { ...prev, slides: withPhoto(prev.slides, slot, data.data) } : prev));
            setPhotoProgress((p) => ({ ...p, done: p.done + 1 }));
          } else {
            setPhotoProgress((p) => ({ ...p, failed: p.failed + 1, error: data.error ?? p.error }));
          }
        } catch {
          if (runId.current === id) setPhotoProgress((p) => ({ ...p, failed: p.failed + 1, error: "通信できませんでした。" }));
        }
      }
    };
    await Promise.all(Array.from({ length: PHOTO_PARALLEL }, worker));
    if (runId.current === id) setPhotoProgress((p) => ({ ...p, running: false }));
  }
  const resultRef = useRef<HTMLDivElement>(null);

  // 待っている間、何秒たったかを出す
  useEffect(() => {
    if (!sending) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [sending]);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  function clearMessages(field: keyof FieldErrors) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError("");
    setSuccess("");
  }

  function focusFirstError(errors: FieldErrors) {
    const first = (["year", "month", "pom"] as const).find((k) => errors[k]);
    if (first) document.getElementById(first)?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setFormError("");
    setSuccess("");

    const checked = validateSlideInput({ year, month, pom }, years);
    if (!checked.ok) {
      setFieldErrors(checked.errors);
      focusFirstError(checked.errors);
      return;
    }
    setFieldErrors({});

    setResult(null);
    setSending(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.value),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(data.message ?? "スライドの文章ができました。");
        setResult(data as GenerateResponse);
        void fillPhotos(data as GenerateResponse);
      } else {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          focusFirstError(data.fieldErrors);
        }
        setFormError(data.error ?? "うまく送れませんでした。少し待ってから、もう一度押してください。");
      }
    } catch {
      setFormError("通信できませんでした。インターネットのつながりを確かめて、もう一度押してください。");
    }
    setSending(false);
  }

  return (
    <>
    <form className="card" onSubmit={handleSubmit} noValidate aria-busy={sending}>
      <h2>今月のシェア会の内容</h2>
      <p className="hint">年と月、今月のPOM（今月のおすすめアロマ）の名前を入れてください。</p>

      <div className="row">
        <div className="field">
          <label htmlFor="year">年</label>
          <select
            id="year"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              clearMessages("year");
            }}
            aria-invalid={fieldErrors.year ? true : undefined}
            aria-describedby={fieldErrors.year ? "year-error" : undefined}
            disabled={sending}
          >
            <option value="">選んでください</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
          {fieldErrors.year && (
            <p id="year-error" className="error">
              {fieldErrors.year}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="month">月</label>
          <select
            id="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              clearMessages("month");
            }}
            aria-invalid={fieldErrors.month ? true : undefined}
            aria-describedby={fieldErrors.month ? "month-error" : undefined}
            disabled={sending}
          >
            <option value="">選んでください</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
          {fieldErrors.month && (
            <p id="month-error" className="error">
              {fieldErrors.month}
            </p>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="pom">今月のPOMの名前</label>
        <input
          id="pom"
          type="text"
          value={pom}
          maxLength={POM_MAX_LENGTH + 10}
          placeholder="例：ラベンダー"
          onChange={(e) => {
            setPom(e.target.value);
            clearMessages("pom");
          }}
          aria-invalid={fieldErrors.pom ? true : undefined}
          aria-describedby={fieldErrors.pom ? "pom-error" : undefined}
          disabled={sending}
        />
        {fieldErrors.pom && (
          <p id="pom-error" className="error">
            {fieldErrors.pom}
          </p>
        )}
      </div>

      <button type="submit" disabled={sending}>
        {sending ? "作っています…" : "この月のスライドを作る"}
      </button>

      <div aria-live="polite">
        {sending && (
          <p className="waiting form-message">
            <span className="spinner" aria-hidden="true" />
            ブログの下調べをして、スライドの文章を作っています。2〜3分ほどかかります（{elapsed}秒）。
            このまま画面を閉じずにお待ちください。
          </p>
        )}
        {formError && <p className="error form-message">{formError}</p>}
        {success && <p className="success form-message">{success}</p>}
      </div>
    </form>

    {result && (
      <div ref={resultRef}>
        <SlideResult result={result} photoProgress={photoProgress} />
      </div>
    )}
    </>
  );
}
