-- 패턴(동사 + 전치사 + 격) 학습용 테이블. Supabase SQL Editor에서 실행하세요 (여러 번 실행해도 안전).
-- 반드시 코드 배포(Vercel)보다 먼저 실행해야 합니다.
create table if not exists patterns (
  id bigint generated always as identity primary key,
  verb text not null,
  reflexive boolean not null default false,
  preposition text not null,
  pattern_case text not null check (pattern_case in ('Akk', 'Dat', 'Gen')),
  meaning text not null,
  wrong_count int not null default 0,
  last_studied_at timestamptz,
  created_at timestamptz not null default now(),
  review_stage int not null default 0,
  next_review_at timestamptz default now() + interval '1 day'
);

create table if not exists pattern_examples (
  id bigint generated always as identity primary key,
  pattern_id bigint not null references patterns(id) on delete cascade,
  sentence text not null,
  translation text
);

-- 다른 테이블과 같이 RLS는 사용하지 않는다.
alter table patterns disable row level security;
alter table pattern_examples disable row level security;
