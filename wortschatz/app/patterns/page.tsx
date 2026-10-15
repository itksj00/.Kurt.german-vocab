"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Pattern, PatternCase } from "@/lib/types";
import { fetchAllRows } from "@/lib/supabaseFetch";
import { CASE_OPTIONS, PATTERN_SELECT, PATTERN_TYPES, caseLabel, patternText } from "@/lib/patterns";
import {
  filterPatterns,
  groupPatterns,
  highlightParts,
  typeCounts,
  type CaseFilter,
  type TypeFilter,
} from "@/lib/patternList";

const CASE_TINT: Record<PatternCase, string> = {
  Akk: "color-mix(in srgb, var(--accent) 22%, var(--panel))",
  Dat: "color-mix(in srgb, #d08a2e 24%, var(--panel))",
  Gen: "color-mix(in srgb, #8a63d2 22%, var(--panel))",
};

function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.hit ? (
          <mark
            key={i}
            style={{ background: "color-mix(in srgb, var(--accent) 28%, transparent)", color: "inherit", borderRadius: 3 }}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [exampleCount, setExampleCount] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState<CaseFilter>("전체");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("전체");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const list = await fetchAllRows<Pattern>("patterns", PATTERN_SELECT);
        if (!active) return;
        setPatterns(list);
      } catch (e) {
        if (!active) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setLoading(false);
        return;
      }
      // 예문 개수는 보조 정보라 실패해도 목록은 보여 준다
      try {
        const rows = await fetchAllRows<{ pattern_id: number }>("pattern_examples", "pattern_id");
        if (!active) return;
        const counts: Record<number, number> = {};
        for (const r of rows) counts[r.pattern_id] = (counts[r.pattern_id] ?? 0) + 1;
        setExampleCount(counts);
      } catch {
        // 무시
      }
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => typeCounts(patterns), [patterns]);
  const filtered = useMemo(
    () => filterPatterns(patterns, { search, caseFilter, typeFilter }),
    [patterns, search, caseFilter, typeFilter]
  );
  const groups = useMemo(() => groupPatterns(filtered), [filtered]);
  const query = search.trim();

  return (
    <main className="site-main">
      <div className="page-hero">
        <div>
          <h1>
            패턴 목록<small>Musterliste</small>
          </h1>
          <p>동사·전치사·접속사 패턴과 고정 표현을 검색하고 관리하세요.</p>
        </div>
        {!loading && !errorMsg && (
          <div className="stat">
            <b>{patterns.length}</b>개 패턴 등록됨
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="field">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="패턴, 뜻, 메모 검색 Suche"
          />
        </div>
        <select value={caseFilter} onChange={(e) => setCaseFilter(e.target.value as CaseFilter)}>
          <option value="전체">전체 격 Alle Kasus</option>
          {CASE_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {caseLabel(c)}
            </option>
          ))}
        </select>
        <Link href="/patterns/add" className="btn">
          + 패턴 추가 Muster hinzufügen
        </Link>
      </div>

      {!loading && !errorMsg && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {([{ value: "전체", ko: "전체" }, ...PATTERN_TYPES] as { value: TypeFilter; ko: string }[]).map((t) => {
            const on = typeFilter === t.value;
            return (
              <button
                key={t.value}
                type="button"
                className="btn ghost small"
                aria-pressed={on}
                onClick={() => setTypeFilter(t.value)}
                style={{
                  borderRadius: 999,
                  borderColor: on ? "var(--accent)" : undefined,
                  color: on ? "var(--accent)" : undefined,
                  fontWeight: on ? 600 : undefined,
                }}
              >
                {t.ko} {counts[t.value]}
              </button>
            );
          })}
        </div>
      )}

      {loading && <p className="muted">불러오는 중... Lädt...</p>}
      {errorMsg && <p className="muted">데이터를 불러오지 못했습니다: {errorMsg}</p>}

      {!loading && !errorMsg && (
        <div className="card">
          {filtered.length === 0 ? (
            <p className="empty-state">
              {patterns.length === 0
                ? "등록된 패턴이 없습니다. 패턴을 추가해 보세요."
                : "해당하는 패턴이 없습니다."}
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.type} style={{ marginBottom: 6 }}>
                <div
                  className="muted"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    padding: "12px 4px 6px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <span>
                    {g.ko} <small style={{ fontWeight: 400 }}>{g.de}</small>
                  </span>
                  <span>{g.items.length}</span>
                </div>
                {g.items.map((p) => {
                  const exs = exampleCount[p.id] ?? 0;
                  return (
                    <div className="word-row" key={p.id}>
                      <Link
                        href={`/patterns/${p.id}`}
                        style={{
                          flex: 1,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                          gap: "6px 20px",
                          alignItems: "start",
                          padding: "4px 0",
                        }}
                      >
                        <span style={{ fontWeight: 600, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                          <Highlight text={patternText(p)} query={query} />
                          {p.pattern_case && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: "0.7rem",
                                padding: "1px 8px",
                                borderRadius: 999,
                                background: CASE_TINT[p.pattern_case],
                                fontWeight: 500,
                                verticalAlign: "middle",
                              }}
                            >
                              {p.pattern_case}
                            </span>
                          )}
                        </span>
                        <span style={{ lineHeight: 1.5, overflowWrap: "anywhere" }}>
                          <Highlight text={p.meaning} query={query} />
                          {(p.note || exs > 0) && (
                            <small className="muted" style={{ display: "block", marginTop: 2 }}>
                              {p.note && <Highlight text={p.note} query={query} />}
                              {p.note && exs > 0 && " · "}
                              {exs > 0 && `예문 ${exs}`}
                            </small>
                          )}
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>
      )}
    </main>
  );
}
