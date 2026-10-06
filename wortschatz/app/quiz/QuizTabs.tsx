"use client";

import { useState } from "react";
import QuizRunner, { type Stage } from "../QuizRunner";
import TotalQuiz from "./TotalQuiz";

type Tab = "word" | "pattern" | "total";

const TABS: { key: Tab; ko: string; de: string }[] = [
  { key: "word", ko: "단어 퀴즈", de: "Wort-Quiz" },
  { key: "pattern", ko: "패턴 퀴즈", de: "Muster-Quiz" },
  { key: "total", ko: "토탈 테스트", de: "Gesamttest" },
];

export default function QuizTabs() {
  const [tab, setTab] = useState<Tab>("word");
  const [stage, setStage] = useState<Stage>("setup");

  return (
    <>
      {/* 퀴즈 진행 중에는 탭을 숨겨 실수로 전환하지 않게 한다. */}
      {stage === "setup" && (
        <div className="stepper" style={{ marginBottom: 12 }}>
          {TABS.map((t) => (
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
      )}
      {tab === "total" ? (
        <TotalQuiz key="total" onStageChange={setStage} />
      ) : (
        <QuizRunner key={tab} mode={tab} onStageChange={setStage} />
      )}
    </>
  );
}
