// 복습 3단계(내 문장 만들기) 검사 — 순수 함수
// 문장은 저장하지 않는다. 단어(또는 변화형)가 들어 있고 3단어 이상인지만 확인한다.

export const MIN_SENTENCE_WORDS = 3;

export type SentenceCheck = { ok: boolean; reason?: "short" | "missing" };

type WordLike = { word: string; plural?: string | null; partizip2?: string | null };

// 글자(문자)로 이루어진 단어들로 쪼갠다. 숫자·기호·구두점은 구분자.
export function sentenceWords(s: string): string[] {
  return s
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

// 허용하는 어미: 표제어/어간 뒤에 이 어미가 붙은 형태만 인정한다. (예: geh + t, Katz + en, schön + e)
// "sehen"의 어간 "seh"에 "sehr"가 일치하는 식의 오인정을 막기 위해 어미 목록으로 제한한다.
const ENDINGS = ["e", "en", "em", "er", "es", "n", "s", "st", "t", "et", "est", "te", "ten", "tet", "ste", "sten"];

// 표제어 그대로, 또는 끝의 en/n/e를 뗀 어간(최소 3글자)
function stemsOf(lemma: string): string[] {
  const out = [lemma];
  for (const suf of ["en", "n", "e"]) {
    if (lemma.endsWith(suf) && lemma.length - suf.length >= 3) out.push(lemma.slice(0, -suf.length));
  }
  return out;
}

const SKIP = new Set(["sich", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "zu", "mich", "dich", "uns", "euch"]);

function matchesForm(token: string, form: string): boolean {
  if (!form) return false;
  if (token === form) return true;
  if (form.length < 3) return false; // 아주 짧은 단어는 정확히 일치해야 한다 (Ei ≠ Eis, ein)
  return stemsOf(form).some((stem) => ENDINGS.some((e) => token === stem + e));
}

// 표제어가 여러 단어(예: "sich freuen")면 내용어를 모두 포함해야 한다. 한 단어면 복수형·Partizip II도 인정한다.
export function checkOwnSentence(w: WordLike, sentence: string): SentenceCheck {
  const tokens = sentenceWords(sentence);
  if (tokens.length < MIN_SENTENCE_WORDS) return { ok: false, reason: "short" };

  const lemma = sentenceWords(w.word).filter((t) => !SKIP.has(t));
  if (lemma.length === 0) return { ok: true }; // 비교할 내용어가 없으면 길이만 본다
  const extra =
    lemma.length === 1
      ? [...sentenceWords(w.plural ?? ""), ...sentenceWords(w.partizip2 ?? "")].filter((t) => !SKIP.has(t))
      : [];

  const ok = lemma.every((l, i) => {
    const forms = i === 0 ? [l, ...extra] : [l];
    return tokens.some((tok) => forms.some((f) => matchesForm(tok, f)));
  });
  return ok ? { ok: true } : { ok: false, reason: "missing" };
}
