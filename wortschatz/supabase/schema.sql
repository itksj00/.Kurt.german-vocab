-- 이미 Supabase SQL Editor에서 실행하셨다면 다시 실행하지 않아도 됩니다.
-- 참고/백업용으로 저장소에 함께 둡니다.

create table if not exists words (
  id bigint generated always as identity primary key,
  word text not null,
  meaning text not null,
  part_of_speech text,
  pronunciation text,
  difficulty text,
  wrong_count int not null default 0,
  last_studied_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists examples (
  id bigint generated always as identity primary key,
  word_id bigint not null references words(id) on delete cascade,
  sentence text not null
);

create table if not exists review_items (
  id bigint generated always as identity primary key,
  word_id bigint not null references words(id) on delete cascade,
  added_at timestamptz not null default now(),
  resolved boolean not null default false
);

-- 이 앱은 "완전 공개" 배포로 결정했으므로 RLS(Row Level Security)는 켜지 않습니다.
-- 기본적으로 새 테이블은 RLS가 꺼져 있어 anon key로 모든 CRUD가 바로 동작합니다.
