import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vchat · your brain",
  description: "Chat with your second brain and edit its documents.",
};

// Dark is Mark's default, so it's the server-rendered class — no flash for the
// common case. Before first paint we strip it only if the user chose light.
const noFlash = `
try {
  if (localStorage.getItem("vchat-theme") === "light") {
    document.documentElement.classList.remove("dark");
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
