import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { JournalProvider } from "@/components/JournalProvider";
import { RaceCatalogProvider } from "@/components/RaceCatalogProvider";
import { RaceDayProvider } from "@/components/RaceDayProvider";
import { SettingsProvider } from "@/components/SettingsProvider";
import { loadRaceCatalog } from "@/data/loadCatalog";
import "./globals.css";

export const dynamic = "force-dynamic";

/** 源ノ角ゴシック（Source Han Sans JP）相当。Google Fonts では Noto Sans JP */
const jp = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "UMANOTE | 高配当候補の選別",
  description:
    "JRA全券種のオッズゲートと複勝圏スコアで、穴になりうる買い目を見極めるデモサイト。",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }, { url: "/favicon.ico" }],
    apple: [{ url: "/apple-icon.png" }],
  },
  openGraph: {
    title: "UMANOTE | 高配当候補の選別",
    description:
      "JRA全券種のオッズゲートと複勝圏スコアで、穴になりうる買い目を見極めるデモサイト。",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "UMANOTE" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialCatalog = await loadRaceCatalog();

  return (
    <html lang="ja" className={`${jp.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SettingsProvider>
          <RaceCatalogProvider initial={initialCatalog}>
            <RaceDayProvider>
              <JournalProvider>{children}</JournalProvider>
            </RaceDayProvider>
          </RaceCatalogProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
