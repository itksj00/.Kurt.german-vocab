"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import type { Difficulty, Gender, PerfektAux } from "@/lib/types";
import PatternSettings from "./PatternSettings";
import ModeTabs, { type Mode } from "../ModeTabs";
import { readAllRows } from "@/lib/xlsxRows";
import { wordKey, type WordIdentity } from "@/lib/wordKey";
import { fetchAllRows } from "@/lib/supabaseFetch";

const TEMPLATE_HEADERS = [
  "단어",
  "뜻",
  "품사",
  "발음",
  "난이도",
  "성",
  "복수형",
  "조동사",
  "과거분사",
  "예문1",
  "예문1뜻",
  "예문2",
  "예문2뜻",
  "예문3",
  "예문3뜻",
];
const GENDER_ALIASES: Record<string, Gender> = {
  der: "der",
  die: "die",
  das: "das",
  남성: "der",
  여성: "die",
  중성: "das",
  복수: "pl",
  "복수형 전용": "pl",
  pl: "pl",
  m: "der",
  f: "die",
  n: "das",
};
const AUX_ALIASES: Record<string, PerfektAux> = {
  haben: "haben",
  hat: "haben",
  sein: "sein",
  ist: "sein",
};
const VALID_DIFFICULTIES: Difficulty[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type FullWord = {
  word: string;
  meaning: string;
  part_of_speech: string | null;
  pronunciation: string | null;
  difficulty: string | null;
  gender: string | null;
  plural: string | null;
  perfekt_aux: string | null;
  partizip2: string | null;
  wrong_count: number;
  examples: { sentence: string; translation: string | null }[];
};

export default function SettingsPage() {
  const [mode, setMode] = useState<Mode>("word");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchAllWithExamples(): Promise<FullWord[]> {
    const { data: words, error } = await supabase
      .from("words")
      .select(
        "id, word, meaning, part_of_speech, pronunciation, difficulty, gender, plural, perfekt_aux, partizip2, wrong_count"
      )
      .order("word", { ascending: true });
    if (error) throw error;

    const { data: examples } = await supabase
      .from("examples")
      .select("word_id, sentence, translation");

    return (words ?? []).map((w) => ({
      word: w.word,
      meaning: w.meaning,
      part_of_speech: w.part_of_speech,
      pronunciation: w.pronunciation,
      difficulty: w.difficulty,
      gender: w.gender,
      plural: w.plural,
      perfekt_aux: w.perfekt_aux,
      partizip2: w.partizip2,
      wrong_count: w.wrong_count,
      examples: (examples ?? []).filter((e) => e.word_id === w.id),
    }));
  }

  async function handleExportCSV() {
    setBusy("csv");
    setMessage(null);
    try {
      const rows = await fetchAllWithExamples();
      const header = [
        "단어",
        "뜻",
        "품사",
        "발음",
        "난이도",
        "성",
        "복수형",
        "조동사",
        "과거분사",
        "틀린횟수",
        "예문",
        "예문뜻",
      ];
      const csvLines = [header.join(",")];
      for (const r of rows) {
        const examplesJoined = r.examples.map((e) => e.sentence).join(" / ");
        const translationsJoined = r.examples
          .map((e) => e.translation ?? "")
          .join(" / ");
        const cells = [
          r.word,
          r.meaning,
          r.part_of_speech ?? "",
          r.pronunciation ?? "",
          r.difficulty ?? "",
          r.gender ?? "",
          r.plural ?? "",
          r.perfekt_aux ?? "",
          r.partizip2 ?? "",
          String(r.wrong_count),
          examplesJoined,
          translationsJoined,
        ].map((c) => `"${c.replace(/"/g, '""')}"`);
        csvLines.push(cells.join(","));
      }
      downloadBlob(
        "\uFEFF" + csvLines.join("\n"),
        "wortschatz.csv",
        "text/csv;charset=utf-8"
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "내보내기에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleExportJSON() {
    setBusy("json");
    setMessage(null);
    try {
      const rows = await fetchAllWithExamples();
      downloadBlob(
        JSON.stringify(rows, null, 2),
        "wortschatz.json",
        "application/json"
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "내보내기에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  function handleDownloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ["Freiheit", "자유", "명사", "ˈfʁaɪhaɪt", "B1", "die", "Freiheiten", "", "", "Freiheit ist wichtig.", "자유는 중요하다.", "", "", "", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "words");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      buf,
      "wortschatz_template.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("import");
    setMessage(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      // 모든 시트의 데이터 행을 읽는다 (시트 범위 정보가 잘못된 파일도 처리)
      const rows = readAllRows(wb).map((r) => r.data as Record<string, string>);

      // 이미 등록된 단어와 완전히 같은 항목(단어·뜻·품사·성)은 건너뛴다. 같은 파일 안의 반복도 마찬가지.
      const existing = await fetchAllRows<WordIdentity>("words", "id, word, meaning, part_of_speech, gender");
      const seen = new Set(existing.map(wordKey));

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;

      for (const row of rows) {
        const word = String(row["단어"] ?? "").trim();
        const meaning = String(row["뜻"] ?? "").trim();
        if (!word || !meaning) {
          failCount++;
          continue;
        }
        const rawDifficulty = String(row["난이도"] ?? "").trim().toUpperCase();
        const difficulty = VALID_DIFFICULTIES.includes(
          rawDifficulty as Difficulty
        )
          ? rawDifficulty
          : null;

        const partOfSpeech = String(row["품사"] ?? "").trim() || null;
        const isNoun = partOfSpeech === "명사";
        const gender =
          GENDER_ALIASES[String(row["성"] ?? "").trim().toLowerCase()] ?? null;
        const plural = String(row["복수형"] ?? "").trim() || null;
        const isVerb = partOfSpeech === "동사";
        const aux =
          AUX_ALIASES[String(row["조동사"] ?? "").trim().toLowerCase()] ?? null;
        const partizip2 = String(row["과거분사"] ?? "").trim() || null;
        const hasPerfekt = isVerb && !!aux && !!partizip2;

        const key = wordKey({
          word,
          meaning,
          part_of_speech: partOfSpeech,
          gender: isNoun ? gender : null,
        });
        if (seen.has(key)) {
          skippedCount++;
          continue;
        }

        const { data: inserted, error } = await supabase
          .from("words")
          .insert({
            word,
            meaning,
            part_of_speech: partOfSpeech,
            pronunciation: String(row["발음"] ?? "").trim() || null,
            difficulty,
            gender: isNoun ? gender : null,
            plural: isNoun && gender !== "pl" ? plural : null,
            perfekt_aux: hasPerfekt ? aux : null,
            partizip2: hasPerfekt ? partizip2 : null,
          })
          .select("id")
          .single();

        if (error || !inserted) {
          failCount++;
          continue;
        }
        seen.add(key);

        // "예문"으로 시작하고 "뜻"으로 끝나지 않는 열이 독일어 예문, "<열 이름>뜻"이 그 예문의 뜻이다.
        const sentenceKeys = Object.keys(row).filter(
          (k) => k.startsWith("예문") && !k.endsWith("뜻")
        );
        const exampleRows = sentenceKeys
          .map((k) => ({
            word_id: inserted.id,
            sentence: String(row[k] ?? "").trim(),
            translation: String(row[`${k}뜻`] ?? "").trim() || null,
          }))
          .filter((r) => r.sentence);
        if (exampleRows.length > 0) {
          await supabase.from("examples").insert(exampleRows);
        }
        successCount++;
      }

      window.dispatchEvent(new Event("wortschatz:words-changed"));
      setMessage(
        `가져오기 완료: 성공 ${successCount}건, 중복 건너뜀 ${skippedCount}건, 실패 ${failCount}건`
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "엑셀 파일을 읽지 못했습니다."
      );
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // 모든 단어 삭제 (예문은 on delete cascade로 함께 삭제됨)
  async function handleDeleteAll() {
    if (confirmText.trim() !== "삭제") return;
    setBusy("delete");
    setMessage(null);
    try {
      const { count, error: countError } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true });
      if (countError) throw new Error(countError.message);
      const { error } = await supabase.from("words").delete().gte("id", 0);
      if (error) throw new Error(error.message);
      setConfirmText("");
      window.dispatchEvent(new Event("wortschatz:words-changed"));
      setMessage(`전체 삭제 완료 Alles gelöscht: 단어 ${count ?? 0}개와 예문을 삭제했습니다.`);
    } catch (err) {
      setMessage(
        `삭제하지 못했습니다 Löschen fehlgeschlagen: ${
          err instanceof Error ? err.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="site-main narrow">
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "pattern" ? (
        <PatternSettings />
      ) : (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>
            단어 내보내기 Wörter exportieren
          </div>
          <div className="row">
            <button
              className="btn ghost"
              onClick={handleExportCSV}
              disabled={busy === "csv"}
            >
              {busy === "csv" ? "내보내는 중... Exportiert..." : "CSV로 내보내기 Als CSV exportieren"}
            </button>
            <button
              className="btn ghost"
              onClick={handleExportJSON}
              disabled={busy === "json"}
            >
              {busy === "json" ? "내보내는 중... Exportiert..." : "JSON으로 내보내기 Als JSON exportieren"}
            </button>
          </div>

          <div className="section-title">
            엑셀로 여러 단어 한번에 추가 Excel Import
          </div>
          <div className="row">
            <button className="btn ghost" onClick={handleDownloadTemplate}>
              📄 템플릿(xlsx) 다운로드 Vorlage herunterladen
            </button>
          </div>
          <p className="muted" style={{ margin: "6px 0 10px" }}>
            템플릿의 열: 단어 · 뜻 · 품사 · 발음 · 난이도 · 성 · 복수형 · 조동사 · 과거분사 · 예문1 · 예문1뜻 · 예문2 · 예문2뜻 · 예문3 · 예문3뜻
            (성은 der/die/das, 남성/여성/중성, 복수형으로만 쓰는 단어는 pl 또는 복수, 명사일 때만 적용됩니다. 조동사는 haben/sein, 과거분사와 함께 동사일 때만 적용됩니다. 성·복수형·조동사·과거분사·예문 칸은
            비워둬도 되고, &ldquo;예문N&rdquo; 열은 몇 개든 추가해도
            인식됩니다.) 이미 등록된 단어와 단어·뜻·품사·성이 모두 같은 항목은 건너뜁니다(철자가 같아도 뜻이나 성이 다르면 추가됩니다).
          </p>
          <label style={{ marginBottom: 4 }}>엑셀 파일 선택 Excel-Datei auswählen</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportFile}
            disabled={busy === "import"}
            style={{ marginBottom: 4 }}
          />
          {busy === "import" && (
            <p className="muted">가져오는 중입니다. 단어 수에 따라 시간이 걸릴 수 있어요...</p>
          )}

          <div className="section-title">전체 삭제 Alle Wörter löschen</div>
          <p className="muted" style={{ marginBottom: 10 }}>
            등록한 모든 단어와 예문, 복습 기록이 삭제되며 되돌릴 수 없습니다. 먼저 위의
            JSON 내보내기로 백업하세요. 계속하려면 아래 칸에 &ldquo;삭제&rdquo;를 입력하세요.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="삭제"
            disabled={busy === "delete"}
            style={{ marginBottom: 10 }}
          />
          <div className="row">
            <button
              className="btn danger"
              onClick={handleDeleteAll}
              disabled={busy === "delete" || confirmText.trim() !== "삭제"}
            >
              {busy === "delete" ? "삭제 중... Löscht..." : "모든 단어 삭제 Alle Wörter löschen"}
            </button>
          </div>

          {message && <p className="muted" style={{ marginTop: 10 }}>{message}</p>}
        </div>
      )}
    </main>
  );
}
