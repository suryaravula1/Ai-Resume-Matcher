import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Resume Matcher",
  description: "Index resume PDFs once, paste a job description, and find the strongest AI-assisted ATS-style match."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
