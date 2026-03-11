import type { Metadata } from "next";
import "./globals.css";
import LanguageApplier from "@/components/ui/LanguageApplier";

export const metadata: Metadata = {
  title: "Deddeh Hills — Development Simulator",
  description:
    "Interactive development simulator for Deddeh Hills gated community project in Koura, Lebanon",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <LanguageApplier />
        {children}
      </body>
    </html>
  );
}
