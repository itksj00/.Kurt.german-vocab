import type { PatternCase, PatternType } from "./types";

// 패턴 엑셀 가져오기 파싱 (순수 함수)
// 열: 유형 · 앞말(동사/명사/형용사) · 재귀 · 전치사 · 격 · 표현 · 뜻 · 메모 · 예문N · 예문N뜻
// "패턴" 한 칸(sich auf + Akk. freuen / aufgrund + Gen.)으로 적는 방식도 계속 인식한다.

export type PatternFields = {
  pattern_type: PatternType;
  verb: string | null;
  reflexive: boolean;
  preposition: string | null;
  pattern_case: PatternCase | null;
};

export type ParsedPatternRow = {
  pattern: PatternFields & { expression: string | null; note: string | null; meaning: string };
  examples: { sentence: string; translation: string | null }[];
};

const CASE_ALIASES: Record<string, PatternCase> = {
  akk: "Akk", akkusativ: "Akk", "4격": "Akk",
  dat: "Dat", dativ: "Dat", "3격": "Dat",
  gen: "Gen", genitiv: "Gen", "2격": "Gen",
};

const TYPE_ALIASES: Record<string, PatternType> = {
  동사: "verb", 재귀동사: "verb", verb: "verb",
  명사: "noun", 형용사: "noun", 명사구: "noun", "명사/형용사": "noun", "명사·형용사": "noun", noun: "noun", adj: "noun", adjektiv: "noun", nomen: "noun",
  전치사: "prep", prep: "prep", präposition: "prep",
  접속사: "conj", 연결: "conj", 연결표현: "conj", conj: "conj", konjunktion: "conj", konnektor: "conj",
};

const TRUE_WORDS = new Set(["o", "y", "yes", "true", "1", "x", "v", "✓", "sich", "재귀", "예"]);

const str = (v: unknown) => String(v ?? "").trim();

export function parseCase(token: string): PatternCase | null {
  return CASE_ALIASES[token.trim().toLowerCase().replace(/\.$/, "")] ?? null;
}

export function parseType(token: string): PatternType | null {
  return TYPE_ALIASES[token.trim().toLowerCase().replace(/\s+/g, "")] ?? null;
}

// "sich auf + Akk. freuen", "teilnehmen an + Dat.", "aufgrund + Gen." 형태를 분해한다.
export function parsePatternText(text: string): PatternFields | null {
  const t = text.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!t) return null;
  const refl = /^sich\s+([^\s+]+)\s*\+\s*(\S+)\s+(.+)$/i.exec(t);
  if (refl) {
    const c = parseCase(refl[2]);
    if (c) return { pattern_type: "verb", verb: refl[3].trim(), reflexive: true, preposition: refl[1], pattern_case: c };
  }
  const plain = /^(.+?)\s+([^\s+]+)\s*\+\s*(\S+)$/.exec(t);
  if (plain) {
    const c = parseCase(plain[3]);
    if (c) return { pattern_type: "verb", verb: plain[1].trim(), reflexive: false, preposition: plain[2], pattern_case: c };
  }
  const prepOnly = /^([^\s+]+)\s*\+\s*(\S+)$/.exec(t);
  if (prepOnly) {
    const c = parseCase(prepOnly[2]);
    if (c) return { pattern_type: "prep", verb: null, reflexive: false, preposition: prepOnly[1], pattern_case: c };
  }
  return null;
}

// 중복 판정용 키
export function patternKey(p: PatternFields & { expression?: string | null }): string {
  return [p.pattern_type, p.reflexive ? "1" : "0", p.verb ?? "", p.preposition ?? "", p.pattern_case ?? "", p.expression ?? ""]
    .join("|")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const ELLIPSIS = /…|\.{3}|~/;

function firstOf(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = str(row[k]);
    if (v) return v;
  }
  return "";
}

const HEAD_KEYS = ["앞말", "동사", "명사", "형용사", "핵심어"];

// 열로 나눠 적은 행 → 필드. 유형별 필수 칸이 비어 있으면 null.
function fromColumns(type: PatternType, row: Record<string, unknown>): PatternFields | null {
  const prepCol = str(row["전치사"]);
  const c = parseCase(str(row["격"]));
  let head = firstOf(row, HEAD_KEYS);
  if (type === "prep") {
    const preposition = prepCol || head;
    return preposition && c
      ? { pattern_type: "prep", verb: null, reflexive: false, preposition, pattern_case: c }
      : null;
  }
  let reflexive = type === "verb" && TRUE_WORDS.has(str(row["재귀"]).toLowerCase());
  if (type === "verb" && /^sich\s+/i.test(head)) {
    head = head.replace(/^sich\s+/i, "");
    reflexive = true;
  }
  return head && prepCol && c
    ? { pattern_type: type, verb: head, reflexive, preposition: prepCol, pattern_case: c }
    : null;
}

// 한 행을 해석한다. 뜻이 없거나 유형별 필수 칸이 없으면 null.
export function parsePatternRow(row: Record<string, unknown>): ParsedPatternRow | null {
  const meaning = str(row["뜻"]);
  if (!meaning) return null;
  const note = str(row["메모"]) || null;
  const text = str(row["패턴"]);
  const typeCol = str(row["유형"]);
  const declared = typeCol ? parseType(typeCol) : null;
  if (typeCol && !declared) return null;
  const expressionCol = str(row["표현"]);

  let fields: PatternFields | null = null;
  let expression: string | null = null;

  const asConj = (e: string) => {
    expression = e;
    fields = { pattern_type: "conj", verb: null, reflexive: false, preposition: null, pattern_case: null };
  };

  if (declared === "conj") {
    const e = expressionCol || text;
    if (e) asConj(e);
  } else if (declared) {
    fields = text ? parsePatternText(text) : fromColumns(declared, row);
    if (fields && declared !== "prep") fields = { ...fields, pattern_type: declared, reflexive: declared === "verb" && fields.reflexive };
    if (fields && declared === "prep" && fields.pattern_type !== "prep") fields = null;
  } else if (text) {
    fields = parsePatternText(text);
    if (!fields && ELLIPSIS.test(text)) asConj(text);
  } else if (expressionCol) {
    asConj(expressionCol);
  } else {
    fields = fromColumns("verb", row) ?? fromColumns("prep", row);
  }
  if (!fields) return null;

  // "예문"으로 시작하고 "뜻"으로 끝나지 않는 열이 독일어 예문, "<열 이름>뜻"이 그 예문의 뜻
  const examples = Object.keys(row)
    .filter((k) => k.startsWith("예문") && !k.endsWith("뜻"))
    .map((k) => ({ sentence: str(row[k]), translation: str(row[`${k}뜻`]) || null }))
    .filter((e) => e.sentence);

  return { pattern: { ...fields, expression, note, meaning }, examples };
}

// 가져오기에 실패한 행의 이유 (사용자에게 보여줄 한 줄)
export function explainPatternRowFailure(row: Record<string, unknown>): string {
  if (!str(row["뜻"])) return "뜻이 비어 있음";
  const typeCol = str(row["유형"]);
  if (typeCol && !parseType(typeCol)) {
    return `알 수 없는 유형: "${typeCol}" (동사 / 명사 / 전치사 / 접속사 중 하나)`;
  }
  const declared = typeCol ? parseType(typeCol) : null;
  if (declared === "conj") return "표현 칸(또는 패턴 칸)이 비어 있음";
  const text = str(row["패턴"]);
  if (text) return `패턴을 해석하지 못함: "${text}" (접속사는 유형 열에 접속사로 적거나 표현 칸을 쓰세요)`;
  if (declared === "prep") return "전치사/격 칸이 비어 있음";
  return "필수 칸이 비어 있음 (동사·명사=앞말+전치사+격, 전치사=전치사+격, 접속사=표현)";
}
