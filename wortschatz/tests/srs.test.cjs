// 실행: npx tsc lib/srs.ts lib/sort.ts --outDir /tmp/x6 --module commonjs --target es2022 --skipLibCheck  후  TZ=Europe/Berlin node tests/srs.test.cjs
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("assert");
const { nextSchedule, startOfDayAfter, isDue } = require("/tmp/x6/srs.js");
const { undoPatch, sortPatch } = require("/tmp/x6/sort.js");

const at = (y, m, d, h, mi = 0) => new Date(y, m - 1, d, h, mi).getTime(); // 현지 시각
const day = (iso) => { const d = new Date(iso); return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]; };

// 같은 날 몇 시에 풀어도 다음 복습은 현지 N일 뒤 0시
for (const h of [0, 9, 22, 23]) {
  assert.deepStrictEqual(day(nextSchedule(0, true, at(2026, 11, 2, h)).next_review_at), [2026, 11, 4, 0, 0]); // 0→1단계: 2일
  assert.deepStrictEqual(day(nextSchedule(3, false, at(2026, 11, 2, h)).next_review_at), [2026, 11, 3, 0, 0]); // 오답: 1일
}
// 최종 단계 유지(30일), 월 경계
assert.deepStrictEqual(day(nextSchedule(5, true, at(2026, 11, 2, 22)).next_review_at), [2026, 12, 2, 0, 0]);
assert.strictEqual(nextSchedule(5, true, at(2026, 11, 2, 22)).review_stage, 5);
// 22시에 푼 1일 단계 항목은 다음 날 아침 9시에 이미 복습 대상
const wrong = nextSchedule(2, false, at(2026, 11, 2, 22));
assert.strictEqual(isDue(wrong.next_review_at, at(2026, 11, 3, 9)), true);
assert.strictEqual(isDue(wrong.next_review_at, at(2026, 11, 2, 23, 59)), false);
// 서머타임 전환(2026-03-29)을 지나도 0시 유지
assert.deepStrictEqual(day(startOfDayAfter(2, at(2026, 3, 28, 22))), [2026, 3, 30, 0, 0]);
// 너무 늦게 푼 경우 단계 유지 (기존 동작)
const late = nextSchedule(1, true, at(2026, 11, 10, 12), new Date(at(2026, 11, 5, 0)).toISOString());
assert.strictEqual(late.review_stage, 1);
// 분류/되돌리기도 내일 0시
assert.deepStrictEqual(day(undoPatch(at(2026, 11, 2, 22)).next_review_at), [2026, 11, 3, 0, 0]);
assert.deepStrictEqual(day(sortPatch("known", at(2026, 11, 2, 22)).next_review_at), [2026, 11, 3, 0, 0]);
console.log("srs: all tests passed");
