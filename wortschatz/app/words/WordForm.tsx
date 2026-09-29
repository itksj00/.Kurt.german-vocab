"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Difficulty, Gender, PerfektAux } from "@/lib/types";
import { posLabel } from "@/lib/wordDisplay";

const DIFFICULTIES: Difficulty[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const PART_OF_SPEECH_OPTIONS = [
  "명사",
  "동사",
  "형용사",
  "부사",
  "전치사",
  "접속사",
  "기타",
];

export default function WordForm({ wordId }: { wordId?: number }) {
  const router = useRouter();
  const isEdit = typeof wordId === "number";

  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState(PART_OF_SPEECH_OPTIONS[0]);
  const [pronunciation, setPronunciation] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("A1");
  const [gender, setGender] = useState<Gender | "">("");
  const [hasPlural, setHasPlural] = useState(false);
  const [plural, setPlural] = useState("");
  const [hasPerfekt, setHasPerfekt] = useState(false);
  const [perfektAux, setPerfektAux] = useState<PerfektAux>("haben");
  const [partizip2, setPartizip2] = useState("");
  const [examples, setExamples] = useState<{ sentence: string; translation: string }[]>([
    { sentence: "", translation: "" },
  ]);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    async function load() {
      const { data: wordRow, error: wordErr } = await supabase
        .from("words")
        .select("*")
        .eq("id", wordId)
        .single();
      if (!active) return;
      if (wordErr || !wordRow) {
        setErrorMsg(wordErr?.message ?? "단어를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }
      const { data: exampleRows } = await supabase
        .from("examples")
        .select("sentence, translation")
        .eq("word_id", wordId);

      setWord(wordRow.word);
      setMeaning(wordRow.meaning);
      setPartOfSpeech(wordRow.part_of_speech ?? PART_OF_SPEECH_OPTIONS[0]);
      setPronunciation(wordRow.pronunciation ?? "");
      setDifficulty((wordRow.difficulty as Difficulty) ?? "A1");
      setGender((wordRow.gender as Gender | null) ?? "");
      setHasPlural(!!wordRow.plural);
      setPlural(wordRow.plural ?? "");
      setHasPerfekt(!!wordRow.partizip2);
      setPerfektAux((wordRow.perfekt_aux as PerfektAux | null) ?? "haben");
      setPartizip2(wordRow.partizip2 ?? "");
      const loaded = (exampleRows ?? []).map((r) => ({
        sentence: r.sentence as string,
        translation: (r.translation as string | null) ?? "",
      }));
      setExamples(loaded.length > 0 ? loaded : [{ sentence: "", translation: "" }]);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [isEdit, wordId]);

  function updateExample(
    index: number,
    field: "sentence" | "translation",
    value: string
  ) {
    setExamples((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    );
  }

  function addExampleField() {
    setExamples((prev) => [...prev, { sentence: "", translation: "" }]);
  }

  function removeExampleField(index: number) {
    setExamples((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!word.trim() || !meaning.trim()) {
      setErrorMsg("단어와 뜻은 필수입니다.");
      return;
    }

    const isNoun = partOfSpeech === "명사";
    if (isNoun && gender !== "pl" && hasPlural && !plural.trim()) {
      setErrorMsg("복수형을 입력하거나 '복수' 체크를 해제해 주세요.");
      return;
    }

    const isVerb = partOfSpeech === "동사";
    if (isVerb && hasPerfekt && !partizip2.trim()) {
      setErrorMsg("과거분사를 입력하거나 '과거형' 체크를 해제해 주세요.");
      return;
    }

    setSaving(true);
    const cleanExamples = examples
      .map((ex) => ({
        sentence: ex.sentence.trim(),
        translation: ex.translation.trim(),
      }))
      .filter((ex) => ex.sentence);
    const payload = {
      word: word.trim(),
      meaning: meaning.trim(),
      part_of_speech: partOfSpeech,
      pronunciation: pronunciation.trim() || null,
      difficulty,
      gender: isNoun && gender ? gender : null,
      plural: isNoun && hasPlural && gender !== "pl" ? plural.trim() : null,
      perfekt_aux: isVerb && hasPerfekt ? perfektAux : null,
      partizip2: isVerb && hasPerfekt ? partizip2.trim() : null,
    };

    try {
      let targetId = wordId;
      if (isEdit && targetId) {
        const { error } = await supabase
          .from("words")
          .update(payload)
          .eq("id", targetId);
        if (error) throw error;
        await supabase.from("examples").delete().eq("word_id", targetId);
      } else {
        const { data, error } = await supabase
          .from("words")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }

      if (cleanExamples.length > 0 && targetId) {
        const rows = cleanExamples.map((ex) => ({
          word_id: targetId,
          sentence: ex.sentence,
          translation: ex.translation || null,
        }));
        const { error: exErr } = await supabase.from("examples").insert(rows);
        if (exErr) throw exErr;
      }

      router.push("/words");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!wordId) return;
    if (!confirm("이 단어를 삭제할까요? 예문과 복습항목도 함께 삭제됩니다.")) {
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("words").delete().eq("id", wordId);
    setDeleting(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.push("/words");
  }

  if (loading) {
    return <p className="muted">불러오는 중... Lädt...</p>;
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="section-title">기본 정보 Grunddaten</div>


      <div className="row">
        <div className="field">
          <label>단어 (독일어) Wort</label>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="예: Freiheit"
          />
        </div>
        <div className="field">
          <label>뜻 Bedeutung</label>
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="예: 자유"
          />
        </div>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="field">
          <label>품사 Wortart</label>
          <select
            value={partOfSpeech}
            onChange={(e) => setPartOfSpeech(e.target.value)}
          >
            {PART_OF_SPEECH_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {posLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>발음 Aussprache</label>
          <input
            value={pronunciation}
            onChange={(e) => setPronunciation(e.target.value)}
            placeholder="IPA 또는 한글 표기"
          />
        </div>
        <div className="field">
          <label>난이도 Niveau</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {partOfSpeech === "명사" && (
        <div className="row" style={{ marginTop: 8 }}>
          <div className="field">
            <label>성 Genus</label>
            <select
              value={gender}
              onChange={(e) => {
                const next = e.target.value as Gender | "";
                setGender(next);
                if (next === "pl") {
                  // 복수형 전용 단어는 별도 복수형이 없다.
                  setHasPlural(false);
                  setPlural("");
                }
              }}
            >
              <option value="">선택 안 함 Keine Angabe</option>
              <option value="der">남성 maskulin (der)</option>
              <option value="die">여성 feminin (die)</option>
              <option value="das">중성 neutral (das)</option>
              <option value="pl">복수형 전용 nur Plural (die)</option>
            </select>
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={hasPlural}
                disabled={gender === "pl"}
                onChange={(e) => setHasPlural(e.target.checked)}
                style={{ width: "auto", marginRight: 6 }}
              />
              복수 Plural
            </label>
            {hasPlural && (
              <input
                value={plural}
                onChange={(e) => setPlural(e.target.value)}
                placeholder="예: Tische"
              />
            )}
          </div>
        </div>
      )}

      {partOfSpeech === "동사" && (
        <div className="row" style={{ marginTop: 8 }}>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={hasPerfekt}
                onChange={(e) => setHasPerfekt(e.target.checked)}
                style={{ width: "auto", marginRight: 6 }}
              />
              과거형 Perfekt
            </label>
            {hasPerfekt && (
              <select
                value={perfektAux}
                onChange={(e) => setPerfektAux(e.target.value as PerfektAux)}
              >
                <option value="haben">haben + Partizip II</option>
                <option value="sein">sein + Partizip II</option>
              </select>
            )}
          </div>
          {hasPerfekt && (
            <div className="field">
              <label>과거분사 Partizip II</label>
              <input
                value={partizip2}
                onChange={(e) => setPartizip2(e.target.value)}
                placeholder="예: gemacht"
              />
            </div>
          )}
        </div>
      )}

      <div className="section-title">예문 (여러 개 추가 가능) Beispielsätze</div>
      {examples.map((ex, i) => (
        <div className="ex-item" key={i} style={{ alignItems: "flex-start" }}>
          <div
            style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}
          >
            <input
              value={ex.sentence}
              onChange={(e) => updateExample(i, "sentence", e.target.value)}
              placeholder={`예문 ${i + 1} (독일어) Beispielsatz`}
            />
            <input
              value={ex.translation}
              onChange={(e) => updateExample(i, "translation", e.target.value)}
              placeholder="예문 뜻 (한국어) Übersetzung"
            />
          </div>
          {examples.length > 1 && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => removeExampleField(i)}
            >
              삭제 Löschen
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={addExampleField}>
        + 예문 추가 Beispiel hinzufügen
      </button>

      {errorMsg && (
        <p className="muted" style={{ color: "var(--danger)", marginTop: 10 }}>
          {errorMsg}
        </p>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "저장 중... Speichert..." : "저장 Speichern"}
        </button>
        {isEdit && (
          <button
            type="button"
            className="btn danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "삭제 중... Löscht..." : "단어 삭제 Wort löschen"}
          </button>
        )}
      </div>
    </form>
  );
}
