-- 복습(에빙하우스) 기능용 컬럼 추가. Supabase SQL Editor에서 한 번만 실행하세요.
alter table words add column if not exists review_stage int not null default 0;
alter table words add column if not exists next_review_at timestamptz;

-- 이미 등록된 단어는 오늘부터 복습 대상이 되도록 설정
update words set next_review_at = now() where next_review_at is null;

-- 앞으로 추가되는 단어는 추가한 다음날이 첫 복습일 (엑셀 가져오기 포함)
alter table words alter column next_review_at set default (now() + interval '1 day');
