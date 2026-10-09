// 실행: npx tsc lib/quizGen.ts lib/memo.ts lib/caseRule.ts lib/enterKey.ts --outDir /tmp/x4 --module commonjs --target es2022 --skipLibCheck  후  node tests/caseRule.test.cjs
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("assert");
const { capsOk } = require("/tmp/x4/caseRule.js");
const { isCorrect, isCapsMistake } = require("/tmp/x4/quizGen.js");
const { tokenize, checkBlanks, compareSentences } = require("/tmp/x4/memo.js");
const { shouldIgnoreEnter } = require("/tmp/x4/enterKey.js");

// ── capsOk ──
assert.strictEqual(capsOk("Haus", "haus"), false); // 명사 소문자 → 오답
assert.strictEqual(capsOk("Haus", "Haus"), true);
assert.strictEqual(capsOk("Haus", "HAUS"), true); // 첫 글자가 대문자면 통과
assert.strictEqual(capsOk("gehen", "Gehen"), true); // 소문자 단어를 대문자로 쓴 것은 따지지 않음
assert.strictEqual(capsOk("der Hund", "der hund"), false);
assert.strictEqual(capsOk("der Hund", "der Hund"), true);
assert.strictEqual(capsOk("Die Katze", "die katze"), false); // 단어 하나짜리가 아니면 첫 단어도 검사(sentenceStart=false)
const S = { sentenceStart: true };
assert.strictEqual(capsOk("Die Katze schläft im Haus.", "die Katze schläft im Haus.", S), true); // 문장 첫 단어는 면제
assert.strictEqual(capsOk("Die Katze schläft im Haus.", "die katze schläft im Haus.", S), false);
assert.strictEqual(capsOk("Die Katze schläft im Haus.", "die Katze schläft im haus.", S), false);
assert.strictEqual(capsOk("Es regnet. Der Mann geht.", "es regnet. der Mann geht.", S), true); // 마침표 뒤 첫 단어 면제
assert.strictEqual(capsOk("Es regnet. Der Mann geht.", "es regnet. der mann geht.", S), false);
assert.strictEqual(capsOk("Er sagt: Das Wetter ist schön.", "er sagt: das Wetter ist schön.", S), true); // 콜론 뒤 면제
assert.strictEqual(capsOk("Er sagte: „Das ist gut.“", "er sagte: „das ist gut.“", S), true); // 따옴표 안 첫 단어 면제
// loose(표현·문장 입력): 구두점을 빼고 써도 판정은 같다
const L = { loose: true, sentenceStart: true };
assert.strictEqual(capsOk("Ich weiß, dass das Wetter schön ist.", "ich weiß dass das Wetter schön ist", L), true);
assert.strictEqual(capsOk("Ich weiß, dass das Wetter schön ist.", "ich weiß dass das wetter schön ist", L), false);
// 단어 수가 달라 판단할 수 없으면 기존 비교 결과를 따른다
assert.strictEqual(capsOk("Haus Garten", "haus", {}), true);

// ── isCorrect (퀴즈 유형별) ──
const q = (o) => ({ wordId: 1, label: "", sub: null, reveal: "", umlaut: true, prompt: "뜻", format: "input", ...o });
// 독일어 입력 / 복수형
assert.strictEqual(isCorrect(q({ kind: "deInput", answer: "Haus" }), "Haus"), true);
assert.strictEqual(isCorrect(q({ kind: "deInput", answer: "Haus" }), "haus"), false);
assert.strictEqual(isCorrect(q({ kind: "deInput", answer: "gehen" }), "Gehen"), true);
assert.strictEqual(isCorrect(q({ kind: "plural", answer: "Häuser" }), "häuser"), false);
assert.strictEqual(isCorrect(q({ kind: "plural", answer: "Häuser" }), "Häuser"), true);
assert.strictEqual(isCorrect(q({ kind: "plural", answer: "Häuser" }), "Hauser"), false); // ä↔a 엄격은 그대로
// 입력 빈칸: 빈칸이 문장 중간이면 명사 대문자 필요, 문장 맨 앞이면 면제
assert.strictEqual(isCorrect(q({ kind: "inCloze", prompt: "Das _____ ist groß.", answer: "Haus" }), "haus"), false);
assert.strictEqual(isCorrect(q({ kind: "inCloze", prompt: "Das _____ ist groß.", answer: "Haus" }), "Haus"), true);
assert.strictEqual(isCorrect(q({ kind: "inCloze", prompt: "_____ ist groß.", answer: "Das" }), "das"), true);
assert.strictEqual(isCorrect(q({ kind: "inCloze", prompt: "Es ist spät. _____ Mann geht.", answer: "Der" }), "der"), true);
assert.strictEqual(isCorrect(q({ kind: "inCloze", prompt: "Er sagte: „_____ ist gut.“", answer: "Das" }), "das"), true);
assert.strictEqual(isCorrect(q({ kind: "memoCloze", prompt: "Ich esse das _____.", answer: "Brot" }), "brot"), false);
// 전치사 입력(소문자 정답)은 영향 없음
assert.strictEqual(isCorrect(q({ kind: "prepInput", answer: "auf" }), "AUF"), true);
// 표현/문장 전체 입력
const SENT = "Die Digitalisierung spielt eine wichtige Rolle im Alltag.";
const ei = q({ kind: "exprInput", answer: SENT });
assert.strictEqual(isCorrect(ei, SENT), true);
assert.strictEqual(isCorrect(ei, "die Digitalisierung spielt eine wichtige Rolle im Alltag"), true); // 첫 단어·구두점 면제
assert.strictEqual(isCorrect(ei, "die digitalisierung spielt eine wichtige Rolle im Alltag"), false);
assert.strictEqual(isCorrect(ei, "die Digitalisierung spielt eine wichtige rolle im Alltag"), false);
assert.strictEqual(isCorrect(q({ kind: "memoFull", answer: SENT }), "Die Digitalisierung spielt eine wichtige Rolle im alltag."), false);
assert.strictEqual(isCorrect(q({ kind: "memoFull", answer: SENT }), "die Digitalisierung spielt eine wichtige Rolle im Alltag."), true);
// 기존 판정 유지: 철자 오류는 오답, 공백·정규화 무시
assert.strictEqual(isCorrect(ei, "die Digitalisierung spielt eine wichtige Rolle im Alltagg"), false);
assert.strictEqual(isCorrect(q({ kind: "deInput", answer: "Haus" }), "  Haus  "), true);
assert.strictEqual(isCorrect(q({ kind: "deInput", answer: "Haus" }), ""), false);
// accept 대체 정답에도 적용
const acc = q({ kind: "deInput", answer: "Haus", accept: ["Gebäude"] });
assert.strictEqual(isCorrect(acc, "gebäude"), false);
assert.strictEqual(isCorrect(acc, "Gebäude"), true);
// 배열·객관식은 원문 그대로라 영향 없음
assert.strictEqual(isCorrect(q({ kind: "reorder", format: "reorder", answer: "Die Katze schläft" }), "Die Katze schläft"), true);
assert.strictEqual(isCorrect(q({ kind: "mcCloze", format: "choice", answer: "Haus" }), "Haus"), true);

// ── isCapsMistake (안내 문구용) ──
assert.strictEqual(isCapsMistake(q({ kind: "deInput", answer: "Haus" }), "haus"), true);
assert.strictEqual(isCapsMistake(q({ kind: "deInput", answer: "Haus" }), "Hous"), false); // 철자 오류
assert.strictEqual(isCapsMistake(q({ kind: "deInput", answer: "Haus" }), "Haus"), false); // 정답
assert.strictEqual(isCapsMistake(ei, "die digitalisierung spielt eine wichtige Rolle im Alltag"), true);

// ── 독독독: 1단계 빈칸 ──
let t = tokenize("Ich esse das Brot.");
assert.deepStrictEqual(checkBlanks(t, [3], ["brot"]), [false]);
assert.deepStrictEqual(checkBlanks(t, [3], ["Brot"]), [true]);
assert.deepStrictEqual(checkBlanks(t, [3], ["brot"], false), [true]);
assert.deepStrictEqual(checkBlanks(t, [0], ["ich"]), [true]); // 문장 첫 단어 면제
assert.deepStrictEqual(checkBlanks(t, [1], ["Esse"]), [true]); // 소문자 단어를 대문자로 써도 통과
assert.deepStrictEqual(checkBlanks(t, [3], [""]), [false]);
t = tokenize("Es regnet. Der Mann geht.");
assert.deepStrictEqual(checkBlanks(t, [2, 3], ["der", "mann"]), [true, false]);
assert.deepStrictEqual(checkBlanks(t, [2, 3], ["der", "Mann"]), [true, true]);
t = tokenize('Er sagte: „Das ist gut.“');
assert.deepStrictEqual(checkBlanks(t, [2], ["das"]), [true]);
// 철자 엄격은 그대로
t = tokenize("Das Mädchen lacht.");
assert.deepStrictEqual(checkBlanks(t, [1], ["Madchen"]), [false]);

// ── 독독독: 2단계 문장 전체 ──
let r = compareSentences("Ich esse das Brot.", "ich esse das brot");
assert.strictEqual(r.ok, false);
assert.deepStrictEqual(r.words.map((w) => w.ok), [true, true, true, false]); // Brot만 빨갛게
assert.strictEqual(compareSentences("Ich esse das Brot.", "ich esse das Brot").ok, true);
assert.strictEqual(compareSentences("Ich esse das Brot.", "ich esse das brot", false).ok, true);
assert.strictEqual(compareSentences("Ich esse das Brot.", "Ich esse das Brot.").ok, true);
r = compareSentences("Ich esse das Brot.", "ich esse Brot"); // 단어 빠짐은 기존대로 오답
assert.strictEqual(r.ok, false);
assert.deepStrictEqual(r.words.map((w) => w.ok), [true, true, false, true]);
assert.strictEqual(compareSentences("Es regnet. Der Mann geht.", "es regnet der Mann geht").ok, true);
assert.strictEqual(compareSentences("Es regnet. Der Mann geht.", "es regnet der mann geht").ok, false);
assert.strictEqual(compareSentences("Das Mädchen lacht.", "das Madchen lacht").ok, false);

// ── Enter 키 판정 ──
const ev = (o = {}) => ({ key: "Enter", repeat: false, isComposing: false, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...o });
assert.strictEqual(shouldIgnoreEnter(ev(), { tagName: "BODY" }), false);
assert.strictEqual(shouldIgnoreEnter(ev(), { tagName: "INPUT", disabled: true }), false); // 채점 후 잠긴 입력 칸
assert.strictEqual(shouldIgnoreEnter(ev(), { tagName: "INPUT" }), false); // 입력 칸 안에서도 동작
assert.strictEqual(shouldIgnoreEnter(ev(), { tagName: "TEXTAREA" }), false);
assert.strictEqual(shouldIgnoreEnter(ev(), null), false);
assert.strictEqual(shouldIgnoreEnter(ev(), { tagName: "BUTTON" }), true); // 포커스된 버튼은 브라우저가 처리
assert.strictEqual(shouldIgnoreEnter(ev(), { tagName: "BUTTON", disabled: true }), false); // 눌러서 잠긴 보기 버튼
assert.strictEqual(shouldIgnoreEnter(ev(), { tagName: "A" }), true);
assert.strictEqual(shouldIgnoreEnter(ev({ key: "a" }), { tagName: "BODY" }), true);
assert.strictEqual(shouldIgnoreEnter(ev({ repeat: true }), { tagName: "BODY" }), true);
assert.strictEqual(shouldIgnoreEnter(ev({ isComposing: true }), { tagName: "INPUT" }), true);
assert.strictEqual(shouldIgnoreEnter(ev({ shiftKey: true }), { tagName: "TEXTAREA" }), true);
assert.strictEqual(shouldIgnoreEnter(ev({ ctrlKey: true }), { tagName: "BODY" }), true);

console.log("caseRule: all tests passed");
