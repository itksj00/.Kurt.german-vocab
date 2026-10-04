import type { Pattern, PatternCase, PatternType } from "./types";

export const CASE_OPTIONS: PatternCase[] = ["Akk", "Dat", "Gen"];

export const PATTERN_TYPES: { value: PatternType; ko: string; de: string }[] = [
  { value: "verb", ko: "동사 + 전치사 + 격", de: "Verb" },
  { value: "noun", ko: "명사·형용사 + 전치사 + 격", de: "Nomen/Adjektiv" },
  { value: "prep", ko: "전치사 + 격", de: "Präposition" },
  { value: "conj", ko: "접속사·연결 표현", de: "Konnektor" },
];

export function typeLabel(t: PatternType | undefined): string {
  return PATTERN_TYPES.find((x) => x.value === (t ?? "verb"))?.ko ?? "";
}

// select 문자열이 화면마다 어긋나지 않도록 한 곳에서 관리한다. 컬럼을 추가하면 여기만 고치면 된다.
export const PATTERN_SELECT =
  "id, pattern_type, verb, reflexive, preposition, pattern_case, expression, note, meaning, wrong_count, review_stage, next_review_at, last_studied_at, created_at, sorted_at, sort_result";

// 동사/명사 + 전치사 퀴즈의 흔한 전치사 (오답 후보)
export const COMMON_PREPS = [
  "an", "auf", "aus", "bei", "durch", "für", "gegen", "in", "mit",
  "nach", "über", "um", "unter", "von", "vor", "zu", "zwischen",
];

// 2격(Gen.)을 취하는 전치사 (전치사 단독 패턴의 오답 후보)
export const GEN_PREPS = [
  "aufgrund", "wegen", "trotz", "während", "statt", "anstelle", "innerhalb",
  "außerhalb", "oberhalb", "unterhalb", "diesseits", "jenseits", "angesichts", "infolge",
];

// 접속사/연결어 (연결 표현 퀴즈의 오답 후보)
export const CONJ_WORDS = [
  "obwohl", "weil", "wenn", "dass", "ob", "während", "bevor", "nachdem", "damit", "sodass",
  "falls", "sobald", "indem", "seit", "bis", "als", "und", "aber", "denn", "sondern", "oder",
  "deshalb", "trotzdem", "außerdem", "deswegen", "jedoch", "entweder", "weder", "noch", "zwar",
  "sowohl", "je", "desto", "umso", "dennoch", "allerdings", "folglich", "somit",
];

export function caseLabel(c: PatternCase): string {
  return `${c}.`;
}

// "sowohl … als auch …" → ["sowohl", "als auch"]. 한 단어짜리 연결어는 그대로 하나만 나온다.
export function connectiveParts(expression: string): string[] {
  return expression
    .split(/\s*(?:…|\.{3}|~)\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

type PatternParts = Pick<Pattern, "verb" | "reflexive" | "preposition" | "pattern_case"> &
  Partial<Pick<Pattern, "pattern_type" | "expression">>;

// 화면 표기: "sich auf + Akk. freuen" / "teilnehmen an + Dat." / "aufgrund + Gen." / "sowohl … als auch …"
// blank를 주면 해당 부분을 ____ 로 가린 문제용 표기를 만든다. (접속사 유형은 blank 없음)
export function patternText(p: PatternParts, blank?: "prep" | "case"): string {
  const type = p.pattern_type ?? "verb";
  if (type === "conj") return p.expression ?? "";
  const prep = blank === "prep" ? "____" : (p.preposition ?? "");
  const c = blank === "case" ? "____" : p.pattern_case ? caseLabel(p.pattern_case) : "";
  if (type === "prep") return `${prep} + ${c}`;
  const head = p.verb ?? "";
  return type === "verb" && p.reflexive ? `sich ${prep} + ${c} ${head}` : `${head} ${prep} + ${c}`;
}
