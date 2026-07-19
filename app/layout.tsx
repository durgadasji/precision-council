import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Precision Council for AI",
  description:
    "A browser evaluation council that scores candidates with independent agents across model providers, and grades how independent that convergence really is. Council logic from the Octant Council Builder (Golem Foundation).",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
