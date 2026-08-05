import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { listAlerts } from "@/features/billing/queries";
import { navSectionsForRole } from "@/features/users/role-nav";
import { getSessionUser } from "@/features/users/session";
import type { AppRole } from "@/features/users/types";
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
  title: "MainEvent | Users & Roles",
  description:
    "MainEvent Contract-to-Cash — role-based dashboards and access control",
};

const BILLING_ALERT_ROLES: AppRole[] = [
  "system_admin",
  "executive",
  "project_manager",
  "accounting",
  "department_manager",
];

async function alertCountForRole(roleKey: AppRole): Promise<number> {
  if (!BILLING_ALERT_ROLES.includes(roleKey)) return 0;
  try {
    const alerts = await Promise.race([
      listAlerts(false),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("alert timeout")), 2500),
      ),
    ]);
    return alerts.length;
  } catch {
    return 0;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionUser();

  if (!session) {
    return (
      <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
        <body className="min-h-full antialiased">{children}</body>
      </html>
    );
  }

  const alertCount = await alertCountForRole(session.roleKey);

  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppShell
          alertCount={alertCount}
          session={{
            fullName: session.fullName,
            email: session.email,
            roleName: session.roleName,
            roleKey: session.roleKey,
          }}
          navSections={navSectionsForRole(session.roleKey)}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
