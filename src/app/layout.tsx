import type { Metadata } from "next";
import "./globals.css";

/* Typografie: systeemfont (SF Pro / Segoe UI) via --font-ui en --font-brand in globals.css. */

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
    <html lang="nl">
      {/* suppressHydrationWarning: browserextensies (bv. ColorZilla) zetten attributen op <body>. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
