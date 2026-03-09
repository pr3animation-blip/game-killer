import type { Metadata } from "next";
import { Saira, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const saira = Saira({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Game Killer - Arena Shooter",
  description: "FPS Arena Shooter built with Three.js + Next.js + Electron",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${saira.variable} ${jetbrainsMono.variable} font-display antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
