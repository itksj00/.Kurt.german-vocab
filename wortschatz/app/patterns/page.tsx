"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Pattern, PatternCase } from "@/lib/types";
import { CASE_OPTIONS, caseLabel, patternText } from "@/lib/patterns";

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState<PatternCase | "전체">("전체");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("patterns")
        .select(
          "id, verb, reflexive, preposition, pattern_case, meaning, wrong_count, last_studied_at, created_at, review_stage, next_review_at, sorted_at, sort_result"
        )
        .order("verb", { ascending: true });
      if (!active) return;
      if (error) setErrorMsg(error.message);
      else setPatterns((data ?? []) as Pattern[]);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patterns.filter((p) => {
      if (caseFilter !== "전체" && p.pattern_case !== caseFilter) return false;
      if (!q) return true;
      return (
        patternText(p).toLowerCase().includes(q) || p.meaning.toLowerCase().includes(q)
      );
    });
  }, [patterns, search, caseFilter]);

  return (
    <main className="site-main narrow">
      <div className="page-hero">
        <div>
          <h1>
            패턴 목록<small>Musterliste</small>
          </h1>
          <p>동사 + 전치사 + 격 패턴을 검색하고 관리하세요.</p>
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
            placeholder="패턴 또는 뜻 검색 Suche"
          />
        </div>
        <select
          value={caseFilter}
          onChange={(e) => setCaseFilter(e.target.value as PatternCase | "전체")}
        >
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
            filtered.map((p) => (
              <div className="word-row" key={p.id}>
                <Link href={`/patterns/${p.id}`} className="word-main" style={{ flex: 1 }}>
                  {patternText(p)}
                  <small>{p.meaning}</small>
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}
