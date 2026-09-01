import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/primitives/toast";
import "../styles/design-tokens.css";
import "../styles/legacy-bridge.css";
import "./globals.css";
import "../styles/shell.css";
import "../styles/ui-components.css";
import "../styles/tables.css";
import "../styles/filter-sidebar.css";
import "./audit-form.css";
import "./analytics.css";
import "./platform.css";
import "../styles/production-light.css";

export const metadata: Metadata = {
  title: "Quality Audit",
  description: "Quality audit admin platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Avoid next/font/google here — fetching Inter blocks first paint when Google
 * Fonts is slow/unreachable (common on LAN/offline), which made localhost look
 * like it would not open.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light h-full antialiased">
      <body
        className="min-h-full"
        style={{ fontFamily: "var(--font-sans)" }}
        suppressHydrationWarning
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
