-- 패턴에도 "알아요/몰라요" 분류 컬럼 추가. Supabase SQL Editor에서 실행하세요 (여러 번 실행해도 안전).
-- migration_patterns.sql을 먼저 실행한 뒤에 실행하고, 반드시 코드 배포(Vercel)보다 먼저 실행해야 합니다.
--   sorted_at   : null이면 아직 분류하지 않은 새 패턴 (분류 전에는 퀴즈에 나오지 않음)
--   sort_result : 'known'(알아요) / 'unknown'(몰라요)
do $$
begin
  -- 컬럼을 처음 만들 때만 기존 패턴을 모두 "분류 완료"로 처리한다. (재실행해도 분류 대기 패턴은 유지)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patterns' and column_name = 'sorted_at'
  ) then
    alter table patterns add column sorted_at timestamptz;
    update patterns set sorted_at = now();
  end if;
end $$;

alter table patterns add column if not exists sort_result text check (sort_result in ('known', 'unknown'));
