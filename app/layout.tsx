import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AnchorP LMS",
  description: "Training LMS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
