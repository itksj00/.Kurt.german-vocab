import type { Metadata } from "next";
import NavBar from "./NavBar";
import ThemeToggle from "./ThemeToggle";
import SkylineBackground from "./SkylineBackground";
import "./globals.css";

export const metadata: Metadata = {
  title: "나만의 독일어 단어장 · Wortschatz",
  description: "Wortschatz — 개인용 독일어 단어 사전",
};

// 페이지가 그려지기 전에 저장된 테마를 적용해서 다크모드 전환 시 깜빡임(FOUC)을 막습니다.
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem("wortschatz-theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SkylineBackground />
        <header className="site-header">
          <div className="logo">
            <b>나만의 독일어 단어장</b>
            <span>Mein Wortschatz</span>
          </div>
          <NavBar />
          <div className="header-right">
            <ThemeToggle />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
