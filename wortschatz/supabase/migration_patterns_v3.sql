-- 패턴 유형에 'expr'(고정 표현·연어·관용구: eine wichtige Rolle spielen 등) 추가.
-- Supabase SQL Editor에서 실행하세요 (여러 번 실행해도 안전). migration_patterns_v2.sql 실행 후,
-- 반드시 코드 배포(Vercel)보다 먼저 실행해야 합니다.
alter table patterns drop constraint if exists patterns_pattern_type_check;
alter table patterns add constraint patterns_pattern_type_check
  check (pattern_type in ('verb', 'noun', 'prep', 'conj', 'expr'));
