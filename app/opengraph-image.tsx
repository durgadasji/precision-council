import { ImageResponse } from "next/og";

// Generated social-preview card, so a shared or crawled link shows a branded image.
// Next wires this in as og:image and twitter:image.
export const alt = "Precision Council for AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px",
          background: "#14161A",
          color: "#ECEAE2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: "#8aa0b5" }}>
          Precision Council for AI
        </div>
        <div style={{ fontSize: 56, fontWeight: 600, marginTop: 28, lineHeight: 1.1, maxWidth: 960 }}>
          Independent agents score a candidate, and the dial grades how independent that really is.
        </div>
        <div style={{ fontSize: 26, marginTop: 36, color: "#9aa3ab" }}>Precision Toolkit for AI · precision-council.regischapman.com</div>
      </div>
    ),
    { ...size }
  );
}
