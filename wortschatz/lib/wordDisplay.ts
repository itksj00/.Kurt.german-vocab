import type { Word } from "./types";

// 명사이고 성이 지정된 경우 "der Tisch"처럼 관사를 붙여 반환한다.
export function withArticle(w: Pick<Word, "word" | "gender">): string {
  return w.gender ? `${w.gender} ${w.word}` : w.word;
}
