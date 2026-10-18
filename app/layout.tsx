import type { Metadata } from "next";
import { M_PLUS_2 } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://fare.cnion.dev/'),
  title: "Fare Map | 運賃マップ",
  description: "起点駅からの運賃を地図上に表示するWebアプリ。首都圏のJR東日本線と私鉄・地下鉄線のきっぷ・IC運賃に対応しています。",
  openGraph: {
    title: 'Fare Map | 運賃マップ',
    description: "起点駅からの運賃を地図上に表示するWebアプリ。首都圏のJR東日本線と私鉄・地下鉄線のきっぷ・IC運賃に対応しています。",
    url: 'https://fare.cnion.dev/',
    siteName: "CoreNion's Page",
    images:
    {
      url: '/icons1.png',
      width: 512,
      height: 512,
      alt: "Fare Map App Icon",
    },
    type: 'website',
  },
  twitter: {
    card: 'summary',
    site: '@CoreiNion',
    creator: '@CoreiNion',
    images: ['https://fare.cnion.dev/icon1.png'], 
  },
};

const mPlus2 = M_PLUS_2({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${mPlus2.className} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
