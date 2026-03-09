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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap"
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
