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
<<<<<<< HEAD
};

// 동사 + 전치사 + 격 패턴 (예: sich auf + Akk. freuen)
export type PatternCase = "Akk" | "Dat" | "Gen";

export type Pattern = {
  id: number;
  verb: string;
  reflexive: boolean; // true면 "sich"가 붙는 재귀동사
  preposition: string;
  pattern_case: PatternCase;
  meaning: string;
  wrong_count: number;
  last_studied_at: string | null;
  created_at: string;
  review_stage: number;
  next_review_at: string | null;
=======
>>>>>>> a1364d085e51867aea4ab029f08b4c968ab9650e
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
