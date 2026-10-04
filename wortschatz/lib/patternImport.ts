import type { PatternCase } from "./types";

// 패턴 엑셀 가져오기 파싱 (순수 함수)

export type PatternParts = {
  verb: string;
  reflexive: boolean;
  preposition: string;
  pattern_case: PatternCase;
};

export type ParsedPatternRow = {
  pattern: PatternParts & { meaning: string };
  examples: { sentence: string; translation: string | null }[];
};

const CASE_ALIASES: Record<string, PatternCase> = {
  akk: "Akk",
  akkusativ: "Akk",
  "4격": "Akk",
  dat: "Dat",
  dativ: "Dat",
  "3격": "Dat",
  gen: "Gen",
  genitiv: "Gen",
  "2격": "Gen",
};

const TRUE_WORDS = new Set(["o", "y", "yes", "true", "1", "x", "v", "✓", "sich", "재귀", "예"]);

export function parseCase(token: string): PatternCase | null {
  return CASE_ALIASES[token.trim().toLowerCase().replace(/\.$/, "")] ?? null;
}

// "sich auf + Akk. freuen", "teilnehmen an + Dat." 형태의 문자열을 분해한다.
export function parsePatternText(text: string): PatternParts | null {
  const t = text.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!t) return null;
  const refl = /^sich\s+([^\s+]+)\s*\+\s*(\S+)\s+(.+)$/i.exec(t);
  if (refl) {
    const c = parseCase(refl[2]);
    if (c) return { verb: refl[3].trim(), reflexive: true, preposition: refl[1], pattern_case: c };
  }
  const plain = /^(.+?)\s+([^\s+]+)\s*\+\s*(\S+)$/.exec(t);
  if (plain) {
    const c = parseCase(plain[3]);
    if (c) return { verb: plain[1].trim(), reflexive: false, preposition: plain[2], pattern_case: c };
  }
  return null;
}

// 중복 판정용 키
export function patternKey(p: PatternParts): string {
  return [p.reflexive ? "1" : "0", p.verb, p.preposition, p.pattern_case]
    .join("|")
    .normalize("NFC")
    .toLowerCase();
}

const str = (v: unknown) => String(v ?? "").trim();

// 한 행을 해석한다. 필수(패턴 또는 동사+전치사+격, 그리고 뜻)가 없으면 null.
// 열: "패턴"(권장) 또는 "동사"/"재귀"/"전치사"/"격", "뜻", "예문N"/"예문N뜻"
export function parsePatternRow(row: Record<string, unknown>): ParsedPatternRow | null {
  const meaning = str(row["뜻"]);
  if (!meaning) return null;

  let parts = parsePatternText(str(row["패턴"]));
  if (!parts && !str(row["패턴"])) {
    let verb = str(row["동사"]);
    const preposition = str(row["전치사"]);
    const c = parseCase(str(row["격"]));
    let reflexive = TRUE_WORDS.has(str(row["재귀"]).toLowerCase());
    if (/^sich\s+/i.test(verb)) {
      verb = verb.replace(/^sich\s+/i, "");
      reflexive = true;
    }
    if (verb && preposition && c) parts = { verb, reflexive, preposition, pattern_case: c };
  }
  if (!parts) return null;

  // "예문"으로 시작하고 "뜻"으로 끝나지 않는 열이 독일어 예문, "<열 이름>뜻"이 그 예문의 뜻
  const examples = Object.keys(row)
    .filter((k) => k.startsWith("예문") && !k.endsWith("뜻"))
    .map((k) => ({ sentence: str(row[k]), translation: str(row[`${k}뜻`]) || null }))
    .filter((e) => e.sentence);

  return { pattern: { ...parts, meaning }, examples };
}

// 가져오기에 실패한 행의 이유 (사용자에게 보여줄 한 줄)
export function explainPatternRowFailure(row: Record<string, unknown>): string {
  if (!str(row["뜻"])) return "뜻이 비어 있음";
  const text = str(row["패턴"]);
  if (text) return `패턴을 해석하지 못함: "${text}"`;
  return "패턴 열이 없거나 동사/전치사/격이 비어 있음";
}
