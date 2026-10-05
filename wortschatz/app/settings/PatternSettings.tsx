"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import { PATTERN_SELECT, patternText, typeLabel } from "@/lib/patterns";
import { explainPatternRowFailure, parsePatternRow, patternKey } from "@/lib/patternImport";
import { readAllRows } from "@/lib/xlsxRows";
import { fetchAllRows } from "@/lib/supabaseFetch";
import type { Pattern } from "@/lib/types";

const TEMPLATE_HEADERS = ["유형", "앞말", "재귀", "전치사", "격", "표현", "뜻", "메모", "예문1", "예문1뜻", "예문2", "예문2뜻"];

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
  type: string;
  head: string;
  reflexive: boolean;
  preposition: string;
  pattern_case: string;
  expression: string;
  meaning: string;
  note: string;
  wrong_count: number;
  examples: { sentence: string; translation: string | null }[];
};

export default function PatternSettings() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchAll(): Promise<FullPattern[]> {
    const { data, error } = await supabase
      .from("patterns")
      .select(PATTERN_SELECT)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const { data: exs } = await supabase
      .from("pattern_examples")
      .select("pattern_id, sentence, translation");
    return ((data ?? []) as unknown as Pattern[]).map((p) => ({
      pattern: patternText(p),
      type: typeLabel(p.pattern_type),
      head: p.verb ?? "",
      reflexive: p.reflexive,
      preposition: p.preposition ?? "",
      pattern_case: p.pattern_case ?? "",
      expression: p.expression ?? "",
      meaning: p.meaning,
      note: p.note ?? "",
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
        const header = ["패턴", "유형", "앞말", "재귀", "전치사", "격", "표현", "뜻", "메모", "틀린횟수", "예문", "예문뜻"];
        const lines = [header.join(",")];
        for (const r of rows) {
          const cells = [
            r.pattern,
            r.type,
            r.head,
            r.reflexive ? "sich" : "",
            r.preposition,
            r.pattern_case,
            r.expression,
            r.meaning,
            r.note,
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
      ["동사", "freuen", "sich", "auf", "Akk.", "", "~을 기대하다", "", "Ich freue mich auf das Wochenende.", "나는 주말이 기대된다.", "", ""],
      ["동사", "teilnehmen", "", "an", "Dat.", "", "~에 참가하다", "분리동사", "Er nimmt an dem Kurs teil.", "그는 수업에 참가한다.", "", ""],
      ["명사", "Angst", "", "vor", "Dat.", "", "~이 두렵다", "", "Ich habe Angst vor Spinnen.", "나는 거미가 무섭다.", "", ""],
      ["전치사", "", "", "aufgrund", "Gen.", "", "~때문에", "격식체", "Aufgrund des Regens bleiben wir zu Hause.", "비 때문에 우리는 집에 있는다.", "", ""],
      ["접속사", "", "", "", "", "sowohl … als auch …", "~뿐 아니라 ~도", "두 부분이 한 쌍", "Er spricht sowohl Deutsch als auch Englisch.", "그는 독일어도 영어도 한다.", "", ""],
      ["접속사", "", "", "", "", "obwohl", "~임에도 불구하고", "부문장: 동사가 문장 끝", "Ich gehe spazieren, obwohl es regnet.", "비가 오는데도 나는 산책한다.", "", ""],
      ["표현", "", "", "", "", "eine wichtige Rolle spielen", "중요한 역할을 하다", "", "Die Digitalisierung spielt eine wichtige Rolle im Alltag.", "디지털화는 일상에서 중요한 역할을 한다.", "", ""],
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
      // 모든 시트의 데이터 행을 읽는다 (시트 범위 정보가 잘못된 파일도 처리)
      const rows = readAllRows(wb);

      // 이미 있는 패턴(그리고 같은 파일 안의 반복)은 건너뛴다.
      const existing = await fetchAllRows<Pattern>(
        "patterns",
        "id, pattern_type, verb, reflexive, preposition, pattern_case, expression"
      );
      const seen = new Set(existing.map((p) => patternKey(p)));

      let success = 0;
      let fail = 0;
      let skipped = 0;
      const reasons: string[] = [];
      const noteFail = (r: { sheet: string; rowNo: number }, why: string) => {
        fail++;
        if (reasons.length < 8) reasons.push(`· ${r.sheet} ${r.rowNo}행: ${why}`);
      };
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        setProgress(`${i + 1} / ${rows.length}`);
        const parsed = parsePatternRow(r.data);
        if (!parsed) {
          noteFail(r, explainPatternRowFailure(r.data));
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
          noteFail(r, `저장 실패 (${error?.message ?? "알 수 없음"})`);
          continue;
        }
        seen.add(key);
        if (parsed.examples.length > 0) {
          const { error: exErr } = await supabase
            .from("pattern_examples")
            .insert(parsed.examples.map((x) => ({ pattern_id: inserted.id, ...x })));
          if (exErr) reasons.push(`· ${r.sheet} ${r.rowNo}행: 패턴은 저장됐지만 예문 저장 실패 (${exErr.message})`);
        }
        success++;
      }
      window.dispatchEvent(new Event("wortschatz:words-changed"));
      window.dispatchEvent(new Event("wortschatz:sort-changed"));
      setMessage(
        `패턴 가져오기 완료: 읽은 행 ${rows.length}개 → 성공 ${success}건, 중복 건너뜀 ${skipped}건, 실패 ${fail}건` +
          (reasons.length ? `\n${reasons.join("\n")}` : "")
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "엑셀 파일을 읽지 못했습니다.");
    } finally {
      setBusy(null);
      setProgress("");
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
        템플릿의 열: 유형 · 앞말 · 재귀 · 전치사 · 격 · 표현 · 뜻 · 메모 · 예문1 · 예문1뜻 …
        유형은 동사 / 명사(형용사 포함) / 전치사 / 접속사 / 표현(고정 표현·연어) 중 하나입니다. 동사·명사는 앞말+전치사+격,
        전치사는 전치사+격(예: aufgrund + Gen.), 접속사와 표현은 표현 칸(예: sowohl … als auch …, eine wichtige Rolle spielen)만 채우면 됩니다.
        재귀동사는 재귀 칸에 sich를 적으세요. 열을 나누지 않고 &ldquo;패턴&rdquo; 한 칸에
        sich auf + Akk. freuen, aufgrund + Gen. 처럼 적어도 인식합니다(접속사·표현은 유형 칸에 접속사/표현으로 지정).
        이미 등록된 패턴과 같은 것은 건너뜁니다. 예문 열은 몇 개든 추가할 수 있고, 시트가 여러 개면 모든 시트를 읽습니다(시트마다 첫 행이 열 이름).
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
      {busy === "import" && <p className="muted">가져오는 중입니다... {progress}</p>}

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

      {message && (
        <p className="muted" style={{ marginTop: 10, whiteSpace: "pre-line" }}>
          {message}
        </p>
      )}
    </div>
  );
}
