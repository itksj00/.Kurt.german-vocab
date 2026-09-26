# Wortschatz — 나만의 독일어 단어장

개인용 독일어 단어 사전 웹앱. Next.js + Supabase(Postgres) + Vercel, 인증 없음, 완전 공개 배포.

## 기능

- 단어 목록: A-Z 알파벳 그리드 진입 → 글자 클릭 시 해당 단어 표시, 검색, 품사/난이도 필터, 페이지네이션, 총 단어 수 표시
- 단어 추가/수정: 단어/뜻/품사/발음/난이도, 예문 여러 개
- 퀴즈: 범위(전체/최근 추가/난이도별) × 방식(객관식/뜻 입력/플래시카드), 결과 화면에서 틀린 단어 자동으로 복습항목 등록
- 복습항목: 자동 등록된 틀린 단어 모아보기, 해결 처리
- 설정: CSV/JSON 내보내기, 엑셀(xlsx) 템플릿 다운로드 후 일괄 가져오기

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local
# .env.local 에 Supabase Project URL / anon key 입력
npm run dev
```

## 배포 (Vercel)

이미 GitHub 레포 연결 + 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) 등록을 마쳤다면, 이 코드를 push하는 순간 자동 배포됩니다.

## DB

`supabase/schema.sql` 참고 (이미 Supabase에 테이블을 만들어두셨다면 다시 실행할 필요 없음).

## 엑셀 일괄 등록

설정 화면에서 템플릿(xlsx) 다운로드 → 단어/뜻/품사/발음/난이도/예문1~3 채워서 → 같은 화면에서 업로드하면 일괄 등록됩니다.

## 알려진 주의사항

- Supabase 무료 플랜은 7일간 접속이 없으면 프로젝트가 자동 일시정지됩니다. 대시보드에서 재개할 수 있습니다.
- `xlsx` 패키지에 알려진 보안 권고(GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9)가 있습니다. 본인만 사용하는 파일만 업로드하는 개인용 도구라 실질적 위험은 낮지만, 참고해두세요.
