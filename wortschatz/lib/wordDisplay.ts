import type { Word } from "./types";

// 명사이고 성이 지정된 경우 "der Tisch"처럼 관사를 붙여 반환한다.
export function withArticle(w: Pick<Word, "word" | "gender">): string {
  return w.gender ? `${w.gender} ${w.word}` : w.word;
}

// 품사는 DB에 한글 값("명사" 등)으로 저장한다. 화면 표시만 한/독 병기로 바꾼다.
const POS_DE: Record<string, string> = {
  명사: "Nomen",
  동사: "Verb",
  형용사: "Adjektiv",
  부사: "Adverb",
  전치사: "Präposition",
  접속사: "Konjunktion",
  기타: "Sonstiges",
};

export function posLabel(pos: string): string {
  return POS_DE[pos] ? `${pos} ${POS_DE[pos]}` : pos;
}
