// 독일어 명사 대문자 규칙: 정답에서 대문자로 시작하는 단어(문장 첫 단어 제외 = 명사)는
// 입력에서도 첫 글자를 대문자로 써야 한다. 반대로 소문자 단어를 대문자로 쓴 것은 따지지 않는다.
// 철자(ä↔a, ß↔ss 등)와 나머지 글자의 대소문자는 기존 비교(대소문자 무시)가 맡는다.

const SENTENCE_END = "\u0001"; // 문장 끝 표시용 내부 마커

function firstLetter(s: string): string {
  const m = /\p{L}/u.exec(s);
  return m ? m[0] : "";
}

export function startsUpper(s: string): boolean {
  const ch = firstLetter(s);
  return ch !== "" && ch !== ch.toLowerCase();
}

// 공백 단위 단어로 나누되, 각 단어가 문장 첫 단어인지(처음이거나 . ! ? : 또는 여는 따옴표 뒤) 함께 돌려준다.
// loose=true면 표현·문장 입력 비교처럼 … ~ , ; 닫는 따옴표를 공백으로 본다.
export function capsTokens(v: string, loose: boolean, sentenceStart: boolean): { w: string; start: boolean }[] {
  let s = v.normalize("NFC");
  if (loose) s = s.replace(/…|\.{3}|~|[,;”]/g, " ");
  s = s.replace(/[.!?:„“"]+/g, ` ${SENTENCE_END} `);
  const out: { w: string; start: boolean }[] = [];
  let start = sentenceStart;
  for (const w of s.split(/\s+/).filter(Boolean)) {
    if (w === SENTENCE_END) {
      start = true;
      continue;
    }
    out.push({ w, start });
    start = false;
  }
  return out;
}

// answer가 입력과 대소문자만 다르게 일치한다는 전제에서, 명사 첫 글자 대문자를 지켰는지 검사한다.
// sentenceStart: 정답의 첫 단어를 문장 첫 단어로 보고 검사에서 뺄지 여부.
export function capsOk(answer: string, given: string, opts: { loose?: boolean; sentenceStart?: boolean } = {}): boolean {
  const loose = !!opts.loose;
  const a = capsTokens(answer, loose, !!opts.sentenceStart);
  const g = capsTokens(given, loose, false);
  if (a.length !== g.length) return true; // 판단할 수 없으면 기존 비교 결과를 따른다
  return a.every((t, i) => t.start || !startsUpper(t.w) || startsUpper(g[i].w));
}
