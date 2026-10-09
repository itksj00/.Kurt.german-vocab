// "독독독 오늘의 암기" 로직 — 순수 함수
import { startsUpper } from "./caseRule";

export type MemoSentence = {
  id: number;
  sentence: string;
  translation: string | null;
  memo_date: string; // YYYY-MM-DD
  created_at: string;
};

export type Rng = () => number;

// ── 날짜 (문자열 YYYY-MM-DD로만 다룬다) ──
export function localDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

// 최근 7일(오늘 포함)
export function weekRange(today: string): { from: string; to: string } {
  return { from: addDays(today, -6), to: today };
}

export function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to; // YYYY-MM-DD는 문자열 비교가 날짜 비교와 같다
}

// ── 토큰 ──
export type Token = { lead: string; core: string; trail: string };

export function tokenize(sentence: string): Token[] {
  return sentence
    .normalize("NFC")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u.exec(raw)!;
      return { lead: m[1], core: m[2], trail: m[3] };
    });
}

// 비교용: NFC, 소문자, 구두점 무시, 공백 정리. ä↔a, ß↔ss는 다르게 본다.
export function normText(v: string): string {
  return v
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── 1단계: 빈칸 ──
// 3글자 이상인 단어 중에서 비율만큼 무작위로 가린다 (최소 1개). 후보가 없으면 모든 단어에서 고른다.
export function pickBlanks(tokens: Token[], ratio: number, rng: Rng = Math.random): number[] {
  let cand = tokens.map((t, i) => (t.core.length >= 3 ? i : -1)).filter((i) => i >= 0);
  if (cand.length === 0) cand = tokens.map((t, i) => (t.core ? i : -1)).filter((i) => i >= 0);
  if (cand.length === 0) return [];
  const count = Math.max(1, Math.min(cand.length, Math.round(cand.length * ratio)));
  const pool = [...cand];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

// 문장 첫 단어(처음이거나 앞 단어가 . ! ? 로 끝남)인지
function isSentenceStart(tokens: Token[], i: number): boolean {
  return i === 0 || /[.!?:]/.test(tokens[i - 1].trail) || /[„“"]/.test(tokens[i].lead);
}

// 명사(문장 첫 단어가 아닌 대문자 단어)는 입력도 첫 글자를 대문자로 써야 한다. enforceCaps=false면 대소문자를 모두 무시한다.
export function checkBlanks(tokens: Token[], blanks: number[], inputs: string[], enforceCaps = true): boolean[] {
  return blanks.map((ti, k) => {
    const raw = inputs[k] ?? "";
    const given = normText(raw);
    if (given === "" || given !== normText(tokens[ti].core)) return false;
    if (!enforceCaps || isSentenceStart(tokens, ti)) return true;
    return !startsUpper(tokens[ti].core) || startsUpper(raw);
  });
}

// ── 2단계: 전체 입력 ──
// 정답 문장의 각 단어가 입력에서 (순서대로) 맞게 쓰였는지 LCS로 표시한다.
export function compareSentences(
  correct: string,
  input: string,
  enforceCaps = true
): { ok: boolean; words: { word: string; ok: boolean }[] } {
  const cw = tokenize(correct);
  const a = cw.map((t) => normText(t.core));
  // 입력은 normText와 같은 기준(글자·숫자가 아닌 것은 구분자)으로 나눠 원래 대소문자를 함께 가진다.
  const rawB = input.normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const b = rawB.map((w) => w.toLowerCase());
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hit = new Array(a.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      // 명사(문장 첫 단어가 아닌 대문자 단어)의 첫 글자를 소문자로 쓰면 틀린 단어로 본다
      hit[i] = !enforceCaps || isSentenceStart(cw, i) || !startsUpper(cw[i].core) || startsUpper(rawB[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const words = cw.map((t, k) => ({ word: `${t.lead}${t.core}${t.trail}`, ok: hit[k] }));
  const ok = a.length === b.length && hit.every(Boolean);
  return { ok, words };
}

// ── 정답 문장과 입력 문장을 나란히 비교 (화면 표시용) ──
export type DiffWord = { word: string; ok: boolean };

// 정답·입력 모두 단어 단위로 LCS 정렬해, 맞게 쓴 단어(ok)와 틀리거나 빠진/남은 단어를 표시한다.
// … 같은 구두점만 있는 조각은 비교에서 빼고 ok로 둔다. 명사 대문자 규칙(enforceCaps)도 반영한다.
export function diffSentences(
  correct: string,
  input: string,
  enforceCaps = true
): { answer: DiffWord[]; given: DiffWord[]; ok: boolean } {
  const A = tokenize(correct);
  const G = tokenize(input);
  const ak = A.map((t) => normText(t.core));
  const gk = G.map((t) => normText(t.core));
  const ai = ak.map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
  const gi = gk.map((k, j) => (k ? j : -1)).filter((j) => j >= 0);

  const dp: number[][] = Array.from({ length: ai.length + 1 }, () => new Array(gi.length + 1).fill(0));
  for (let x = ai.length - 1; x >= 0; x--) {
    for (let y = gi.length - 1; y >= 0; y--) {
      dp[x][y] = ak[ai[x]] === gk[gi[y]] ? dp[x + 1][y + 1] + 1 : Math.max(dp[x + 1][y], dp[x][y + 1]);
    }
  }
  const aOk = A.map((_, i) => !ak[i]); // 구두점뿐인 조각은 ok
  const gOk = G.map((_, j) => !gk[j]);
  let x = 0;
  let y = 0;
  while (x < ai.length && y < gi.length) {
    const i = ai[x];
    const j = gi[y];
    if (ak[i] === gk[j]) {
      const capsFine = !enforceCaps || isSentenceStart(A, i) || !startsUpper(A[i].core) || startsUpper(G[j].core);
      aOk[i] = capsFine;
      gOk[j] = capsFine;
      x++;
      y++;
    } else if (dp[x + 1][y] >= dp[x][y + 1]) x++;
    else y++;
  }
  const answer = A.map((t, i) => ({ word: `${t.lead}${t.core}${t.trail}`, ok: aOk[i] }));
  const given = G.map((t, j) => ({ word: `${t.lead}${t.core}${t.trail}`, ok: gOk[j] }));
  return { answer, given, ok: answer.every((w) => w.ok) && given.every((w) => w.ok) };
}
