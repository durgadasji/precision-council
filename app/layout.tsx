import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--serif", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--mono", display: "swap" });

export const metadata: Metadata = {
  title: "Precision Council for AI",
  description:
    "A browser evaluation council that scores candidates with independent agents across model providers, and grades how independent that convergence really is. A demonstrator under the Precision Toolkit for AI. Council logic from the Octant Council Builder (Golem Foundation).",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
