export type Difficulty = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

// "pl" = 복수형으로만 존재하는 단어 (예: die Eltern)
export type Gender = "der" | "die" | "das" | "pl";

export type PerfektAux = "haben" | "sein";

export type Word = {
  id: number;
  word: string;
  meaning: string;
  part_of_speech: string | null;
  pronunciation: string | null;
  difficulty: Difficulty | null;
  gender: Gender | null;
  plural: string | null;
  perfekt_aux: PerfektAux | null;
  partizip2: string | null;
  wrong_count: number;
  review_stage: number;
  next_review_at: string | null;
  last_studied_at: string | null;
  created_at: string;
  sorted_at: string | null; // null = 아직 분류하지 않은 새 단어
  sort_result: "known" | "unknown" | null;
  mnemonic: string | null; // 암기 팁 (어원, 쉽게 외우는 법) 한 줄
};

// 동사 + 전치사 + 격 패턴 (예: sich auf + Akk. freuen)
export type PatternCase = "Akk" | "Dat" | "Gen";

// verb: 동사 + 전치사 + 격 / noun: 명사·형용사 + 전치사 + 격 / prep: 전치사 + 격만 / conj: 접속사·연결 표현 / expr: 고정 표현·연어
export type PatternType = "verb" | "noun" | "prep" | "conj" | "expr";

export type Pattern = {
  id: number;
  pattern_type: PatternType;
  verb: string | null; // 앞말: 동사/명사/형용사 (prep, conj에서는 null)
  reflexive: boolean; // true면 "sich"가 붙는 재귀동사
  preposition: string | null; // conj에서는 null
  pattern_case: PatternCase | null; // conj에서는 null
  expression: string | null; // conj: 전체 표현 (예: sowohl … als auch …)
  note: string | null; // 메모 (어순 등)
  meaning: string;
  wrong_count: number;
  last_studied_at: string | null;
  created_at: string;
  review_stage: number;
  next_review_at: string | null;
  sorted_at: string | null; // null = 아직 분류하지 않은 새 패턴
  sort_result: "known" | "unknown" | null;
};

export type Example = {
  id: number;
  word_id: number;
  sentence: string;
  translation: string | null;
};

export type ReviewItem = {
  id: number;
  word_id: number;
  added_at: string;
  resolved: boolean;
};

export type WordWithExamples = Word & { examples: Example[] };
