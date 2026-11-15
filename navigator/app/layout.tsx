import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./mission-theme.css";
import "./lunario-fonts.css";

const geist = localFont({
  src: "../public/fonts/lunario/geist-var.woff2",
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lunario — Lunar Landing Site Navigator",
  description:
    "Compare lunar south-pole landing sites and dates. Sun and Earth against the real LOLA horizon, for power and direct-to-Earth contact.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>{children}</body>
    </html>
  );
}
