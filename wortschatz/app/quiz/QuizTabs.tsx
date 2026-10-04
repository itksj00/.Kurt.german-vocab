"use client";

import { useState } from "react";
import QuizRunner, { type Stage } from "../QuizRunner";
import ModeTabs, { type Mode } from "../ModeTabs";

export default function QuizTabs() {
  const [mode, setMode] = useState<Mode>("word");
  const [stage, setStage] = useState<Stage>("setup");

  return (
    <>
      {/* 퀴즈 진행 중에는 탭을 숨겨 실수로 전환하지 않게 한다. */}
      {stage === "setup" && <ModeTabs mode={mode} onChange={setMode} quiz />}
      <QuizRunner key={mode} mode={mode} onStageChange={setStage} />
    </>
  );
}
