export const POM_MAX_LENGTH = 30;

export type SlideInput = { year: number; month: number; pom: string };
export type FieldErrors = Partial<Record<"year" | "month" | "pom", string>>;

// 選べる年：今年の前後1年
export function yearOptions(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y - 1, y, y + 1];
}

// 画面とサーバーの両方で同じ確認をする
export function validateSlideInput(
  raw: { year?: unknown; month?: unknown; pom?: unknown },
  allowedYears: number[],
): { ok: true; value: SlideInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const year = Number(raw.year);
  if (raw.year === "" || raw.year == null) errors.year = "年を選んでください。";
  else if (!allowedYears.includes(year)) errors.year = "選べる年の中から選んでください。";

  const month = Number(raw.month);
  if (raw.month === "" || raw.month == null) errors.month = "月を選んでください。";
  else if (!Number.isInteger(month) || month < 1 || month > 12)
    errors.month = "1月から12月の中から選んでください。";

  const pom = typeof raw.pom === "string" ? raw.pom.trim() : "";
  if (!pom) errors.pom = "今月のPOMの名前を入れてください。";
  else if (pom.length > POM_MAX_LENGTH)
    errors.pom = `POMの名前は${POM_MAX_LENGTH}文字までで入れてください。`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { year, month, pom } };
}
