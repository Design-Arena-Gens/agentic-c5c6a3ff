"use client";

import "./globals.css";
import { useEffect } from "react";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.documentElement.lang = "fa";
    document.title = "Trance Studio";
  }, []);

  return (
    <html lang="fa">
      <body>{children}</body>
    </html>
  );
}
