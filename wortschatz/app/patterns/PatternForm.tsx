"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { PatternCase, PatternType } from "@/lib/types";
import { CASE_OPTIONS, COMMON_PREPS, GEN_PREPS, PATTERN_TYPES, caseLabel, patternText } from "@/lib/patterns";

export default function PatternForm({ patternId }: { patternId?: number }) {
  const router = useRouter();
  const isEdit = typeof patternId === "number";

  const [type, setType] = useState<PatternType>("verb");
  const [head, setHead] = useState(""); // 동사 / 명사 / 형용사
  const [reflexive, setReflexive] = useState(false);
  const [preposition, setPreposition] = useState("");
  const [patternCase, setPatternCase] = useState<PatternCase>("Akk");
  const [expression, setExpression] = useState("");
  const [meaning, setMeaning] = useState("");
  const [note, setNote] = useState("");
  const [examples, setExamples] = useState<{ sentence: string; translation: string }[]>([
    { sentence: "", translation: "" },
  ]);

  const [legacyExtras, setLegacyExtras] = useState(false); // 예문·메모가 이미 있는 고정 표현
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    async function load() {
      const { data: row, error } = await supabase
        .from("patterns")
        .select("*")
        .eq("id", patternId)
        .single();
      if (!active) return;
      if (error || !row) {
        setErrorMsg(error?.message ?? "패턴을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }
      const { data: exRows } = await supabase
        .from("pattern_examples")
        .select("sentence, translation")
        .eq("pattern_id", patternId);
      setType((row.pattern_type ?? "verb") as PatternType);
      setHead(row.verb ?? "");
      setReflexive(!!row.reflexive);
      setPreposition(row.preposition ?? "");
      setPatternCase((row.pattern_case ?? "Akk") as PatternCase);
      setExpression(row.expression ?? "");
      setMeaning(row.meaning);
      setNote(row.note ?? "");
      const loaded = (exRows ?? []).map((r) => ({
        sentence: r.sentence as string,
        translation: (r.translation as string | null) ?? "",
      }));
      setExamples(loaded.length > 0 ? loaded : [{ sentence: "", translation: "" }]);
      setLegacyExtras(loaded.some((x) => x.sentence.trim()) || !!(row.note ?? "").trim());
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [isEdit, patternId]);

  function updateExample(i: number, field: "sentence" | "translation", value: string) {
    setExamples((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, [field]: value } : ex)));
  }

  const textType = type === "conj" || type === "expr"; // 표현 문자열 하나만 쓰는 유형
  // 고정 표현은 독독독처럼 문장 + 뜻만 입력한다. (이미 예문·메모가 있는 항목은 그대로 보여 준다)
  const simpleExpr = type === "expr" && !legacyExtras;

  // 유형에 맞게 정리한 저장값. 쓰지 않는 칸은 null.
  function buildPayload() {
    let cleanHead = head.trim();
    let isReflexive = type === "verb" && reflexive;
    if (type === "verb" && /^sich\s+/i.test(cleanHead)) {
      cleanHead = cleanHead.replace(/^sich\s+/i, "");
      isReflexive = true;
    }
    const usesPrep = !textType;
    return {
      pattern_type: type,
      verb: type === "verb" || type === "noun" ? cleanHead : null,
      reflexive: isReflexive,
      preposition: usesPrep ? preposition.trim() : null,
      pattern_case: usesPrep ? patternCase : null,
      expression: textType ? expression.trim() : null,
      note: simpleExpr ? null : note.trim() || null,
      meaning: meaning.trim(),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const payload = buildPayload();

    if (!payload.meaning) return setErrorMsg("뜻은 필수입니다.");
    if (textType && !payload.expression) {
      return setErrorMsg(type === "expr" ? "문장은 필수입니다." : "표현은 필수입니다.");
    }
    if (!textType && !payload.preposition) return setErrorMsg("전치사는 필수입니다.");
    if ((type === "verb" || type === "noun") && !payload.verb) {
      return setErrorMsg(type === "verb" ? "동사는 필수입니다." : "명사/형용사는 필수입니다.");
    }

    setSaving(true);
    const cleanExamples = (simpleExpr ? [] : examples)
      .map((ex) => ({ sentence: ex.sentence.trim(), translation: ex.translation.trim() }))
      .filter((ex) => ex.sentence);

    try {
      let targetId = patternId;
      if (isEdit && targetId) {
        const { error } = await supabase.from("patterns").update(payload).eq("id", targetId);
        if (error) throw error;
        await supabase.from("pattern_examples").delete().eq("pattern_id", targetId);
      } else {
        const { data, error } = await supabase
          .from("patterns")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }
      if (cleanExamples.length > 0 && targetId) {
        const rows = cleanExamples.map((ex) => ({
          pattern_id: targetId,
          sentence: ex.sentence,
          translation: ex.translation || null,
        }));
        const { error: exErr } = await supabase.from("pattern_examples").insert(rows);
        if (exErr) throw exErr;
      }
      router.push("/patterns");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!patternId) return;
    if (!confirm("이 패턴을 삭제할까요? 예문도 함께 삭제됩니다.")) return;
    setDeleting(true);
    const { error } = await supabase.from("patterns").delete().eq("id", patternId);
    setDeleting(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.push("/patterns");
  }

  if (loading) return <p className="muted">불러오는 중... Lädt...</p>;

  const p = buildPayload();
  const ready = textType ? !!p.expression : !!p.preposition && (type === "prep" || !!p.verb);
  const preview = ready && type !== "expr" ? patternText(p) : null;
  const prepList = type === "prep" ? [...GEN_PREPS, ...COMMON_PREPS] : COMMON_PREPS;

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="section-title">패턴 정보 Musterdaten</div>

      <div className="field">
        <label>유형 Typ</label>
        <select value={type} onChange={(e) => setType(e.target.value as PatternType)}>
          {PATTERN_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.ko} ({t.de})
            </option>
          ))}
        </select>
      </div>

      {(type === "verb" || type === "noun") && (
        <div className="row" style={{ marginTop: 8 }}>
          <div className="field">
            <label>{type === "verb" ? "동사 (원형) Verb" : "명사 / 형용사 Nomen / Adjektiv"}</label>
            <input
              value={head}
              onChange={(e) => setHead(e.target.value)}
              placeholder={type === "verb" ? "예: freuen, teilnehmen" : "예: Angst, stolz"}
            />
          </div>
          {type === "verb" && (
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={reflexive}
                  onChange={(e) => setReflexive(e.target.checked)}
                  style={{ width: "auto", marginRight: 6 }}
                />
                재귀동사 sich
              </label>
            </div>
          )}
        </div>
      )}

      {!textType && (
        <div className="row" style={{ marginTop: 8 }}>
          <div className="field">
            <label>전치사 Präposition</label>
            <input
              value={preposition}
              onChange={(e) => setPreposition(e.target.value)}
              placeholder={type === "prep" ? "예: aufgrund" : "예: auf"}
              list="prep-list"
            />
            <datalist id="prep-list">
              {prepList.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>격 Kasus</label>
            <select
              value={patternCase}
              onChange={(e) => setPatternCase(e.target.value as PatternCase)}
            >
              {CASE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {caseLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {type === "conj" && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>표현 Ausdruck</label>
          <input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="예: sowohl … als auch …, obwohl, wenn"
          />
          <small className="muted">
            두 부분으로 이뤄진 표현은 … 로 나눠 적으면 연결어별로 퀴즈가 만들어집니다.
          </small>
        </div>
      )}

      {type === "expr" && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>{legacyExtras ? "표현 Ausdruck" : "문장 Satz"}</label>
          <textarea
            rows={2}
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder={
              legacyExtras
                ? "예: eine wichtige Rolle spielen, es geht um …"
                : "예: Die Digitalisierung spielt eine wichtige Rolle im Alltag."
            }
          />
          {!legacyExtras && (
            <small className="muted">
              문장 통째로 적으면 빈칸·문장 입력·문장 배열 문제가 만들어집니다.
            </small>
          )}
        </div>
      )}

      <div className="field" style={{ marginTop: 8 }}>
        <label>뜻 Bedeutung</label>
        <input
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder={simpleExpr ? "예: 디지털화는 일상에서 중요한 역할을 한다." : "예: ~을 기대하다"}
        />
      </div>

      {!simpleExpr && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>메모 (선택) Notiz</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 부문장, 동사는 문장 끝 / 분리동사"
          />
        </div>
      )}

      {preview && (
        <p className="muted" style={{ marginTop: 10 }}>
          미리보기 Vorschau: <b>{preview}</b>
        </p>
      )}

      {!simpleExpr && <div className="section-title">예문 (여러 개 추가 가능) Beispielsätze</div>}
      {!simpleExpr && examples.map((ex, i) => (
        <div className="ex-item" key={i} style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
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
              onClick={() => setExamples((prev) => prev.filter((_, idx) => idx !== i))}
            >
              삭제 Löschen
            </button>
          )}
        </div>
      ))}
      {!simpleExpr && (
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setExamples((prev) => [...prev, { sentence: "", translation: "" }])}
        >
          + 예문 추가 Beispiel hinzufügen
        </button>
      )}

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
            {deleting ? "삭제 중... Löscht..." : "패턴 삭제 Muster löschen"}
          </button>
        )}
      </div>
    </form>
  );
}
