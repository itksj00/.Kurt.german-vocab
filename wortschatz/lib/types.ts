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
