import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--serif", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--mono", display: "swap" });

const DESC =
  "A browser evaluation council that scores candidates with independent agents across model providers, and grades how independent that convergence really is. A demonstrator under the Precision Toolkit for AI. Council logic from the Octant Council Builder (Golem Foundation).";
const SITE = "https://precision-council.regischapman.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Precision Council for AI",
  description: DESC,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Precision Council for AI",
    description: DESC,
    url: SITE + "/",
    siteName: "Precision Council for AI",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Precision Council for AI", description: DESC },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                { "@type": "WebApplication", name: "Precision Council for AI", url: SITE + "/", description: DESC, applicationCategory: "BusinessApplication" },
                { "@type": "WebSite", name: "Precision Council for AI", url: SITE + "/" },
              ],
            }).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
