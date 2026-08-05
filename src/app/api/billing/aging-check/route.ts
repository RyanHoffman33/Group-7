import { NextRequest, NextResponse } from "next/server";
import { runAgingCheck } from "@/features/billing/aging-check";

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const secrets = [
    process.env.BILLING_CRON_SECRET,
    process.env.CRON_SECRET,
  ].filter(Boolean);
  return Boolean(token && secrets.includes(token));
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAgingCheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/** Vercel Cron may invoke GET; manual/scripts use POST. */
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
