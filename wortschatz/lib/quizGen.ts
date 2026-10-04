import type { Word } from "./types";
import { perfektText, withArticle } from "./wordDisplay";

// ── 올인원 퀴즈 문제 생성 (순수 함수 · 렌더 경로 밖에서만 호출할 것) ──

export type QKind =
  | "reorder"
  | "mcCloze"
  | "inCloze"
  | "article"
  | "plural"
  | "aux"
  | "partizip"
  | "mcMeaning"
  | "deInput";

// 패턴 퀴즈 전용 유형 (lib/patternQuiz.ts)
export type PKind = "prepCloze" | "prepInput" | "caseChoice" | "meaningToPattern";

export type QFormat = "choice" | "input" | "reorder";

export type Question = {
  kind: QKind | PKind;
  wordId: number; // 단어 또는 패턴의 id
  format: QFormat;
  label: string; // 유형 라벨 (한/독 병기)
  prompt: string; // 문제 본문
  sub: string | null; // 보조 문구 (힌트/예문 뜻)
  options?: string[]; // choice: 보기 (이미 섞임)
  tokens?: string[]; // reorder: 조각 (이미 섞임)
  answer: string; // 정답 (reorder는 조각을 공백으로 이은 문장)
  accept?: string[]; // 정답으로 인정할 추가 표기
  reveal: string; // 확인 후 보여줄 설명 (줄바꿈 \n)
  umlaut: boolean; // input 형식에서 ä ö ü ß 버튼 표시 여부
};

export type ExampleMap = Record<
  number,
  { sentence: string; translation: string | null }[]
>;
export type Rng = () => number;

export const WEIGHTS: Record<QKind, number> = {
  reorder: 3,
  mcCloze: 3,
  inCloze: 2,
  article: 2,
  plural: 2,
  aux: 2,
  partizip: 2,
  mcMeaning: 1,
  deInput: 1,
};

const LABELS: Record<QKind, string> = {
  reorder: "문장 배열 Satz ordnen",
  mcCloze: "빈칸 고르기 Lückentext (Auswahl)",
  inCloze: "빈칸 입력 Lückentext (Eingabe)",
  article: "관사 Artikel",
  plural: "복수형 Plural",
  aux: "조동사 Hilfsverb",
  partizip: "과거분사 Partizip II",
  mcMeaning: "뜻 고르기 Bedeutung",
  deInput: "독일어 입력 Deutsch eingeben",
};

const MIN_TOKENS = 3;
const MAX_TOKENS = 14;

// 입력값 비교용: NFC + 공백 정리 + 대소문자 무시. ä↔a, ß↔ss는 다르게 본다.
export function norm(v: string): string {
  return v.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeRegExp(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 예문에서 단어(또는 복수형)가 독립된 단어로 쓰인 부분을 찾아 빈칸 문장을 만든다.
export function makeCloze(
  sentence: string,
  candidates: (string | null)[]
): { text: string; answer: string } | null {
  const src = sentence.normalize("NFC");
  for (const c of candidates) {
    if (!c || !c.trim()) continue;
    const re = new RegExp(
      `(?<![\\p{L}])${escapeRegExp(c.normalize("NFC").trim())}(?![\\p{L}])`,
      "iu"
    );
    const m = re.exec(src);
    if (m) {
      return {
        text: src.slice(0, m.index) + "_____" + src.slice(m.index + m[0].length),
        answer: m[0],
      };
    }
  }
  return null;
}

// 공백 기준 토큰 (구두점은 붙은 채). 3~14개일 때만 재배열 가능.
export function tokenize(sentence: string): string[] | null {
  const t = sentence.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  return t.length >= MIN_TOKENS && t.length <= MAX_TOKENS ? t : null;
}

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

function has(v: string | null | undefined): v is string {
  return !!v && v.trim().length > 0;
}

function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isUpperFirst(s: string): boolean {
  const c = s.charAt(0);
  return c !== c.toLowerCase();
}

function validExamples(w: Word, ex: ExampleMap) {
  return (ex[w.id] ?? []).filter((e) => has(e.sentence));
}

type Ctx = { w: Word; all: Word[]; ex: ExampleMap; rng: Rng };
type Builder = (c: Ctx) => Question | null;

const isNoun = (w: Word) => w.part_of_speech === "명사";
const isVerb = (w: Word) => w.part_of_speech === "동사";

function lines(...l: (string | null | undefined | false)[]): string {
  return l.filter((x): x is string => !!x).join("\n");
}

function wordLine(w: Word): string {
  return `${withArticle(w)} — ${w.meaning}`;
}

// ── 유형별 빌더: 출제할 수 없으면 null ──

const buildReorder: Builder = ({ w, ex, rng }) => {
  const cands = validExamples(w, ex).filter(
    (e) => has(e.translation) && tokenize(e.sentence)
  );
  if (!cands.length) return null;
  const e = pick(cands, rng);
  const tokens = tokenize(e.sentence)!;
  let shuffled = shuffle(tokens, rng);
  for (let i = 0; i < 5 && shuffled.join(" ") === tokens.join(" "); i++) {
    shuffled = shuffle(tokens, rng);
  }
  return {
    kind: "reorder",
    wordId: w.id,
    format: "reorder",
    label: LABELS.reorder,
    prompt: e.translation!.trim(),
    sub: "단어 조각을 눌러 독일어 문장을 완성하세요 Bringe die Wörter in die richtige Reihenfolge",
    tokens: shuffled,
    answer: tokens.join(" "),
    reveal: lines(tokens.join(" "), wordLine(w)),
    umlaut: false,
  };
};

function clozeSources(w: Word, ex: ExampleMap) {
  const out: {
    text: string;
    answer: string;
    sentence: string;
    translation: string | null;
  }[] = [];
  for (const e of validExamples(w, ex)) {
    const c = makeCloze(e.sentence, [w.word, w.plural]);
    if (c) {
      out.push({
        ...c,
        sentence: e.sentence.normalize("NFC").trim(),
        translation: has(e.translation) ? e.translation!.trim() : null,
      });
    }
  }
  return out;
}

const buildMcCloze: Builder = ({ w, all, ex, rng }) => {
  const srcs = clozeSources(w, ex);
  if (!srcs.length) return null;
  const s = pick(srcs, rng);
  const ans = norm(s.answer);
  // 정답이 복수형이면 오답도 복수형을 써서 형태 단서를 없앤다.
  const wantPlural =
    has(w.plural) && ans === norm(w.plural) && ans !== norm(w.word);
  const sentenceNorm = norm(s.sentence);
  const seen = new Set<string>([ans]);
  const pool: string[] = [];
  for (const o of shuffle(all, rng)) {
    if (o.id === w.id) continue;
    if (!w.part_of_speech || o.part_of_speech !== w.part_of_speech) continue;
    let form = wantPlural ? o.plural : o.word;
    if (!has(form)) continue;
    form = form.normalize("NFC").trim();
    if (isUpperFirst(s.answer) && !isUpperFirst(form)) form = upperFirst(form);
    const k = norm(form);
    if (seen.has(k)) continue;
    // 문장에 이미 그대로 들어 있는 단어는 보기에서 제외
    if (new RegExp(`(?<![\\p{L}])${escapeRegExp(k)}(?![\\p{L}])`, "u").test(sentenceNorm))
      continue;
    seen.add(k);
    pool.push(form);
    if (pool.length === 3) break;
  }
  if (pool.length < 3) return null; // 오답 부족 → 입력 빈칸으로 대체
  return {
    kind: "mcCloze",
    wordId: w.id,
    format: "choice",
    label: LABELS.mcCloze,
    prompt: s.text,
    sub: s.translation ? `예문 뜻 Übersetzung: ${s.translation}` : `힌트 Hinweis: ${w.meaning}`,
    options: shuffle([s.answer, ...pool], rng),
    answer: s.answer,
    reveal: lines(s.sentence, s.translation, wordLine(w)),
    umlaut: false,
  };
};

const buildInCloze: Builder = ({ w, ex, rng }) => {
  const srcs = clozeSources(w, ex);
  if (!srcs.length) return null;
  const s = pick(srcs, rng);
  return {
    kind: "inCloze",
    wordId: w.id,
    format: "input",
    label: LABELS.inCloze,
    prompt: s.text,
    sub: s.translation ? `예문 뜻 Übersetzung: ${s.translation}` : `힌트 Hinweis: ${w.meaning}`,
    answer: s.answer,
    reveal: lines(s.sentence, s.translation, wordLine(w)),
    umlaut: true,
  };
};

const buildArticle: Builder = ({ w, rng }) => {
  if (!isNoun(w) || !(w.gender === "der" || w.gender === "die" || w.gender === "das"))
    return null;
  return {
    kind: "article",
    wordId: w.id,
    format: "choice",
    label: LABELS.article,
    prompt: `____ ${w.word}`,
    sub: `뜻 Bedeutung: ${w.meaning}`,
    options: shuffle(["der", "die", "das"], rng),
    answer: w.gender,
    reveal: wordLine(w),
    umlaut: false,
  };
};

const buildPlural: Builder = ({ w }) => {
  if (!isNoun(w) || w.gender === "pl" || !has(w.plural)) return null;
  const pl = w.plural.trim();
  return {
    kind: "plural",
    wordId: w.id,
    format: "input",
    label: LABELS.plural,
    prompt: withArticle(w),
    sub: "복수형을 입력하세요 Pluralform eingeben",
    answer: pl,
    accept: [`die ${pl}`],
    reveal: lines(`${withArticle(w)} → die ${pl}`, w.meaning),
    umlaut: true,
  };
};

const buildAux: Builder = ({ w, rng }) => {
  if (!isVerb(w) || !w.perfekt_aux || !has(w.partizip2)) return null;
  return {
    kind: "aux",
    wordId: w.id,
    format: "choice",
    label: LABELS.aux,
    prompt: `Ich ____ ${w.partizip2.trim()}.  (${w.word})`,
    sub: `뜻 Bedeutung: ${w.meaning}`,
    options: shuffle(["haben", "sein"], rng),
    answer: w.perfekt_aux,
    reveal: lines(`${w.word} → ${perfektText(w)}`, w.meaning),
    umlaut: false,
  };
};

const buildPartizip: Builder = ({ w }) => {
  if (!isVerb(w) || !w.perfekt_aux || !has(w.partizip2)) return null;
  const aux = w.perfekt_aux === "haben" ? "habe" : "bin";
  return {
    kind: "partizip",
    wordId: w.id,
    format: "input",
    label: LABELS.partizip,
    prompt: `Ich ${aux} ____  (${w.word})`,
    sub: `뜻 Bedeutung: ${w.meaning}`,
    answer: w.partizip2.trim(),
    reveal: lines(`Ich ${aux} ${w.partizip2.trim()}`, w.meaning),
    umlaut: true,
  };
};

const buildMcMeaning: Builder = ({ w, all, rng }) => {
  const seen = new Set<string>([norm(w.meaning)]);
  const ds: string[] = [];
  for (const o of shuffle(all, rng)) {
    if (o.id === w.id || !has(o.meaning)) continue;
    const k = norm(o.meaning);
    if (seen.has(k)) continue;
    seen.add(k);
    ds.push(o.meaning);
    if (ds.length === 3) break;
  }
  if (ds.length < 3) return null;
  return {
    kind: "mcMeaning",
    wordId: w.id,
    format: "choice",
    label: LABELS.mcMeaning,
    prompt: withArticle(w),
    sub: null,
    options: shuffle([w.meaning, ...ds], rng),
    answer: w.meaning,
    reveal: wordLine(w),
    umlaut: false,
  };
};

const buildDeInput: Builder = ({ w }) => ({
  kind: "deInput",
  wordId: w.id,
  format: "input",
  label: LABELS.deInput,
  prompt: w.meaning,
  sub: "독일어로 입력하세요 (관사 제외) Auf Deutsch, ohne Artikel",
  answer: w.word.trim(),
  accept: w.gender ? [withArticle(w)] : undefined,
  reveal: wordLine(w),
  umlaut: true,
});

const BUILDERS: Record<QKind, Builder> = {
  reorder: buildReorder,
  mcCloze: buildMcCloze,
  inCloze: buildInCloze,
  article: buildArticle,
  plural: buildPlural,
  aux: buildAux,
  partizip: buildPartizip,
  mcMeaning: buildMcMeaning,
  deInput: buildDeInput,
};

const KINDS = Object.keys(BUILDERS) as QKind[];

// 단어 1개에 대해 가중치 무작위로 유형을 고르고, 불가능하면 남은 유형 중에서 다시 고른다.
// deInput은 항상 가능하므로 결과는 null이 되지 않는다.
export function buildQuestion(
  w: Word,
  all: Word[],
  ex: ExampleMap,
  rng: Rng = Math.random
): Question {
  const ctx: Ctx = { w, all, ex, rng };
  const remaining = [...KINDS];
  while (remaining.length) {
    const total = remaining.reduce((s, k) => s + WEIGHTS[k], 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < remaining.length - 1; idx++) {
      r -= WEIGHTS[remaining[idx]];
      if (r < 0) break;
    }
    const q = BUILDERS[remaining[idx]](ctx);
    if (q) return q;
    remaining.splice(idx, 1);
  }
  return buildDeInput(ctx)!;
}

// 이 단어에서 출제 가능한 유형 목록 (테스트/디버깅용)
export function eligibleKinds(
  w: Word,
  all: Word[],
  ex: ExampleMap,
  rng: Rng = Math.random
): QKind[] {
  const ctx: Ctx = { w, all, ex, rng };
  return KINDS.filter((k) => BUILDERS[k](ctx) !== null);
}

export function hasExamples(w: { id: number }, ex: ExampleMap): boolean {
  return (ex[w.id] ?? []).some((e) => has(e.sentence));
}

// 정오답 판정. reorder/choice/input 모두 문자열 하나로 비교한다.
export function isCorrect(q: Question, input: string): boolean {
  const given = norm(input);
  if (!given) return false;
  return [q.answer, ...(q.accept ?? [])].some((a) => norm(a) === given);
}
