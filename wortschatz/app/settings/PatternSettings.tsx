"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import { patternText } from "@/lib/patterns";
import { parsePatternRow, patternKey } from "@/lib/patternImport";
import type { Pattern } from "@/lib/types";

const TEMPLATE_HEADERS = ["패턴", "뜻", "예문1", "예문1뜻", "예문2", "예문2뜻", "예문3", "예문3뜻"];

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type FullPattern = {
  pattern: string;
  verb: string;
  reflexive: boolean;
  preposition: string;
  pattern_case: string;
  meaning: string;
  wrong_count: number;
  examples: { sentence: string; translation: string | null }[];
};

const PATTERN_COLS = "id, verb, reflexive, preposition, pattern_case, meaning, wrong_count";

export default function PatternSettings() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchAll(): Promise<FullPattern[]> {
    const { data, error } = await supabase
      .from("patterns")
      .select(PATTERN_COLS)
      .order("verb", { ascending: true });
    if (error) throw error;
    const { data: exs } = await supabase
      .from("pattern_examples")
      .select("pattern_id, sentence, translation");
    return ((data ?? []) as unknown as Pattern[]).map((p) => ({
      pattern: patternText(p),
      verb: p.verb,
      reflexive: p.reflexive,
      preposition: p.preposition,
      pattern_case: p.pattern_case,
      meaning: p.meaning,
      wrong_count: p.wrong_count,
      examples: (exs ?? []).filter((e) => e.pattern_id === p.id),
    }));
  }

  async function handleExport(kind: "csv" | "json") {
    setBusy(kind);
    setMessage(null);
    try {
      const rows = await fetchAll();
      if (kind === "json") {
        downloadBlob(JSON.stringify(rows, null, 2), "wortschatz_patterns.json", "application/json");
      } else {
        const header = ["패턴", "동사", "재귀", "전치사", "격", "뜻", "틀린횟수", "예문", "예문뜻"];
        const lines = [header.join(",")];
        for (const r of rows) {
          const cells = [
            r.pattern,
            r.verb,
            r.reflexive ? "sich" : "",
            r.preposition,
            r.pattern_case,
            r.meaning,
            String(r.wrong_count),
            r.examples.map((e) => e.sentence).join(" / "),
            r.examples.map((e) => e.translation ?? "").join(" / "),
          ].map((c) => `"${c.replace(/"/g, '""')}"`);
          lines.push(cells.join(","));
        }
        downloadBlob("\uFEFF" + lines.join("\n"), "wortschatz_patterns.csv", "text/csv;charset=utf-8");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "내보내기에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  function handleTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ["sich auf + Akk. freuen", "~을 기대하다", "Ich freue mich auf das Wochenende.", "나는 주말이 기대된다.", "", "", "", ""],
      ["teilnehmen an + Dat.", "~에 참가하다", "Er nimmt an dem Kurs teil.", "그는 수업에 참가한다.", "", "", "", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "patterns");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(buf, "wortschatz_patterns_template.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("import");
    setMessage(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      // 이미 있는 패턴(그리고 같은 파일 안의 반복)은 건너뛴다.
      const { data: existing, error: exErr } = await supabase
        .from("patterns")
        .select("verb, reflexive, preposition, pattern_case");
      if (exErr) throw new Error(exErr.message);
      const seen = new Set(
        ((existing ?? []) as unknown as Pattern[]).map((p) => patternKey(p))
      );

      let success = 0;
      let fail = 0;
      let skipped = 0;
      for (const row of rows) {
        const parsed = parsePatternRow(row);
        if (!parsed) {
          fail++;
          continue;
        }
        const key = patternKey(parsed.pattern);
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        const { data: inserted, error } = await supabase
          .from("patterns")
          .insert(parsed.pattern)
          .select("id")
          .single();
        if (error || !inserted) {
          fail++;
          continue;
        }
        seen.add(key);
        if (parsed.examples.length > 0) {
          await supabase
            .from("pattern_examples")
            .insert(parsed.examples.map((x) => ({ pattern_id: inserted.id, ...x })));
        }
        success++;
      }
      setMessage(`패턴 가져오기 완료: 성공 ${success}건, 중복 건너뜀 ${skipped}건, 실패 ${fail}건`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "엑셀 파일을 읽지 못했습니다.");
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAll() {
    if (confirmText.trim() !== "삭제") return;
    setBusy("delete");
    setMessage(null);
    try {
      const { count, error: countError } = await supabase
        .from("patterns")
        .select("id", { count: "exact", head: true });
      if (countError) throw new Error(countError.message);
      const { error } = await supabase.from("patterns").delete().gte("id", 0);
      if (error) throw new Error(error.message);
      setConfirmText("");
      setMessage(`패턴 전체 삭제 완료 Alles gelöscht: 패턴 ${count ?? 0}개와 예문을 삭제했습니다.`);
    } catch (err) {
      setMessage(
        `삭제하지 못했습니다 Löschen fehlgeschlagen: ${err instanceof Error ? err.message : "알 수 없는 오류"}`
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <div className="section-title" style={{ marginTop: 0 }}>
        패턴 데이터 Muster-Daten
      </div>
      <div className="row">
        <button className="btn ghost" onClick={() => handleExport("csv")} disabled={busy === "csv"}>
          패턴 CSV 내보내기 Muster als CSV
        </button>
        <button className="btn ghost" onClick={() => handleExport("json")} disabled={busy === "json"}>
          패턴 JSON 내보내기 Muster als JSON
        </button>
      </div>

      <div className="section-title">엑셀로 여러 패턴 한번에 추가 Muster-Import</div>
      <div className="row">
        <button className="btn ghost" onClick={handleTemplate}>
          📄 패턴 템플릿(xlsx) 다운로드 Vorlage herunterladen
        </button>
      </div>
      <p className="muted" style={{ margin: "6px 0 10px" }}>
        템플릿의 열: 패턴 · 뜻 · 예문1 · 예문1뜻 · 예문2 · 예문2뜻 …
        &ldquo;패턴&rdquo; 칸에는 sich auf + Akk. freuen, teilnehmen an + Dat. 처럼 적습니다(격은 Akk./Dat./Gen.).
        &ldquo;패턴&rdquo; 열 대신 동사 · 재귀(sich) · 전치사 · 격 열로 나눠 써도 됩니다.
        이미 등록된 패턴과 같은 것은 건너뜁니다. 예문 열은 몇 개든 추가할 수 있습니다.
      </p>
      <label style={{ marginBottom: 4 }}>엑셀 파일 선택 Excel-Datei auswählen</label>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImport}
        disabled={busy === "import"}
        style={{ marginBottom: 4 }}
      />
      {busy === "import" && <p className="muted">가져오는 중입니다...</p>}

      <div className="section-title">패턴 전체 삭제 Alle Muster löschen</div>
      <p className="muted" style={{ marginBottom: 10 }}>
        등록한 모든 패턴과 예문, 복습 기록이 삭제되며 되돌릴 수 없습니다. 먼저 위의 JSON
        내보내기로 백업하세요. 계속하려면 아래 칸에 &ldquo;삭제&rdquo;를 입력하세요.
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
          {busy === "delete" ? "삭제 중... Löscht..." : "모든 패턴 삭제 Alle Muster löschen"}
        </button>
      </div>

      {message && <p className="muted" style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}
