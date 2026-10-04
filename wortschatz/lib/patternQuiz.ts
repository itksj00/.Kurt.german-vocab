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
import { COMMON_PREPS, caseLabel, patternText } from "./patterns";

// ── 패턴 퀴즈 문제 생성 (순수 함수 · 렌더 경로 밖에서만 호출할 것) ──

type PatternKind = PKind | "reorder";

export const PATTERN_WEIGHTS: Record<PatternKind, number> = {
  prepCloze: 3,
  prepInput: 3,
  caseChoice: 3,
  meaningToPattern: 2,
  reorder: 2,
};

const LABELS: Record<PatternKind, string> = {
  prepCloze: "전치사 고르기 Präposition wählen",
  prepInput: "전치사 입력 Präposition eingeben",
  caseChoice: "격 고르기 Kasus wählen",
  meaningToPattern: "패턴 고르기 Muster wählen",
  reorder: "문장 배열 Satz ordnen",
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

function validExamples(p: Pattern, ex: ExampleMap) {
  return (ex[p.id] ?? []).filter((e) => has(e.sentence));
}

// 풀이 후 보여줄 예문 한 줄 (있을 때만)
function exampleLines(p: Pattern, ex: ExampleMap, rng: Rng): string[] {
  const v = validExamples(p, ex);
  if (!v.length) return [];
  const e = pick(v, rng);
  return [e.sentence.trim(), has(e.translation) ? e.translation!.trim() : ""].filter(Boolean);
}

// 전치사 오답: 같은 동사의 다른 패턴 전치사(헷갈리기 쉬운 것)를 먼저, 부족하면 흔한 전치사로 채운다.
function prepDistractors(p: Pattern, all: Pattern[], rng: Rng, answerForm: string, sentenceNorm = ""): string[] {
  const seen = new Set<string>([norm(answerForm), norm(p.preposition)]);
  const sameVerb = all.filter((o) => o.id !== p.id && norm(o.verb) === norm(p.verb)).map((o) => o.preposition);
  const rest = shuffle([...all.map((o) => o.preposition), ...COMMON_PREPS], rng);
  const out: string[] = [];
  for (const cand of [...shuffle(sameVerb, rng), ...rest]) {
    let form = cand.trim();
    if (!form) continue;
    if (isUpperFirst(answerForm) && !isUpperFirst(form)) form = upperFirst(form);
    const k = norm(form);
    if (seen.has(k)) continue;
    if (sentenceNorm && new RegExp(`(?<![\\p{L}])${escapeRegExp(k)}(?![\\p{L}])`, "u").test(sentenceNorm)) continue;
    seen.add(k);
    out.push(form);
    if (out.length === 3) break;
  }
  return out;
}

const buildPrepCloze: Builder = ({ p, all, ex, rng }) => {
  const srcs: { text: string; answer: string; sentence: string; translation: string | null }[] = [];
  for (const e of validExamples(p, ex)) {
    const c = makeCloze(e.sentence, [p.preposition]);
    if (c) {
      srcs.push({
        ...c,
        sentence: e.sentence.normalize("NFC").trim(),
        translation: has(e.translation) ? e.translation!.trim() : null,
      });
    }
  }
  if (!srcs.length) return null;
  const s = pick(srcs, rng);
  const ds = prepDistractors(p, all, rng, s.answer, norm(s.sentence));
  if (ds.length < 3) return null;
  return {
    kind: "prepCloze",
    wordId: p.id,
    format: "choice",
    label: LABELS.prepCloze,
    prompt: s.text,
    sub: s.translation ? `예문 뜻 Übersetzung: ${s.translation}` : `뜻 Bedeutung: ${p.meaning}`,
    options: shuffle([s.answer, ...ds], rng),
    answer: s.answer,
    reveal: lines(s.sentence, s.translation, `${patternText(p)} — ${p.meaning}`),
    umlaut: false,
  };
};

const buildPrepInput: Builder = ({ p, ex, rng }) => ({
  kind: "prepInput",
  wordId: p.id,
  format: "input",
  label: LABELS.prepInput,
  prompt: patternText(p, "prep"),
  sub: `뜻 Bedeutung: ${p.meaning}`,
  answer: p.preposition.trim(),
  reveal: lines(patternText(p), p.meaning, ...exampleLines(p, ex, rng)),
  umlaut: true,
});

const buildCaseChoice: Builder = ({ p, ex, rng }) => {
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
    answer: caseLabel(p.pattern_case),
    reveal: lines(patternText(p), p.meaning, ...exampleLines(p, ex, rng)),
    umlaut: false,
  };
};

const buildMeaningToPattern: Builder = ({ p, all, ex, rng }) => {
  const own = patternText(p);
  const seen = new Set<string>([norm(own)]);
  const ordered = [
    ...shuffle(all.filter((o) => o.id !== p.id && norm(o.verb) === norm(p.verb)), rng),
    ...shuffle(all.filter((o) => o.id !== p.id && norm(o.preposition) === norm(p.preposition)), rng),
    ...shuffle(all.filter((o) => o.id !== p.id), rng),
  ];
  const ds: string[] = [];
  for (const o of ordered) {
    const t = patternText(o);
    if (seen.has(norm(t))) continue;
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
    reveal: lines(own, p.meaning, ...exampleLines(p, ex, rng)),
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
    reveal: lines(tokens.join(" "), `${patternText(p)} — ${p.meaning}`),
    umlaut: false,
  };
};

const BUILDERS: Record<PatternKind, Builder> = {
  prepCloze: buildPrepCloze,
  prepInput: buildPrepInput,
  caseChoice: buildCaseChoice,
  meaningToPattern: buildMeaningToPattern,
  reorder: buildReorder,
};
const KINDS = Object.keys(BUILDERS) as PatternKind[];

// 패턴 1개에 대해 가중치 무작위로 유형을 고르고, 불가능하면 남은 유형에서 다시 고른다. (prepInput은 항상 가능)
export function buildPatternQuestion(
  p: Pattern,
  all: Pattern[],
  ex: ExampleMap,
  rng: Rng = Math.random
): Question {
  const ctx: Ctx = { p, all, ex, rng };
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
  return buildPrepInput(ctx)!;
}

export function eligiblePatternKinds(p: Pattern, all: Pattern[], ex: ExampleMap, rng: Rng = Math.random): PatternKind[] {
  const ctx: Ctx = { p, all, ex, rng };
  return KINDS.filter((k) => BUILDERS[k](ctx) !== null);
}
