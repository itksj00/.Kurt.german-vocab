import type { Pattern, Word } from "./types";
import {
  buildQuestion,
  shuffle,
  tokenize as splitTokens,
  type ExampleMap,
  type Question,
  type Rng,
} from "./quizGen";
import { buildPatternQuestion } from "./patternQuiz";
import { patternText } from "./patterns";
import { withArticle } from "./wordDisplay";
import { pickBlanks, tokenize as memoTokens, type MemoSentence } from "./memo";

// ── 토탈 테스트: 단어 · 패턴 · 독독독 문장을 섞어서 매번 무작위로 출제 (순수 함수) ──

export type TotalSource = "word" | "pattern" | "memo";

export const SOURCE_LABEL: Record<TotalSource, string> = {
  word: "단어 Wort",
  pattern: "패턴 Muster",
  memo: "독독독 Satz",
};

export type TotalQuestion = Question & {
  source: TotalSource;
  title: string; // 결과 화면에 보여줄 이름
  refKey: string; // `${source}:${id}` — 틀린 문제 다시 풀기용
};

export type TotalInput = {
  words: Word[]; // 분류를 마친 단어만
  patterns: Pattern[]; // 분류를 마친 패턴만
  memos: MemoSentence[];
  wordEx: ExampleMap;
  patternEx: ExampleMap;
};

export const TOTAL_COUNT = 20;

const has = (v: string | null | undefined): v is string => !!v && v.trim().length > 0;
const lines = (...l: (string | null | undefined | false)[]) =>
  l.filter((x): x is string => !!x).join("\n");

// 독독독 문장 문제: 한 단어 빈칸 입력 / 뜻 보고 문장 전체 입력 / 문장 배열
export function buildMemoQuestion(m: MemoSentence, rng: Rng = Math.random): Question {
  const sentence = m.sentence.normalize("NFC").trim().replace(/\s+/g, " ");
  const translation = has(m.translation) ? m.translation.trim() : null;
  const reveal = lines(sentence, translation);
  const toks = memoTokens(sentence);

  const kinds: { kind: "cloze" | "full" | "reorder"; weight: number }[] = [{ kind: "cloze", weight: 3 }];
  if (translation) kinds.push({ kind: "full", weight: 2 });
  if (translation && splitTokens(sentence)) kinds.push({ kind: "reorder", weight: 2 });
  const total = kinds.reduce((s, k) => s + k.weight, 0);
  let r = rng() * total;
  let chosen = kinds[kinds.length - 1].kind;
  for (const k of kinds) {
    r -= k.weight;
    if (r < 0) {
      chosen = k.kind;
      break;
    }
  }

  const blanks = pickBlanks(toks, 0.01, rng); // 한 단어만
  if (chosen === "cloze" && blanks.length === 0) chosen = translation ? "full" : "cloze";

  if (chosen === "reorder") {
    const tokens = splitTokens(sentence)!;
    let shuffled = shuffle(tokens, rng);
    for (let i = 0; i < 5 && shuffled.join(" ") === tokens.join(" "); i++) shuffled = shuffle(tokens, rng);
    return {
      kind: "reorder",
      wordId: m.id,
      format: "reorder",
      label: "문장 배열 Satz ordnen",
      prompt: translation!,
      sub: "단어 조각을 눌러 외운 문장을 완성하세요 Bringe die Wörter in die richtige Reihenfolge",
      tokens: shuffled,
      answer: tokens.join(" "),
      reveal,
      umlaut: false,
    };
  }
  if (chosen === "full" || blanks.length === 0) {
    return {
      kind: "memoFull",
      wordId: m.id,
      format: "input",
      label: "문장 전체 입력 Satz abtippen",
      prompt: translation ?? "외운 문장을 그대로 입력하세요",
      sub: "문장 전체를 입력하세요 (대소문자·구두점 무시) Ganzen Satz eingeben",
      answer: sentence,
      reveal,
      umlaut: true,
    };
  }
  const k = blanks[0];
  return {
    kind: "memoCloze",
    wordId: m.id,
    format: "input",
    label: "문장 빈칸 입력 Satz-Lücke",
    prompt: toks.map((t, i) => (i === k ? `${t.lead}_____${t.trail}` : `${t.lead}${t.core}${t.trail}`)).join(" "),
    sub: translation ? `뜻 Übersetzung: ${translation}` : null,
    answer: toks[k].core,
    reveal,
    umlaut: true,
  };
}

// count개를 출제한다. 출처(단어/패턴/독독독)는 남은 항목이 있는 출처 중에서 번갈아 무작위로 고르므로
// 단어 수가 많아도 패턴·문장이 골고루 섞인다. only를 주면 해당 항목만 출제한다(틀린 문제 다시 풀기).
export function buildTotalQuiz(
  input: TotalInput,
  count: number = TOTAL_COUNT,
  rng: Rng = Math.random,
  only?: Set<string>
): TotalQuestion[] {
  const keep = (key: string) => !only || only.has(key);
  const w = shuffle(input.words.filter((x) => keep(`word:${x.id}`)), rng);
  const p = shuffle(input.patterns.filter((x) => keep(`pattern:${x.id}`)), rng);
  const m = shuffle(input.memos.filter((x) => keep(`memo:${x.id}`)), rng);

  const out: TotalQuestion[] = [];
  while (out.length < count) {
    const avail: TotalSource[] = [];
    if (w.length) avail.push("word");
    if (p.length) avail.push("pattern");
    if (m.length) avail.push("memo");
    if (!avail.length) break;
    const src = avail[Math.floor(rng() * avail.length)];
    if (src === "word") {
      const x = w.pop()!;
      out.push({
        ...buildQuestion(x, input.words, input.wordEx, rng),
        source: "word",
        title: `${withArticle(x)} — ${x.meaning}`,
        refKey: `word:${x.id}`,
      });
    } else if (src === "pattern") {
      const x = p.pop()!;
      out.push({
        ...buildPatternQuestion(x, input.patterns, input.patternEx, rng),
        source: "pattern",
        title: `${patternText(x)} — ${x.meaning}`,
        refKey: `pattern:${x.id}`,
      });
    } else {
      const x = m.pop()!;
      out.push({
        ...buildMemoQuestion(x, rng),
        source: "memo",
        title: x.sentence,
        refKey: `memo:${x.id}`,
      });
    }
  }
  return out;
}
