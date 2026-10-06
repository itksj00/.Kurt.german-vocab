// "독독독 오늘의 암기" 로직 — 순수 함수

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

export function checkBlanks(tokens: Token[], blanks: number[], inputs: string[]): boolean[] {
  return blanks.map((ti, k) => {
    const given = normText(inputs[k] ?? "");
    return given !== "" && given === normText(tokens[ti].core);
  });
}

// ── 2단계: 전체 입력 ──
// 정답 문장의 각 단어가 입력에서 (순서대로) 맞게 쓰였는지 LCS로 표시한다.
export function compareSentences(correct: string, input: string): { ok: boolean; words: { word: string; ok: boolean }[] } {
  const cw = tokenize(correct);
  const a = cw.map((t) => normText(t.core));
  const b = normText(input).split(" ").filter(Boolean);
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
      hit[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const words = cw.map((t, k) => ({ word: `${t.lead}${t.core}${t.trail}`, ok: hit[k] }));
  const ok = a.length === b.length && hit.every(Boolean);
  return { ok, words };
}
