"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Word } from "@/lib/types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PAGE_SIZE = 10;

// 독일어 움라우트를 알파벳 그리드 상 같은 칸으로 묶기 위한 정규화.
function normalizeFirstLetter(word: string): string {
  const c = word.trim().charAt(0).toUpperCase();
  const map: Record<string, string> = { Ä: "A", Ö: "O", Ü: "U" };
  return map[c] ?? c;
}

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("전체");
  const [difficultyFilter, setDifficultyFilter] = useState("전체");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("words")
        .select(
          "id, word, meaning, part_of_speech, pronunciation, difficulty, wrong_count, last_studied_at, created_at"
        )
        .order("word", { ascending: true });
      if (!active) return;
      if (error) {
        setErrorMsg(error.message);
      } else {
        setWords(data ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of words) {
      const letter = normalizeFirstLetter(w.word);
      counts[letter] = (counts[letter] ?? 0) + 1;
    }
    return counts;
  }, [words]);

  const posOptions = useMemo(() => {
    const set = new Set(words.map((w) => w.part_of_speech).filter(Boolean) as string[]);
    return Array.from(set);
  }, [words]);

  const isSearching = search.trim().length > 0;

  const filtered = useMemo(() => {
    let list = words;
    if (isSearching) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (w) =>
          w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
      );
    } else if (selectedLetter) {
      list = list.filter((w) => normalizeFirstLetter(w.word) === selectedLetter);
    } else {
      return [];
    }
    if (posFilter !== "전체") {
      list = list.filter((w) => w.part_of_speech === posFilter);
    }
    if (difficultyFilter !== "전체") {
      list = list.filter((w) => w.difficulty === difficultyFilter);
    }
    return list;
  }, [words, isSearching, search, selectedLetter, posFilter, difficultyFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetToGrid() {
    setSelectedLetter(null);
    setSearch("");
    setPage(1);
  }

  const showListView = isSearching || !!selectedLetter;

  return (
    <section>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>검색 Suche</label>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="단어 또는 뜻 검색"
            />
          </div>
        </div>

        {loading && <p className="muted">불러오는 중...</p>}
        {errorMsg && <p className="muted">데이터를 불러오지 못했습니다: {errorMsg}</p>}

        {!loading && !errorMsg && (
          <>
            <p className="muted" style={{ marginBottom: 10 }}>
              총 <b style={{ color: "var(--ink)" }}>{words.length}</b>개 단어{" "}
              <span style={{ opacity: 0.7 }}>Wörter insgesamt</span>
            </p>

            {!showListView && (
              <>
                <div className="az-grid">
                  {ALPHABET.map((letter) => (
                    <button
                      key={letter}
                      className={`az-cell ${letterCounts[letter] ? "has" : ""}`}
                      onClick={() => {
                        setSelectedLetter(letter);
                        setPage(1);
                      }}
                    >
                      {letter}
                      <small>{letterCounts[letter] ?? 0}</small>
                    </button>
                  ))}
                </div>
                <p className="muted" style={{ marginTop: 10 }}>
                  글자를 누르면 해당 단어 목록이 나옵니다. Buchstabe antippen, um Wörter zu sehen.
                </p>
              </>
            )}

            {showListView && (
              <>
                {!isSearching && (
                  <button className="btn ghost small" onClick={resetToGrid}>
                    ‹ 전체 글자로 Zurück zum Alphabet
                  </button>
                )}
                <div className="row" style={{ margin: "10px 0" }}>
                  <div className="field">
                    <label>품사 Wortart</label>
                    <select
                      value={posFilter}
                      onChange={(e) => {
                        setPosFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option>전체</option>
                      {posOptions.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>난이도 Niveau</label>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => {
                        setDifficultyFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option>전체</option>
                      {["A1", "A2", "B1", "B2", "C1", "C2"].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isSearching && (
                  <div className="section-title">&ldquo;{search}&rdquo; 검색 결과</div>
                )}
                {!isSearching && selectedLetter && (
                  <div className="section-title">{selectedLetter}로 시작하는 단어</div>
                )}

                {filtered.length === 0 && (
                  <p className="empty-state">해당하는 단어가 없습니다.</p>
                )}

                {pageItems.map((w) => (
                  <div className="word-row" key={w.id}>
                    <Link href={`/words/${w.id}`} className="word-main">
                      {w.word}
                      <small>
                        {[w.part_of_speech, w.difficulty].filter(Boolean).join(" · ")}
                        {w.pronunciation ? ` · 발음 [${w.pronunciation}]` : ""}
                      </small>
                    </Link>
                    {w.wrong_count > 0 && (
                      <span className="tag">틀림 {w.wrong_count}회</span>
                    )}
                  </div>
                ))}

                {filtered.length > PAGE_SIZE && (
                  <div className="page-controls">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ‹
                    </button>
                    <button className="now">{page}</button>
                    <span className="muted">/ {totalPages}</span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <Link href="/words/add" className="btn">
        + 단어 추가 Wort hinzufügen
      </Link>
    </section>
  );
}
