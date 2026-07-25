import type { Metadata } from "next";
import { Bricolage_Grotesque, Noto_Sans_JP, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const body = Source_Serif_4({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const jp = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "UMANOTE | 競馬予想サンプル",
  description: "サンプルデータの競馬予想Webサイト。ローカルDocker + Next.js構成。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${display.variable} ${body.variable} ${jp.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-jp)]">
        {children}
      </body>
    </html>
  );
}
