-- 명사의 성(der/die/das)과 복수형 컬럼 추가. Supabase SQL Editor에서 한 번만 실행하세요.
-- 반드시 코드 배포(Vercel)보다 먼저 실행해야 합니다.
alter table words add column if not exists gender text check (gender in ('der', 'die', 'das'));
alter table words add column if not exists plural text;
