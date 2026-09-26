import type { Metadata } from "next";
import NavBar from "./NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "나만의 독일어 단어장",
  description: "Wortschatz — 개인용 독일어 단어 사전",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <NavBar />
          {children}
        </div>
      </body>
    </html>
  );
}
