// 엑셀 가져오기에서 "완전히 같은 단어"를 걸러내기 위한 키 (순수 함수)
// 단어 + 뜻 + 품사 + 성이 모두 같으면 같은 항목이다. 철자가 같아도 뜻이나 성이 다르면
// (der See 호수 / die See 바다) 별개의 단어로 취급해 추가된다.

export type WordIdentity = {
  word: string;
  meaning: string;
  part_of_speech: string | null;
  gender: string | null;
};

const clean = (v: string | null | undefined) =>
  (v ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

export function wordKey(w: WordIdentity): string {
  return [clean(w.word), clean(w.meaning), clean(w.part_of_speech), clean(w.gender)].join("|");
}
