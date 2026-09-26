"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Difficulty } from "@/lib/types";

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
  const [examples, setExamples] = useState<string[]>([""]);

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
        .select("sentence")
        .eq("word_id", wordId);

      setWord(wordRow.word);
      setMeaning(wordRow.meaning);
      setPartOfSpeech(wordRow.part_of_speech ?? PART_OF_SPEECH_OPTIONS[0]);
      setPronunciation(wordRow.pronunciation ?? "");
      setDifficulty((wordRow.difficulty as Difficulty) ?? "A1");
      const sentences = (exampleRows ?? []).map((r) => r.sentence);
      setExamples(sentences.length > 0 ? sentences : [""]);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [isEdit, wordId]);

  function updateExample(index: number, value: string) {
    setExamples((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addExampleField() {
    setExamples((prev) => [...prev, ""]);
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

    setSaving(true);
    const cleanExamples = examples.map((s) => s.trim()).filter(Boolean);
    const payload = {
      word: word.trim(),
      meaning: meaning.trim(),
      part_of_speech: partOfSpeech,
      pronunciation: pronunciation.trim() || null,
      difficulty,
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
        const rows = cleanExamples.map((sentence) => ({
          word_id: targetId,
          sentence,
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
    return <p className="muted">불러오는 중...</p>;
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
              <option key={p}>{p}</option>
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

      <div className="section-title">예문 (여러 개 추가 가능) Beispielsätze</div>
      {examples.map((sentence, i) => (
        <div className="ex-item" key={i}>
          <input
            value={sentence}
            onChange={(e) => updateExample(i, e.target.value)}
            placeholder={`예문 ${i + 1}`}
          />
          {examples.length > 1 && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => removeExampleField(i)}
            >
              삭제
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={addExampleField}>
        + 예문 추가
      </button>

      {errorMsg && (
        <p className="muted" style={{ color: "var(--danger)", marginTop: 10 }}>
          {errorMsg}
        </p>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
        {isEdit && (
          <button
            type="button"
            className="btn danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "삭제 중..." : "단어 삭제"}
          </button>
        )}
      </div>
    </form>
  );
}
