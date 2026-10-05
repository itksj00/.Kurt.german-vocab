-- 새 단어 "알아요/몰라요" 분류용 컬럼 추가. Supabase SQL Editor에서 실행하세요 (여러 번 실행해도 안전).
-- 반드시 코드 배포(Vercel)보다 먼저 실행해야 합니다.
--   sorted_at   : null이면 아직 분류하지 않은 새 단어 (분류 전에는 퀴즈에 나오지 않음)
--   sort_result : 'known'(알아요) / 'unknown'(몰라요)
do $$
begin
  -- 컬럼을 처음 만들 때만 기존 단어를 모두 "분류 완료"로 처리한다.
  -- (재실행 시 분류 대기 중인 새 단어가 완료로 바뀌지 않도록 컬럼 존재 여부로 보호)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'words' and column_name = 'sorted_at'
  ) then
    alter table words add column sorted_at timestamptz;
    update words set sorted_at = now();
  end if;
end $$;

alter table words add column if not exists sort_result text check (sort_result in ('known', 'unknown'));
