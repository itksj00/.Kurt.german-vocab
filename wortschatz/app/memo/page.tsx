"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAllRows } from "@/lib/supabaseFetch";
import { inRange, localDateString, weekRange, type MemoSentence } from "@/lib/memo";
import MemoManage from "./MemoManage";
import MemoQuiz from "./MemoQuiz";

type Tab = "list" | "daily" | "weekly";

export default function MemoPage() {
  const [tab, setTab] = useState<Tab>("list");
  const [rows, setRows] = useState<MemoSentence[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchAllRows<MemoSentence>(
          "memo_sentences",
          "id, sentence, translation, memo_date, created_at"
        );
        if (!active) return;
        data.sort((a, b) => (a.memo_date === b.memo_date ? a.id - b.id : a.memo_date < b.memo_date ? 1 : -1));
        setRows(data);
        setToday(localDateString(new Date())); // 독일 현지(브라우저) 날짜 기준 "오늘"
        setErrorMsg(null);
      } catch (e) {
        if (active) setErrorMsg(e instanceof Error ? e.message : "불러오지 못했습니다.");
      }
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const todayRows = useMemo(() => rows.filter((r) => r.memo_date === today), [rows, today]);
  const weekRows = useMemo(() => {
    if (!today) return [];
    const { from, to } = weekRange(today);
    return rows.filter((r) => inRange(r.memo_date, from, to));
  }, [rows, today]);

  const tabs: { key: Tab; ko: string; de: string }[] = [
    { key: "list", ko: "오늘의 암기", de: "Heute" },
    { key: "daily", ko: "오늘 퀴즈", de: "Tagesquiz" },
    { key: "weekly", ko: "주간 테스트", de: "Wochentest" },
  ];

  return (
    <main className="site-main narrow">
      <div className="page-hero">
        <div>
          <h1>
            독독독 오늘의 암기<small>Auswendig lernen</small>
          </h1>
          <p>하루에 몇 문장씩 통째로 외우고, 그날과 일주일 단위로 점검하세요.</p>
        </div>
        {!loading && !errorMsg && (
          <div className="stat">
            오늘 <b>{todayRows.length}</b>문장
          </div>
        )}
      </div>

      <div className="stepper" style={{ marginBottom: 12 }}>
        {tabs.map((t) => (
          <div
            key={t.key}
            className={`step-opt ${tab === t.key ? "sel" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.ko}
            <small>{t.de}</small>
          </div>
        ))}
      </div>

      {loading && <p className="muted">불러오는 중... Lädt...</p>}
      {errorMsg && <p className="muted">데이터를 불러오지 못했습니다: {errorMsg}</p>}

      {!loading && !errorMsg && tab === "list" && (
        <MemoManage rows={rows} today={today} onChanged={() => setReloadKey((k) => k + 1)} />
      )}
      {!loading && !errorMsg && tab === "daily" && (
        <MemoQuiz key="daily" pool={todayRows} ratio={0.35} scopeLabel="오늘 외운 문장 Heutige Sätze" />
      )}
      {!loading && !errorMsg && tab === "weekly" && (
        <MemoQuiz key="weekly" pool={weekRows} ratio={0.55} scopeLabel="최근 7일 문장 Letzte 7 Tage" />
      )}
    </main>
  );
}
