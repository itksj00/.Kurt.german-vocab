export type Difficulty = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type Word = {
  id: number;
  word: string;
  meaning: string;
  part_of_speech: string | null;
  pronunciation: string | null;
  difficulty: Difficulty | null;
  wrong_count: number;
  last_studied_at: string | null;
  created_at: string;
};

export type Example = {
  id: number;
  word_id: number;
  sentence: string;
};

export type ReviewItem = {
  id: number;
  word_id: number;
  added_at: string;
  resolved: boolean;
};

export type WordWithExamples = Word & { examples: Example[] };
