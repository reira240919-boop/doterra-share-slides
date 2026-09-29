"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function PassphraseForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!passphrase.trim()) {
      setError("合言葉を入れてください。");
      inputRef.current?.focus();
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "確認できませんでした。もう一度入れてください。");
      setPassphrase("");
      inputRef.current?.focus();
    } catch {
      setError("通信できませんでした。インターネットのつながりを確かめて、もう一度押してください。");
    }
    setSending(false);
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>合言葉を入れてください</h2>
      <p className="hint">シェア会の担当者だけが使える画面です。一度通れば、このブラウザでは次から聞きません。</p>

      <div className="field">
        <label htmlFor="passphrase">合言葉</label>
        <input
          ref={inputRef}
          id="passphrase"
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(e) => {
            setPassphrase(e.target.value);
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "passphrase-error" : undefined}
          disabled={sending}
          autoFocus
        />
        {error && (
          <p id="passphrase-error" className="error" role="alert">
            {error}
          </p>
        )}
      </div>

      <button type="submit" disabled={sending}>
        {sending ? "確認しています…" : "入る"}
      </button>
    </form>
  );
}
