import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/primitives/toast";
import "../styles/design-tokens.css";
import "../styles/legacy-bridge.css";
import "./globals.css";
import "../styles/shell.css";
import "../styles/ui-components.css";
import "../styles/tables.css";
import "./audit-form.css";
import "./analytics.css";
import "./platform.css";
import "../styles/production-light.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Quality Audit",
  description: "Quality audit admin platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} light h-full antialiased`}>
      <body className="min-h-full" style={{ fontFamily: "var(--font-sans)" }}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
