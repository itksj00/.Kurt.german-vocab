import type { Pattern } from "./types";
import {
  makeCloze,
  norm,
  shuffle,
  tokenize,
  type ExampleMap,
  type PKind,
  type Question,
  type Rng,
} from "./quizGen";
import {
  COLLOCATION_NOUNS,
  COMMON_PREPS,
  CONJ_WORDS,
  GEN_PREPS,
  caseLabel,
  connectiveParts,
  expressionWords,
  isSentenceExpression,
  patternText,
} from "./patterns";

// ── 패턴 퀴즈 문제 생성 (순수 함수 · 렌더 경로 밖에서만 호출할 것) ──
// 유형별 출제:
//  · 동사/명사·형용사 + 전치사 + 격, 전치사 + 격: 전치사 고르기·입력, 격 고르기, 뜻 → 패턴, 문장 배열
//  · 접속사/연결 표현: 연결어 고르기·입력(예문 빈칸), 표현 입력, 뜻 → 패턴, 문장 배열
//  · 고정 표현·연어(eine wichtige Rolle spielen): 핵심 단어 빈칸 고르기·입력(예문), 표현 입력, 뜻 → 패턴, 문장 배열

type PatternKind = PKind | "reorder";

export const PATTERN_WEIGHTS: Record<PatternKind, number> = {
  prepCloze: 3,
  prepInput: 3,
  caseChoice: 3,
  meaningToPattern: 3,
  reorder: 2,
  connCloze: 3,
  connInput: 2,
  exprInput: 2,
  exprCloze: 3,
  exprWord: 2,
};

const LABELS: Record<PatternKind, string> = {
  prepCloze: "전치사 고르기 Präposition wählen",
  prepInput: "전치사 입력 Präposition eingeben",
  caseChoice: "격 고르기 Kasus wählen",
  meaningToPattern: "패턴 고르기 Muster wählen",
  reorder: "문장 배열 Satz ordnen",
  connCloze: "연결어 고르기 Konnektor wählen",
  connInput: "연결어 입력 Konnektor eingeben",
  exprInput: "표현 입력 Ausdruck eingeben",
  exprCloze: "연어 빈칸 고르기 Kollokation wählen",
  exprWord: "연어 빈칸 입력 Kollokation eingeben",
};

type Ctx = { p: Pattern; all: Pattern[]; ex: ExampleMap; rng: Rng };
type Builder = (c: Ctx) => Question | null;

const has = (v: string | null | undefined): v is string => !!v && v.trim().length > 0;
const lines = (...l: (string | null | undefined | false)[]) =>
  l.filter((x): x is string => !!x).join("\n");
const pick = <T,>(a: T[], rng: Rng): T => a[Math.floor(rng() * a.length)];
const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isUpperFirst = (s: string) => s.charAt(0) !== s.charAt(0).toLowerCase();
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const typeOf = (p: Pattern) => p.pattern_type ?? "verb";

const isConj = (p: Pattern) => typeOf(p) === "conj" && has(p.expression);
const isExpr = (p: Pattern) => typeOf(p) === "expr" && has(p.expression);
const isPrepLike = (p: Pattern) =>
  typeOf(p) !== "conj" && has(p.preposition) && !!p.pattern_case;

// 고정 표현을 문장 통째로 적었으면(독독독 형식) 그 문장과 뜻을 예문으로 취급해
// 빈칸 문제·문장 배열 문제가 별도 예문 없이도 만들어지게 한다.
function withOwnSentence(p: Pattern, ex: ExampleMap): ExampleMap {
  if (!isExpr(p) || !isSentenceExpression(p.expression!)) return ex;
  const own = p.expression!.trim();
  const list = ex[p.id] ?? [];
  if (list.some((e) => norm(e.sentence) === norm(own))) return ex;
  return { ...ex, [p.id]: [{ sentence: own, translation: p.meaning }, ...list] };
}

function validExamples(p: Pattern, ex: ExampleMap) {
  return (ex[p.id] ?? []).filter((e) => has(e.sentence));
}

// 풀이 후 보여줄 설명: 패턴, 뜻, 메모, 예문 한 줄(있을 때)
function extraLines(p: Pattern, ex: ExampleMap, rng: Rng): string[] {
  const v = validExamples(p, ex).filter((e) => !has(p.expression) || norm(e.sentence) !== norm(p.expression));
  const out: string[] = [];
  if (has(p.note)) out.push(p.note.trim());
  if (v.length) {
    const e = pick(v, rng);
    out.push(e.sentence.trim());
    if (has(e.translation)) out.push(e.translation.trim());
  }
  return out;
}

const containsWord = (haystackNorm: string, wordNorm: string) =>
  new RegExp(`(?<![\\p{L}])${escapeRegExp(wordNorm)}(?![\\p{L}])`, "u").test(haystackNorm);

// 보기 만들기: 후보를 순서대로 훑으며 중복/정답/문장에 이미 있는 말을 걸러 3개를 채운다.
function takeDistractors(
  candidates: string[],
  exclude: string[],
  answerForm: string,
  sentenceNorm = ""
): string[] {
  const seen = new Set(exclude.map(norm));
  const out: string[] = [];
  for (const cand of candidates) {
    let form = cand.trim();
    if (!form) continue;
    if (isUpperFirst(answerForm) && !isUpperFirst(form)) form = upperFirst(form);
    const k = norm(form);
    if (seen.has(k)) continue;
    if (sentenceNorm && containsWord(sentenceNorm, k)) continue;
    seen.add(k);
    out.push(form);
    if (out.length === 3) break;
  }
  return out;
}

// 전치사 오답: 같은 동사의 다른 전치사(헷갈리기 쉬운 것) → 같은 격의 전치사 단독 패턴 → 흔한 전치사
function prepDistractors(p: Pattern, all: Pattern[], rng: Rng, answerForm: string, sentenceNorm: string): string[] {
  const others = all.filter((o) => o.id !== p.id);
  const sameHead = has(p.verb)
    ? others.filter((o) => has(o.verb) && norm(o.verb) === norm(p.verb!) && has(o.preposition)).map((o) => o.preposition!)
    : [];
  const sameCase =
    typeOf(p) === "prep"
      ? others.filter((o) => typeOf(o) === "prep" && o.pattern_case === p.pattern_case && has(o.preposition)).map((o) => o.preposition!)
      : [];
  const pool = [
    ...others.filter(isPrepLike).map((o) => o.preposition!),
    ...COMMON_PREPS,
    ...(typeOf(p) === "prep" ? GEN_PREPS : []),
  ];
  return takeDistractors(
    [...shuffle(sameHead, rng), ...shuffle(sameCase, rng), ...shuffle(pool, rng)],
    [answerForm, p.preposition ?? ""],
    answerForm,
    sentenceNorm
  );
}

type Src = { text: string; answer: string; sentence: string; translation: string | null };

// 예문에서 주어진 후보(전치사 또는 연결어)가 독립된 단어로 쓰인 곳을 빈칸으로 만든다.
function clozeSources(p: Pattern, ex: ExampleMap, rng: Rng, candidates: string[]): Src[] {
  const out: Src[] = [];
  for (const e of validExamples(p, ex)) {
    for (const cand of shuffle(candidates, rng)) {
      const c = makeCloze(e.sentence, [cand]);
      if (c) {
        out.push({
          ...c,
          sentence: e.sentence.normalize("NFC").trim(),
          translation: has(e.translation) ? e.translation.trim() : null,
        });
        break;
      }
    }
  }
  return out;
}

function clozeQuestion(
  kind: "prepCloze" | "connCloze" | "connInput" | "exprCloze" | "exprWord",
  p: Pattern,
  s: Src,
  rng: Rng,
  options: string[] | null
): Question {
  return {
    kind,
    wordId: p.id,
    format: options ? "choice" : "input",
    label: LABELS[kind],
    prompt: s.text,
    sub: s.translation ? `예문 뜻 Übersetzung: ${s.translation}` : `뜻 Bedeutung: ${p.meaning}`,
    options: options ? shuffle(options, rng) : undefined,
    answer: s.answer,
    reveal: lines(s.sentence, s.translation, `${patternText(p)} — ${p.meaning}`, has(p.note) && p.note.trim()),
    umlaut: !options,
  };
}

const buildPrepCloze: Builder = ({ p, all, ex, rng }) => {
  if (!isPrepLike(p)) return null;
  const srcs = clozeSources(p, ex, rng, [p.preposition!]);
  if (!srcs.length) return null;
  const s = pick(srcs, rng);
  const ds = prepDistractors(p, all, rng, s.answer, norm(s.sentence));
  return ds.length < 3 ? null : clozeQuestion("prepCloze", p, s, rng, [s.answer, ...ds]);
};

const buildPrepInput: Builder = ({ p, ex, rng }) =>
  isPrepLike(p)
    ? {
        kind: "prepInput",
        wordId: p.id,
        format: "input",
        label: LABELS.prepInput,
        prompt: patternText(p, "prep"),
        sub: `뜻 Bedeutung: ${p.meaning}`,
        answer: p.preposition!.trim(),
        reveal: lines(patternText(p), p.meaning, ...extraLines(p, ex, rng)),
        umlaut: true,
      }
    : null;

const buildCaseChoice: Builder = ({ p, ex, rng }) => {
  if (!isPrepLike(p)) return null;
  const options = ["Akk.", "Dat."];
  if (p.pattern_case === "Gen") options.push("Gen.");
  return {
    kind: "caseChoice",
    wordId: p.id,
    format: "choice",
    label: LABELS.caseChoice,
    prompt: patternText(p, "case"),
    sub: `뜻 Bedeutung: ${p.meaning}`,
    options,
    answer: caseLabel(p.pattern_case!),
    reveal: lines(patternText(p), p.meaning, ...extraLines(p, ex, rng)),
    umlaut: false,
  };
};

// 연결어 오답: 다른 연결 표현의 연결어 → 흔한 접속사. 정답의 짝(같은 표현의 다른 조각)은 제외한다.
function connDistractors(p: Pattern, all: Pattern[], rng: Rng, answerForm: string, sentenceNorm: string): string[] {
  const own = connectiveParts(p.expression!);
  const fromOthers = all
    .filter((o) => o.id !== p.id && isConj(o))
    .flatMap((o) => connectiveParts(o.expression!));
  return takeDistractors(
    [...shuffle(fromOthers, rng), ...shuffle(CONJ_WORDS, rng)],
    [answerForm, ...own],
    answerForm,
    sentenceNorm
  );
}

const buildConnCloze: Builder = ({ p, all, ex, rng }) => {
  if (!isConj(p)) return null;
  const srcs = clozeSources(p, ex, rng, connectiveParts(p.expression!));
  if (!srcs.length) return null;
  const s = pick(srcs, rng);
  const ds = connDistractors(p, all, rng, s.answer, norm(s.sentence));
  return ds.length < 3 ? null : clozeQuestion("connCloze", p, s, rng, [s.answer, ...ds]);
};

const buildConnInput: Builder = ({ p, ex, rng }) => {
  if (!isConj(p)) return null;
  const srcs = clozeSources(p, ex, rng, connectiveParts(p.expression!));
  return srcs.length ? clozeQuestion("connInput", p, pick(srcs, rng), rng, null) : null;
};

// 고정 표현의 빈칸 후보: 예문에 그대로 나오는 핵심 단어. 명사(대문자)를 우선하고, 없으면 나머지 단어를 쓴다.
// (동사는 예문에서 활용되어 그대로 나오지 않는 경우가 많아 자연스럽게 제외된다)
function exprSources(p: Pattern, ex: ExampleMap, rng: Rng): Src[] {
  const words = expressionWords(p.expression!);
  const nouns = words.filter(isUpperFirst);
  const fromNouns = nouns.length ? clozeSources(p, ex, rng, nouns) : [];
  return fromNouns.length ? fromNouns : clozeSources(p, ex, rng, words);
}

// 연어 오답: 다른 표현의 단어(같은 대/소문자 부류) → 명사일 때는 흔한 연어 명사. 자기 표현의 단어는 제외한다.
function exprDistractors(p: Pattern, all: Pattern[], rng: Rng, answerForm: string, sentenceNorm: string): string[] {
  const upper = isUpperFirst(answerForm);
  const fromOthers = all
    .filter((o) => o.id !== p.id && has(o.expression))
    .flatMap((o) => expressionWords(o.expression!))
    .filter((w) => isUpperFirst(w) === upper);
  return takeDistractors(
    [...shuffle(fromOthers, rng), ...(upper ? shuffle(COLLOCATION_NOUNS, rng) : [])],
    [answerForm, ...expressionWords(p.expression!)],
    answerForm,
    sentenceNorm
  );
}

const buildExprCloze: Builder = ({ p, all, ex, rng }) => {
  if (!isExpr(p)) return null;
  const srcs = exprSources(p, ex, rng);
  if (!srcs.length) return null;
  const s = pick(srcs, rng);
  const ds = exprDistractors(p, all, rng, s.answer, norm(s.sentence));
  return ds.length < 3 ? null : clozeQuestion("exprCloze", p, s, rng, [s.answer, ...ds]);
};

const buildExprWord: Builder = ({ p, ex, rng }) => {
  if (!isExpr(p)) return null;
  const srcs = exprSources(p, ex, rng);
  return srcs.length ? clozeQuestion("exprWord", p, pick(srcs, rng), rng, null) : null;
};

// 뜻을 보고 표현 전체를 입력. 접속사의 기본 문제이자 마지막 대체 문제(어떤 유형에서도 가능)
const buildExprInput: Builder = ({ p, ex, rng }) => ({
  kind: "exprInput",
  wordId: p.id,
  format: "input",
  label: LABELS.exprInput,
  prompt: p.meaning,
  sub: "표현을 입력하세요 (… 생략 가능) Ausdruck eingeben",
  answer: patternText(p),
  reveal: lines(patternText(p), p.meaning, ...extraLines(p, ex, rng)),
  umlaut: true,
});

const sharesWord = (a: Pattern, b: Pattern) => {
  if (!has(a.expression) || !has(b.expression)) return false;
  const wa = new Set(expressionWords(a.expression).map((w) => w.toLowerCase().slice(0, 6)));
  return expressionWords(b.expression).some((w) => wa.has(w.toLowerCase().slice(0, 6)));
};

const buildMeaningToPattern: Builder = ({ p, all, ex, rng }) => {
  const own = patternText(p);
  const others = all.filter((o) => o.id !== p.id);
  const ordered = [
    ...shuffle(others.filter((o) => has(p.verb) && has(o.verb) && norm(o.verb) === norm(p.verb)), rng),
    ...shuffle(others.filter((o) => has(p.preposition) && has(o.preposition) && norm(o.preposition) === norm(p.preposition)), rng),
    // 고정 표현: 같은 핵심 단어를 쓰는 표현(Erfahrung sammeln ↔ Erfahrungen machen)을 먼저
    ...shuffle(others.filter((o) => sharesWord(p, o)), rng),
    ...shuffle(others.filter((o) => typeOf(o) === typeOf(p)), rng),
    ...shuffle(others, rng),
  ];
  const seen = new Set<string>([norm(own)]);
  const ds: string[] = [];
  for (const o of ordered) {
    const t = patternText(o);
    if (!t || seen.has(norm(t))) continue;
    seen.add(norm(t));
    ds.push(t);
    if (ds.length === 3) break;
  }
  if (ds.length < 3) return null;
  return {
    kind: "meaningToPattern",
    wordId: p.id,
    format: "choice",
    label: LABELS.meaningToPattern,
    prompt: p.meaning,
    sub: "알맞은 패턴을 고르세요 Wähle das passende Muster",
    options: shuffle([own, ...ds], rng),
    answer: own,
    reveal: lines(own, p.meaning, ...extraLines(p, ex, rng)),
    umlaut: false,
  };
};

const buildReorder: Builder = ({ p, ex, rng }) => {
  const cands = validExamples(p, ex).filter((e) => has(e.translation) && tokenize(e.sentence));
  if (!cands.length) return null;
  const e = pick(cands, rng);
  const tokens = tokenize(e.sentence)!;
  let shuffled = shuffle(tokens, rng);
  for (let i = 0; i < 5 && shuffled.join(" ") === tokens.join(" "); i++) shuffled = shuffle(tokens, rng);
  return {
    kind: "reorder",
    wordId: p.id,
    format: "reorder",
    label: LABELS.reorder,
    prompt: e.translation!.trim(),
    sub: "단어 조각을 눌러 독일어 문장을 완성하세요 Bringe die Wörter in die richtige Reihenfolge",
    tokens: shuffled,
    answer: tokens.join(" "),
    reveal: lines(tokens.join(" "), `${patternText(p)} — ${p.meaning}`, has(p.note) && p.note.trim()),
    umlaut: false,
  };
};

// exprInput은 접속사·고정 표현에서만 일반 출제하고, 다른 유형에서는 마지막 대체로만 쓴다.
const textOnly = (b: Builder): Builder => (c) => (isConj(c.p) || isExpr(c.p) ? b(c) : null);

const BUILDERS: Record<PatternKind, Builder> = {
  prepCloze: buildPrepCloze,
  prepInput: buildPrepInput,
  caseChoice: buildCaseChoice,
  meaningToPattern: buildMeaningToPattern,
  reorder: buildReorder,
  connCloze: buildConnCloze,
  connInput: buildConnInput,
  exprInput: textOnly(buildExprInput),
  exprCloze: buildExprCloze,
  exprWord: buildExprWord,
};
const KINDS = Object.keys(BUILDERS) as PatternKind[];

// 패턴 1개에 대해 가중치 무작위로 유형을 고르고, 불가능하면 남은 유형에서 다시 고른다.
// 모두 불가능하면(예: 예문도 비교할 패턴도 없는 경우) 입력 문제로 대체한다.
export function buildPatternQuestion(
  p: Pattern,
  all: Pattern[],
  ex: ExampleMap,
  rng: Rng = Math.random
): Question {
  const ctx: Ctx = { p, all, ex: withOwnSentence(p, ex), rng };
  const remaining = [...KINDS];
  while (remaining.length) {
    const total = remaining.reduce((s, k) => s + PATTERN_WEIGHTS[k], 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < remaining.length - 1; idx++) {
      r -= PATTERN_WEIGHTS[remaining[idx]];
      if (r < 0) break;
    }
    const q = BUILDERS[remaining[idx]](ctx);
    if (q) return q;
    remaining.splice(idx, 1);
  }
  return (isPrepLike(p) ? buildPrepInput(ctx) : null) ?? buildExprInput(ctx)!;
}

export function eligiblePatternKinds(p: Pattern, all: Pattern[], ex: ExampleMap, rng: Rng = Math.random): PatternKind[] {
  const ctx: Ctx = { p, all, ex: withOwnSentence(p, ex), rng };
  return KINDS.filter((k) => BUILDERS[k](ctx) !== null);
}
