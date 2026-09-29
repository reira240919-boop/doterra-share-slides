import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { IS_MINE } from "./mode";

export const AUTH_COOKIE = "share_pass";
// 同じブラウザで合言葉を聞き直さない期間（180日）
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export function getPassphrase(): string | null {
  const value = process.env.SHARE_PASSPHRASE?.trim();
  return value ? value : null;
}

// 合言葉そのものは Cookie に入れない。合言葉から作った印だけを入れる。
// 合言葉を変えると印も変わるので、古いブラウザでは聞き直しになる。
export function makeToken(passphrase: string): string {
  return createHmac("sha256", passphrase).update("share-slides-auth-v1").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function isCorrectPassphrase(input: string, passphrase: string): boolean {
  return safeEqual(makeToken(input.trim()), makeToken(passphrase));
}

export type AuthState = "not-configured" | "locked" | "unlocked";

export async function getAuthState(): Promise<AuthState> {
  // 自分用はパソコンの中（127.0.0.1）だけで動くので、合言葉は聞かない
  if (IS_MINE) return "unlocked";
  const passphrase = getPassphrase();
  if (!passphrase) return "not-configured";
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (token && safeEqual(token, makeToken(passphrase))) return "unlocked";
  return "locked";
}
