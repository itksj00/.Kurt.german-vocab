"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import type { Difficulty } from "@/lib/types";

const TEMPLATE_HEADERS = [
  "단어",
  "뜻",
  "품사",
  "발음",
  "난이도",
  "예문1",
  "예문2",
  "예문3",
];
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
  wrong_count: number;
  examples: { sentence: string }[];
};

export default function SettingsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchAllWithExamples(): Promise<FullWord[]> {
    const { data: words, error } = await supabase
      .from("words")
      .select(
        "id, word, meaning, part_of_speech, pronunciation, difficulty, wrong_count"
      )
      .order("word", { ascending: true });
    if (error) throw error;

    const { data: examples } = await supabase
      .from("examples")
      .select("word_id, sentence");

    return (words ?? []).map((w) => ({
      word: w.word,
      meaning: w.meaning,
      part_of_speech: w.part_of_speech,
      pronunciation: w.pronunciation,
      difficulty: w.difficulty,
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
        "틀린횟수",
        "예문",
      ];
      const csvLines = [header.join(",")];
      for (const r of rows) {
        const examplesJoined = r.examples.map((e) => e.sentence).join(" / ");
        const cells = [
          r.word,
          r.meaning,
          r.part_of_speech ?? "",
          r.pronunciation ?? "",
          r.difficulty ?? "",
          String(r.wrong_count),
          examplesJoined,
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
      ["Freiheit", "자유", "명사", "ˈfʁaɪhaɪt", "B1", "Freiheit ist wichtig.", "", ""],
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
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: "",
      });

      let successCount = 0;
      let failCount = 0;

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

        const { data: inserted, error } = await supabase
          .from("words")
          .insert({
            word,
            meaning,
            part_of_speech: String(row["품사"] ?? "").trim() || null,
            pronunciation: String(row["발음"] ?? "").trim() || null,
            difficulty,
          })
          .select("id")
          .single();

        if (error || !inserted) {
          failCount++;
          continue;
        }

        const sentenceKeys = Object.keys(row).filter((k) =>
          k.startsWith("예문")
        );
        const sentences = sentenceKeys
          .map((k) => String(row[k] ?? "").trim())
          .filter(Boolean);
        if (sentences.length > 0) {
          await supabase.from("examples").insert(
            sentences.map((sentence) => ({ word_id: inserted.id, sentence }))
          );
        }
        successCount++;
      }

      setMessage(
        `가져오기 완료: 성공 ${successCount}건, 실패 ${failCount}건`
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

  return (
    <section>
      <div className="card">
        <div className="section-title">데이터 내보내기 Export</div>
        <div className="row">
          <button
            className="btn ghost"
            onClick={handleExportCSV}
            disabled={busy === "csv"}
          >
            {busy === "csv" ? "내보내는 중..." : "CSV로 내보내기 Als CSV exportieren"}
          </button>
          <button
            className="btn ghost"
            onClick={handleExportJSON}
            disabled={busy === "json"}
          >
            {busy === "json" ? "내보내는 중..." : "JSON으로 내보내기 Als JSON exportieren"}
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
          템플릿의 열: 단어 · 뜻 · 품사 · 발음 · 난이도 · 예문1 · 예문2 · 예문3
          (예문 칸은 비워둬도 되고, &ldquo;예문&rdquo;으로 시작하는 열은 몇 개든 추가해도
          인식됩니다.)
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

        {message && <p className="muted" style={{ marginTop: 10 }}>{message}</p>}
      </div>
    </section>
  );
}
