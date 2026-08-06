import {
  buildAssistantSystemPrompt,
  buildRoleScopedSnapshot,
} from "@/features/assistant/snapshot";
import { getSessionUser } from "@/features/users/session";
import { roleHasAnyPermission } from "@/features/access/matrix";
import type { AppRole } from "@/features/users/types";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

function canUseAssistant(role: AppRole): boolean {
  if (role === "attendee") return false;
  return roleHasAnyPermission(role, [
    "billing.read",
    "compliance.read",
    "ar.read",
    "dashboards.executive",
    "contracts.read",
    "costs.read",
    "profitability.read",
    "analytics.read",
    "customer.portal",
    "vendor.portal",
    "events.operate",
    "events.assigned_only",
    "approvals.queue",
  ]);
}

async function callGemini(
  apiKey: string,
  system: string,
  snapshot: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [
    ...history.slice(-8).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: `${system}\n\nLIVE ROLE-SCOPED SNAPSHOT:\n${snapshot}`,
          },
        ],
      },
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

async function callGroq(
  apiKey: string,
  system: string,
  snapshot: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `${system}\n\nLIVE ROLE-SCOPED SNAPSHOT:\n${snapshot}`,
        },
        ...history.slice(-8),
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq error ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned an empty response.");
  return text;
}

const ME_CONTRACT_RE = /\bME-\d{4}-\d+\b/i;

/** Pull a PER-CONTRACT / PROFITABILITY line for a human ME- contract number. */
function findContractSnapshotLine(
  snapshot: string,
  contractNumber: string,
): string | null {
  const key = contractNumber.toUpperCase();
  const rows = snapshot.split("\n").filter((l) => l.trim().startsWith("- "));
  const hit = rows.find((l) => l.toUpperCase().includes(key));
  return hit?.trim() ?? null;
}

/** Deterministic fallback when no AI key is configured — still useful for demos. */
function answerFromSnapshot(snapshot: string, question: string): string {
  const q = question.toLowerCase();
  const line = (startsWith: string) => {
    const row = snapshot
      .split("\n")
      .find((l) => l.trim().startsWith(startsWith));
    if (!row) return null;
    const idx = row.indexOf(":");
    return idx >= 0 ? row.slice(idx + 1).trim() : row.trim();
  };

  const meMatch = question.match(ME_CONTRACT_RE);
  if (meMatch) {
    const contractLine = findContractSnapshotLine(snapshot, meMatch[0]);
    if (contractLine) {
      return `From the live snapshot for **${meMatch[0]}**:\n\n${contractLine}\n\n(ME-… is the human contract_number. Recognized amounts appear as "recognized" / "recognized rev" on that line when present.)`;
    }
    return `I do not see contract_number **${meMatch[0]}** in your role-scoped live snapshot. It may be out of scope for your role, or the number may differ (seeded IDs look like ME-2026-…).`;
  }

  if (q.includes("deposit") || q.includes("unearned")) {
    return `From the live snapshot, unearned deposits (contract liability) are **${line("- Unearned deposits (liability)") ?? line("- Unearned deposits") ?? "see deposits section / your contracts"}**. Deposits stay liabilities until applied/earned — cash alone is not revenue.`;
  }
  if (q.includes("aging") || q.includes("90") || q.includes("collect")) {
    return `Portfolio A/R outstanding is **${line("- Total outstanding A/R") ?? "not in your snapshot"}**, with expected collections **${line("- Expected collections") ?? "n/a"}**.`;
  }
  if (q.includes("asset") || q.includes("earned not") || q.includes("not billed")) {
    return `Amounts earned but not yet billed total **${line("- Contract assets (earned not billed)") ?? "not in your snapshot"}**.`;
  }
  if (q.includes("liability") || q.includes("deferred")) {
    return `Contract liabilities are **${line("- Contract liabilities (unearned deposits + deferred billed)") ?? "not in your snapshot"}**. Deferred open A/R is **${line("- Deferred open A/R (billed, not yet recognized)") ?? "n/a"}**.`;
  }
  if (q.includes("recogn") || q.includes("606") || q.includes("revenue")) {
    return `Recognized billed revenue in the position view is **${line("- Recognized revenue (billed & recognized)") ?? "not in your snapshot"}**.`;
  }
  if (q.includes("alert")) {
    return `There are **${line("- Open billing alerts") ?? "n/a"}** unacknowledged aging alerts right now.`;
  }
  if (
    q.includes("commit") ||
    q.includes("actual cost") ||
    (q.includes("cost") && (q.includes("total") || q.includes("how much")))
  ) {
    return `From Cost & Resources: actual costs are **${line("- Total actual costs") ?? "not in your snapshot"}**, open commitments are **${line("- Open commitments") ?? "n/a"}**. Pending cost approvals: **${line("- Pending cost approvals") ?? "n/a"}**.`;
  }
  if (q.includes("flag") || q.includes("exception") || q.includes("no commitment")) {
    return `There are **${line("- Open cost control flags") ?? "n/a"}** cost flags needing attention (when costs are in scope for your role).`;
  }
  if (q.includes("approv") && q.includes("cost")) {
    return `Pending cost approvals: **${line("- Pending cost approvals") ?? "n/a"}**. Threshold: **${line("- Approval threshold") ?? "n/a"}**.`;
  }
  if (q.includes("rfq") || q.includes("inquiry") || q.includes("pipeline")) {
    return `Engagement / RFQ detail is in your role-scoped snapshot under ENGAGEMENT PIPELINE or YOUR RFQs. Ask about a specific event name or status.`;
  }
  if (q.includes("favorability") || q.includes("analytics") || q.includes("yoy")) {
    return `Analytics highlights (when in scope) include trailing revenue **${line("- Trailing ~6mo revenue") ?? "n/a"}** and growth **${line("- YoY / half growth") ?? "n/a"}**.`;
  }

  return [
    "I can answer from your role-scoped MainEvent live snapshot (domains you are allowed to see).",
    "",
    `- Outstanding A/R: ${line("- Total outstanding A/R") ?? "n/a for role"}`,
    `- Unearned deposits: ${line("- Unearned deposits (liability)") ?? "n/a for role"}`,
    `- Contract assets: ${line("- Contract assets (earned not billed)") ?? "n/a for role"}`,
    `- Actual costs: ${line("- Total actual costs") ?? "n/a for role"}`,
    `- Open commitments: ${line("- Open commitments") ?? "n/a for role"}`,
    "",
    "Try asking about a ME- contract number, deposits, aging, costs, work progress, or engagement — within your role.",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canUseAssistant(session.roleKey)) {
      return Response.json(
        {
          error:
            "Access denied — Ask MainEvent is not available for this role.",
        },
        { status: 403 },
      );
    }

    const body = (await req.json()) as {
      message?: string;
      history?: ChatMessage[];
    };
    const message = (body.message ?? "").trim();
    if (!message) {
      return Response.json({ error: "Message is required." }, { status: 400 });
    }
    if (message.length > 2000) {
      return Response.json({ error: "Message too long." }, { status: 400 });
    }

    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const [snapshot, system] = await Promise.all([
      buildRoleScopedSnapshot(session),
      Promise.resolve(buildAssistantSystemPrompt(session)),
    ]);

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    let reply: string;
    let provider: "gemini" | "groq" | "snapshot";
    let notice: string | undefined;

    if (geminiKey) {
      try {
        reply = await callGemini(
          geminiKey,
          system,
          snapshot,
          history,
          message,
        );
        provider = "gemini";
      } catch (geminiErr) {
        const detail =
          geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        reply = answerFromSnapshot(snapshot, message);
        provider = "snapshot";
        notice =
          detail.includes("429") || detail.toLowerCase().includes("quota")
            ? "Gemini quota unavailable — answering from live MainEvent snapshot instead. Check your free-tier key at https://aistudio.google.com/apikey"
            : `Gemini unavailable (${detail.slice(0, 120)}) — answering from live snapshot.`;
      }
    } else if (groqKey) {
      try {
        reply = await callGroq(
          groqKey,
          system,
          snapshot,
          history,
          message,
        );
        provider = "groq";
      } catch (groqErr) {
        const detail =
          groqErr instanceof Error ? groqErr.message : String(groqErr);
        reply = answerFromSnapshot(snapshot, message);
        provider = "snapshot";
        notice = `Groq unavailable (${detail.slice(0, 120)}) — answering from live snapshot.`;
      }
    } else {
      reply = answerFromSnapshot(snapshot, message);
      provider = "snapshot";
    }

    return Response.json({ reply, provider, notice });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
