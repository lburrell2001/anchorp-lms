import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Anchor Academy",
  description: "Anchor Products Training Academy",
  icons: {
    icon: "/logoicon.png", // uses /public/logoicon.png
  },
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

