// 실행: npx tsc lib/patternImport.ts lib/patternQuiz.ts lib/patterns.ts --outDir /tmp/x2 --module commonjs --target es2022 --skipLibCheck  후  node tests/patternExpr.test.cjs
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("assert");
const { parsePatternRow, explainPatternRowFailure, patternKey } = require("/tmp/x2/patternImport.js");
const { isSentenceExpression, patternText } = require("/tmp/x2/patterns.js");
const { buildPatternQuestion, eligiblePatternKinds } = require("/tmp/x2/patternQuiz.js");

const SENT = "Die Digitalisierung spielt eine wichtige Rolle im Alltag.";
const MEAN = "디지털화는 일상에서 중요한 역할을 한다.";

// 1) 문장 판정
assert.strictEqual(isSentenceExpression(SENT), true);
assert.strictEqual(isSentenceExpression("Wie geht es dir?"), true);
assert.strictEqual(isSentenceExpression("ich habe keine Lust auf Arbeit heute"), true); // 6단어
assert.strictEqual(isSentenceExpression("eine wichtige Rolle spielen"), false);
assert.strictEqual(isSentenceExpression("es geht um …"), false);

// 2) 엑셀: 유형 + 문장 + 뜻 (3열)
let r = parsePatternRow({ 유형: "표현", 문장: SENT, 뜻: MEAN });
assert.ok(r);
assert.strictEqual(r.pattern.pattern_type, "expr");
assert.strictEqual(r.pattern.expression, SENT);
assert.strictEqual(r.pattern.meaning, MEAN);
assert.strictEqual(r.pattern.verb, null);
assert.strictEqual(r.pattern.preposition, null);
assert.strictEqual(r.pattern.pattern_case, null);
assert.deepStrictEqual(r.examples, []);

// 기존 "표현" 열도 그대로 동작
r = parsePatternRow({ 유형: "표현", 표현: "eine wichtige Rolle spielen", 뜻: "중요한 역할을 하다" });
assert.strictEqual(r.pattern.pattern_type, "expr");
assert.strictEqual(r.pattern.expression, "eine wichtige Rolle spielen");

// 표현 열이 있으면 문장 열보다 우선
r = parsePatternRow({ 유형: "표현", 표현: "A B C", 문장: "다른 값", 뜻: "x" });
assert.strictEqual(r.pattern.expression, "A B C");

// 유형 생략 + 문장 열 → 여러 단어이므로 고정 표현
r = parsePatternRow({ 문장: SENT, 뜻: MEAN });
assert.strictEqual(r.pattern.pattern_type, "expr");

// 문장 열 + 접속사 유형은 접속사로 유지
r = parsePatternRow({ 유형: "접속사", 문장: "obwohl", 뜻: "~임에도 불구하고" });
assert.strictEqual(r.pattern.pattern_type, "conj");

// 예문 열은 그대로 읽는다
r = parsePatternRow({ 유형: "표현", 문장: SENT, 뜻: MEAN, 예문1: "Ein Satz.", 예문1뜻: "한 문장." });
assert.deepStrictEqual(r.examples, [{ sentence: "Ein Satz.", translation: "한 문장." }]);

// 실패: 뜻 없음 / 문장 없음 — 이유 문구
assert.strictEqual(parsePatternRow({ 유형: "표현", 문장: SENT, 뜻: "" }), null);
assert.strictEqual(explainPatternRowFailure({ 유형: "표현", 문장: SENT, 뜻: "" }), "뜻이 비어 있음");
assert.strictEqual(parsePatternRow({ 유형: "표현", 문장: "", 뜻: MEAN }), null);
assert.match(explainPatternRowFailure({ 유형: "표현", 문장: "", 뜻: MEAN }), /문장/);

// 중복 키: 같은 문장은 같은 키, 대소문자/공백 차이 무시
const k1 = patternKey(parsePatternRow({ 유형: "표현", 문장: SENT, 뜻: MEAN }).pattern);
const k2 = patternKey(parsePatternRow({ 유형: "표현", 문장: "  " + SENT.toLowerCase().replace(/ /g, "  "), 뜻: "x" }).pattern);
assert.strictEqual(k1, k2);

// 3) 퀴즈: 문장형 고정 표현은 별도 예문 없이도 빈칸/배열 문제가 나온다
const mk = (id, expression, meaning, type = "expr") => ({
  id, pattern_type: type, verb: null, reflexive: false, preposition: null, pattern_case: null,
  expression, note: null, meaning, wrong_count: 0, last_studied_at: null, created_at: "", review_stage: 0,
  next_review_at: null, sorted_at: "x", sort_result: "known",
});
const all = [
  mk(1, SENT, MEAN),
  mk(2, "Viele Menschen verbringen ihre Freizeit mit dem Smartphone.", "많은 사람들이 여가를 스마트폰으로 보낸다."),
  mk(3, "Die Regierung übernimmt die Verantwortung für die Entscheidung.", "정부는 그 결정에 책임을 진다."),
  mk(4, "Er trifft jeden Morgen eine wichtige Entscheidung über den Tag.", "그는 매일 아침 중요한 결정을 내린다."),
  mk(5, "eine wichtige Rolle spielen", "중요한 역할을 하다"),
];
const noEx = {};
const kinds = eligiblePatternKinds(all[0], all, noEx);
for (const k of ["exprInput", "exprCloze", "exprWord", "reorder", "meaningToPattern"]) {
  assert.ok(kinds.includes(k), `문장형 고정 표현에서 ${k} 가능해야 함: ${kinds}`);
}

// 구구단식 무작위 반복: 모든 문제가 올바르게 만들어진다
let seed = 12345;
const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const seen = new Set();
const sentWords = SENT.replace(/[.,]/g, "").split(/\s+/);
for (let i = 0; i < 400; i++) {
  const q = buildPatternQuestion(all[0], all, noEx, rng);
  seen.add(q.kind);
  assert.strictEqual(q.wordId, 1);
  if (q.format === "choice") assert.ok(q.options.includes(q.answer), `${q.kind}: 정답이 보기에 있어야 함`);
  if (q.kind === "exprCloze" || q.kind === "exprWord") {
    assert.ok(q.prompt.includes("_____"), "빈칸 표시");
    assert.ok(sentWords.includes(q.answer), `정답은 문장 속 단어여야 함: ${q.answer}`);
    assert.strictEqual(q.prompt.replace("_____", q.answer), SENT);
    assert.strictEqual(q.sub, `예문 뜻 Übersetzung: ${MEAN}`);
    if (q.format === "choice") assert.strictEqual(new Set(q.options).size, 4);
  }
  if (q.kind === "reorder") {
    assert.strictEqual(q.answer, SENT);
    assert.deepStrictEqual([...q.tokens].sort(), SENT.split(" ").sort());
    assert.strictEqual(q.prompt, MEAN);
  }
  if (q.kind === "exprInput") {
    assert.strictEqual(q.answer, SENT);
    assert.strictEqual(q.prompt, MEAN);
  }
  // 풀이 후 설명에 같은 문장이 중복으로 나오지 않는다
  const lines = q.reveal.split("\n");
  assert.strictEqual(new Set(lines).size, lines.length, `reveal 중복: ${JSON.stringify(lines)}`);
}
for (const k of ["exprCloze", "exprWord", "reorder", "exprInput", "meaningToPattern"]) assert.ok(seen.has(k), `${k} 출제됨`);

// 4) 기존 짧은 구(예문 없음)는 이전과 같이 빈칸 문제가 나오지 않는다
const kPhrase = eligiblePatternKinds(all[4], all, noEx);
assert.ok(!kPhrase.includes("exprCloze") && !kPhrase.includes("exprWord") && !kPhrase.includes("reorder"));
assert.ok(kPhrase.includes("exprInput"));

// 5) 별도 예문이 있어도 정상 (표현 문장과 같은 예문은 중복 추가하지 않는다)
const withEx = { 1: [{ sentence: SENT, translation: MEAN }, { sentence: "Eine andere wichtige Rolle spielt die Bildung.", translation: "교육도 중요한 역할을 한다." }] };
for (let i = 0; i < 100; i++) {
  const q = buildPatternQuestion(all[0], all, withEx, rng);
  const lines = q.reveal.split("\n");
  assert.strictEqual(new Set(lines).size, lines.length);
}

// 6) 화면 표기: 고정 표현은 문장 그대로
assert.strictEqual(patternText(all[0]), SENT);

console.log("patternExpr: all tests passed");
