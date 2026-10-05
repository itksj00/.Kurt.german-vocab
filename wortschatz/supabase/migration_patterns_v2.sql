-- 패턴 유형 확장: 동사/명사·형용사 + 전치사 + 격 외에 "전치사 + 격만"(aufgrund + Gen.),
-- "접속사/연결 표현"(sowohl … als auch …, obwohl, wenn)도 저장할 수 있게 한다.
-- Supabase SQL Editor에서 실행하세요 (여러 번 실행해도 안전). migration_patterns.sql 실행 후,
-- 반드시 코드 배포(Vercel)보다 먼저 실행해야 합니다. 기존 패턴은 모두 'verb'(동사+전치사+격)로 유지됩니다.
--   pattern_type : verb(동사) / noun(명사·형용사) / prep(전치사+격만) / conj(접속사·연결 표현)
--   expression   : conj 유형의 전체 표현 (예: sowohl … als auch …)
--   note         : 메모 (어순 등)
alter table patterns add column if not exists pattern_type text not null default 'verb'
  check (pattern_type in ('verb', 'noun', 'prep', 'conj'));
alter table patterns add column if not exists expression text;
alter table patterns add column if not exists note text;

-- 유형에 따라 비어 있을 수 있는 칸
alter table patterns alter column verb drop not null;
alter table patterns alter column preposition drop not null;
alter table patterns alter column pattern_case drop not null;
