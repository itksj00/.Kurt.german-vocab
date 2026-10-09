"use client";

import { useRef, useState } from "react";
import { useEnterAdvance } from "../useEnterAdvance";
import { shuffle } from "@/lib/quizGen";
import {
  checkBlanks,
  compareSentences,
  pickBlanks,
  tokenize,
  type MemoSentence,
  type Token,
} from "@/lib/memo";

// 1단계: 빈칸 맞추기 / 2단계: 문장 전체 직접 입력
type Stage = 1 | 2;
type StageChoice = "both" | "1" | "2";
type Item = { s: MemoSentence; stage: Stage; tokens: Token[]; blanks: number[] };
type Result = { item: Item; ok: boolean };
type Phase = "setup" | "playing" | "result";

const UMLAUTS = ["ä", "ö", "ü", "ß"];

type Props = {
  pool: MemoSentence[];
  ratio: number; // 빈칸 비율 (일일 퀴즈보다 주간 테스트를 더 어렵게)
  scopeLabel: string;
};

function makeItems(pool: MemoSentence[], stages: Stage[], ratio: number): Item[] {
  const out: Item[] = [];
  for (const stage of stages) {
    for (const s of shuffle(pool)) {
      const tokens = tokenize(s.sentence);
      out.push({ s, stage, tokens, blanks: stage === 1 ? pickBlanks(tokens, ratio) : [] });
    }
  }
  return out;
}

export default function MemoQuiz({ pool, ratio, scopeLabel }: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [choice, setChoice] = useState<StageChoice>("both");
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  const [inputs, setInputs] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const [ok, setOk] = useState(false);
  const [capsHint, setCapsHint] = useState(false); // 철자는 맞고 명사 대문자만 빠뜨려 틀림
  const [blankOk, setBlankOk] = useState<boolean[]>([]);
  const [diff, setDiff] = useState<{ word: string; ok: boolean }[]>([]);

  const refs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const focusKey = useRef<string | null>(null);

  function prepare(item: Item) {
    setInputs(new Array(item.blanks.length).fill(""));
    setText("");
    setChecked(false);
    setOk(false);
    setCapsHint(false);
    setBlankOk([]);
    setDiff([]);
    focusKey.current = null;
  }

  function begin(list: Item[]) {
    setItems(list);
    setIdx(0);
    setResults([]);
    prepare(list[0]);
    setPhase("playing");
  }

  function start() {
    if (pool.length === 0) return;
    const stages: Stage[] = choice === "both" ? [1, 2] : choice === "1" ? [1] : [2];
    begin(makeItems(pool, stages, ratio));
  }

  // 틀린 문장만 같은 단계로 다시 (빈칸 위치는 새로 뽑는다)
  function retryWrong() {
    const wrong = results.filter((r) => !r.ok);
    if (wrong.length === 0) return;
    const list: Item[] = [];
    for (const stage of [1, 2] as Stage[]) {
      const ss = wrong.filter((r) => r.item.stage === stage).map((r) => r.item.s);
      list.push(...makeItems(ss, [stage], ratio));
    }
    begin(list);
  }

  function check() {
    const item = items[idx];
    if (!item || checked) return;
    if (item.stage === 1) {
      const res = checkBlanks(item.tokens, item.blanks, inputs);
      setBlankOk(res);
      setOk(res.every(Boolean));
      setCapsHint(!res.every(Boolean) && checkBlanks(item.tokens, item.blanks, inputs, false).every(Boolean));
    } else {
      const cmp = compareSentences(item.s.sentence, text);
      setDiff(cmp.words);
      setOk(cmp.ok);
      setCapsHint(!cmp.ok && compareSentences(item.s.sentence, text, false).ok);
    }
    setChecked(true);
  }

  function next() {
    const item = items[idx];
    const nextResults = [...results, { item, ok }];
    setResults(nextResults);
    if (idx + 1 >= items.length) {
      setPhase("result");
    } else {
      setIdx(idx + 1);
      prepare(items[idx + 1]);
    }
  }

  // Enter = 화면의 주 버튼: 확인 → 다음 (결과 보기). 입력이 비어 있으면 확인 버튼처럼 아무 일도 하지 않는다.
  useEnterAdvance(phase === "playing" && !!items[idx], () => {
    const cur = items[idx];
    if (!cur) return;
    if (checked) next();
    else if (cur.stage === 1 ? inputs.some((v) => v.trim()) : text.trim().length > 0) check();
  });

  function insertChar(ch: string) {
    const key = focusKey.current;
    const el = key ? refs.current[key] : null;
    if (!key || !el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const put = (v: string) => v.slice(0, start) + ch + v.slice(end);
    if (key === "t") setText(put(text));
    else setInputs(inputs.map((v, i) => (String(i) === key ? put(v) : v)));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 1, start + 1);
    });
  }

  // ── 시작 화면 ──
  if (phase === "setup") {
    const options: { key: StageChoice; ko: string; de: string }[] = [
      { key: "both", ko: "1단계 + 2단계", de: "Beide Stufen" },
      { key: "1", ko: "1단계만 (빈칸)", de: "Lückentext" },
      { key: "2", ko: "2단계만 (직접 입력)", de: "Abtippen" },
    ];
    const noTranslation = pool.filter((s) => !s.translation).length;
    return (
      <div className="card">
        <p style={{ marginBottom: 10 }}>
          {scopeLabel}: <b>{pool.length}</b>문장
        </p>
        <div className="stepper">
          {options.map((o) => (
            <div
              key={o.key}
              className={`step-opt ${choice === o.key ? "sel" : ""}`}
              onClick={() => setChoice(o.key)}
            >
              {o.ko}
              <small>{o.de}</small>
            </div>
          ))}
        </div>
        <p className="muted" style={{ margin: "8px 0 10px" }}>
          1단계는 문장 속 일부 단어를 가리고 채우고, 2단계는 뜻을 보고 문장 전체를 직접 입력합니다.
          {noTranslation > 0 && ` 뜻이 없는 ${noTranslation}문장은 2단계에서 첫 단어를 힌트로 보여줍니다.`}
        </p>
        <button className="btn" onClick={start} disabled={pool.length === 0}>
          {pool.length === 0 ? "문장이 없습니다 Keine Sätze" : "퀴즈 시작 Quiz starten"}
        </button>
      </div>
    );
  }

  // ── 결과 화면 ──
  if (phase === "result") {
    const stat = (stage: Stage) => {
      const r = results.filter((x) => x.item.stage === stage);
      return { total: r.length, good: r.filter((x) => x.ok).length };
    };
    const s1 = stat(1);
    const s2 = stat(2);
    const wrong = results.filter((r) => !r.ok);
    const wrongSentences = Array.from(new Map(wrong.map((r) => [r.item.s.id, r.item.s])).values());
    return (
      <div className="card quiz-card">
        <div className="quiz-word">
          {wrong.length === 0 ? "전부 외웠어요! 🎉" : `${results.length - wrong.length} / ${results.length}`}
        </div>
        {s1.total > 0 && (
          <p className="muted">
            1단계 빈칸 맞추기: {s1.good} / {s1.total}
          </p>
        )}
        {s2.total > 0 && (
          <p className="muted">
            2단계 직접 입력: {s2.good} / {s2.total}
          </p>
        )}
        {wrongSentences.length > 0 && (
          <>
            <div className="section-title">다시 외울 문장 Nochmal lernen</div>
            <ul className="muted" style={{ margin: "0 0 4px", paddingLeft: 18 }}>
              {wrongSentences.map((s) => (
                <li key={s.id} style={{ marginBottom: 4 }}>
                  {s.sentence}
                  {s.translation && <div>{s.translation}</div>}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          {wrong.length > 0 && (
            <button className="btn" onClick={retryWrong}>
              틀린 {wrong.length}개 다시 풀기 Fehler wiederholen
            </button>
          )}
          <button className={wrong.length > 0 ? "btn ghost" : "btn"} onClick={() => setPhase("setup")}>
            처음으로 Zurück
          </button>
        </div>
      </div>
    );
  }

  // ── 문제 화면 ──
  const item = items[idx];
  const stageLabel = item.stage === 1 ? "1단계 빈칸 맞추기 Lückentext" : "2단계 직접 입력 Abtippen";
  const anyFilled = item.stage === 1 ? inputs.some((v) => v.trim()) : text.trim().length > 0;

  return (
    <div className="card quiz-card">
      <div className="muted">
        {idx + 1} / {items.length} · {stageLabel}
      </div>

      {item.stage === 1 ? (
        <>
          <div style={{ fontSize: "1.15rem", lineHeight: 2.6, margin: "10px 0" }}>
            {item.tokens.map((tk, i) => {
              const k = item.blanks.indexOf(i);
              if (k === -1) {
                return (
                  <span key={i}>
                    {tk.lead}
                    {tk.core}
                    {tk.trail}{" "}
                  </span>
                );
              }
              const color = checked ? (blankOk[k] ? "var(--accent)" : "var(--danger)") : undefined;
              return (
                <span key={i}>
                  {tk.lead}
                  <input
                    ref={(el) => {
                      refs.current[String(k)] = el;
                    }}
                    value={inputs[k] ?? ""}
                    onChange={(e) => setInputs(inputs.map((v, j) => (j === k ? e.target.value : v)))}
                    onFocus={() => {
                      focusKey.current = String(k);
                    }}
                    disabled={checked}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      width: `${Math.max(5, tk.core.length + 2)}ch`,
                      display: "inline-block",
                      padding: "2px 6px",
                      borderColor: color,
                    }}
                  />
                  {checked && !blankOk[k] && (
                    <small style={{ color: "var(--danger)" }}> ({tk.core})</small>
                  )}
                  {tk.trail}{" "}
                </span>
              );
            })}
          </div>
          {item.s.translation && (
            <p className="muted">뜻 Übersetzung: {item.s.translation}</p>
          )}
        </>
      ) : (
        <>
          <div className="quiz-word" style={{ fontSize: "1.2rem" }}>
            {item.s.translation ?? "뜻이 없는 문장이에요. 외운 문장을 그대로 입력하세요."}
          </div>
          {!item.s.translation && (
            <p className="muted" style={{ marginBottom: 8 }}>
              힌트 Hinweis: {item.tokens[0]?.core}…
            </p>
          )}
          <textarea
            ref={(el) => {
              refs.current["t"] = el;
            }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => {
              focusKey.current = "t";
            }}
            rows={3}
            placeholder="독일어 문장 전체를 입력 Ganzen Satz eingeben"
            disabled={checked}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </>
      )}

      {!checked && (
        <div className="row" style={{ marginTop: 8, gap: 6 }}>
          {UMLAUTS.map((ch) => (
            <button
              key={ch}
              type="button"
              className="btn"
              style={{ flex: "0 0 auto", padding: "6px 14px" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertChar(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      )}

      {checked && (
        <div style={{ marginTop: 10 }}>
          <p style={{ color: ok ? "var(--accent)" : "var(--danger)", fontWeight: 600 }}>
            {ok ? "정답! Richtig!" : "오답 Falsch"}
          </p>
          {capsHint && (
            <p className="muted" style={{ marginTop: 4, color: "var(--danger)" }}>
              명사는 첫 글자를 대문자로 써야 해요 Nomen großschreiben
            </p>
          )}
          {item.stage === 2 && !ok && (
            <p style={{ marginTop: 6 }}>
              {diff.map((w, i) => (
                <span
                  key={i}
                  style={w.ok ? undefined : { color: "var(--danger)", fontWeight: 700 }}
                >
                  {w.word}{" "}
                </span>
              ))}
            </p>
          )}
          {(item.stage === 1 || ok) && <p className="muted" style={{ marginTop: 6 }}>{item.s.sentence}</p>}
          {item.stage === 2 && item.s.translation && <p className="muted">{item.s.translation}</p>}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {checked ? (
          <button className="btn" onClick={next}>
            {idx + 1 >= items.length ? "결과 보기 Ergebnis" : "다음 Weiter"}
          </button>
        ) : (
          <button className="btn" onClick={check} disabled={!anyFilled}>
            확인 Prüfen
          </button>
        )}
      </div>
    </div>
  );
}
