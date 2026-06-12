import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Resume Matcher",
  description: "Upload resume PDFs locally, paste a job description, and get a private AI-assisted ATS-style match."
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
