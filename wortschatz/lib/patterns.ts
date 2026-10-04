import type { Pattern, PatternCase } from "./types";

export const CASE_OPTIONS: PatternCase[] = ["Akk", "Dat", "Gen"];

export const COMMON_PREPS = [
  "an", "auf", "aus", "bei", "durch", "für", "gegen", "in", "mit",
  "nach", "über", "um", "unter", "von", "vor", "zu", "zwischen",
];

export function caseLabel(c: PatternCase): string {
  return `${c}.`;
}

type PatternParts = Pick<Pattern, "verb" | "reflexive" | "preposition" | "pattern_case">;

// 화면 표기: "sich auf + Akk. freuen" / "teilnehmen an + Dat."
// blank를 주면 해당 부분을 ____ 로 가린 문제용 표기를 만든다.
export function patternText(p: PatternParts, blank?: "prep" | "case"): string {
  const prep = blank === "prep" ? "____" : p.preposition;
  const c = blank === "case" ? "____" : caseLabel(p.pattern_case);
  return p.reflexive ? `sich ${prep} + ${c} ${p.verb}` : `${p.verb} ${prep} + ${c}`;
}
