// 패턴 목록 화면의 묶기·거르기·강조 로직 — 순수 함수
import type { Pattern, PatternCase, PatternType } from "./types";
import { PATTERN_TYPES, patternText } from "./patterns";

export type TypeFilter = PatternType | "전체";
export type CaseFilter = PatternCase | "전체";

const typeOf = (p: Pattern): PatternType => p.pattern_type ?? "verb";

// 검색어는 패턴 표기, 뜻, 메모에서 찾는다 (대소문자 무시).
export function filterPatterns(
  patterns: Pattern[],
  opts: { search: string; caseFilter: CaseFilter; typeFilter: TypeFilter }
): Pattern[] {
  const q = opts.search.trim().toLowerCase();
  return patterns.filter((p) => {
    if (opts.caseFilter !== "전체" && p.pattern_case !== opts.caseFilter) return false;
    if (opts.typeFilter !== "전체" && typeOf(p) !== opts.typeFilter) return false;
    if (!q) return true;
    return (
      patternText(p).toLowerCase().includes(q) ||
      p.meaning.toLowerCase().includes(q) ||
      (p.note ?? "").toLowerCase().includes(q)
    );
  });
}

// 유형 칩에 표시할 개수 (전체 포함)
export function typeCounts(patterns: Pattern[]): Record<TypeFilter, number> {
  const out = { 전체: patterns.length } as Record<TypeFilter, number>;
  for (const t of PATTERN_TYPES) out[t.value] = 0;
  for (const p of patterns) out[typeOf(p)] += 1;
  return out;
}

// 유형별 섹션 (PATTERN_TYPES 순서). 비어 있는 유형은 뺀다. 섹션 안은 독일어 표기 순.
export function groupPatterns(patterns: Pattern[]): { type: PatternType; ko: string; de: string; items: Pattern[] }[] {
  return PATTERN_TYPES.map((t) => ({
    type: t.value,
    ko: t.ko,
    de: t.de,
    items: patterns
      .filter((p) => typeOf(p) === t.value)
      .sort((a, b) => patternText(a).localeCompare(patternText(b), "de")),
  })).filter((g) => g.items.length > 0);
}

// 검색어와 일치하는 부분을 표시하기 위해 텍스트를 조각으로 나눈다.
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const out: { text: string; hit: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const at = lower.indexOf(ql, i);
    if (at < 0) {
      out.push({ text: text.slice(i), hit: false });
      break;
    }
    if (at > i) out.push({ text: text.slice(i, at), hit: false });
    out.push({ text: text.slice(at, at + ql.length), hit: true });
    i = at + ql.length;
  }
  return out.length > 0 ? out : [{ text, hit: false }];
}
