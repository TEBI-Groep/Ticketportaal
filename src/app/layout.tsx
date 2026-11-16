import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/* Expressive UI font — not Inter/Roboto/system defaults. */
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

/* Brand/display face for Tebi wordmark and page titles. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ticketportaal · Tebi",
    template: "%s · Tebi Ticketportaal",
  },
  description:
    "Intern IT-ticketportaal voor Tebi — ranglijst, spoed, stemmen en opvolging.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={`${plusJakarta.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
