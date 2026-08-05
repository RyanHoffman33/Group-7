import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { listAlerts } from "@/features/billing/queries";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MainEvent | Billing & A/R",
  description:
    "MainEvent Contract-to-Cash — GAAP-oriented Billing and Accounts Receivable",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let alertCount = 0;
  try {
    const alerts = await listAlerts(false);
    alertCount = alerts.length;
  } catch {
    alertCount = 0;
  }

  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppShell alertCount={alertCount}>{children}</AppShell>
      </body>
    </html>
  );
}
