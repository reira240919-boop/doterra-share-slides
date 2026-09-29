import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  getPassphrase,
  isCorrectPassphrase,
  makeToken,
} from "@/lib/auth";

export async function POST(request: Request) {
  const passphrase = getPassphrase();
  if (!passphrase) {
    return NextResponse.json(
      { error: "合言葉がまだ設定されていません。管理している人に設定を頼んでください。" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const input = typeof body?.passphrase === "string" ? body.passphrase : "";

  if (!input.trim()) {
    return NextResponse.json({ error: "合言葉を入れてください。" }, { status: 400 });
  }

  if (!isCorrectPassphrase(input, passphrase)) {
    return NextResponse.json(
      { error: "合言葉が違います。もう一度入れてください。" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, makeToken(passphrase), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  return response;
}
