import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TalentStreaming — Descubre Talentos",
  description: "Mira, anima y sube a la cima.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "TalentStreaming — Descubre Talentos",
    description: "Mira, anima y sube a la cima.",
    url: "https://talentstreaming.com",
    siteName: "TalentStreaming",
    images: [
      {
        url: "./og-image.png",
        width: 1200,
        height: 630,
        alt: "TalentStreaming — Descubre Talentos",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TalentStreaming — Descubre Talentos",
    description: "Mira, anima y sube a la cima.",
    images: ["./og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
