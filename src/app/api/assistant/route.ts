import { ASSISTANT_SYSTEM, buildCompanySnapshot } from "@/features/assistant/snapshot";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

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
            text: `${system}\n\nLIVE COMPANY SNAPSHOT:\n${snapshot}`,
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
          content: `${system}\n\nLIVE COMPANY SNAPSHOT:\n${snapshot}`,
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

  if (q.includes("deposit") || q.includes("unearned")) {
    return `From the live snapshot, unearned deposits (contract liability) are **${line("- Unearned deposits (liability)") ?? line("- Unearned deposits") ?? "see /compliance/deposits-retainers"}**. Deposits stay liabilities until applied/earned — cash alone is not revenue.`;
  }
  if (q.includes("aging") || q.includes("90") || q.includes("collect")) {
    return `Portfolio A/R outstanding is **${line("- Total outstanding A/R")}**, with expected collections **${line("- Expected collections (A/R × P(collect))")}**. Aging mix is on the Aging page; 90+ is listed in the snapshot aging mix line.`;
  }
  if (q.includes("asset") || q.includes("earned not") || q.includes("not billed")) {
    return `Contract assets (earned not billed) total **${line("- Contract assets (earned not billed)")}**. That is performance earned ahead of billing under ASC 606 — see Contract position.`;
  }
  if (q.includes("liability") || q.includes("deferred")) {
    return `Contract liabilities are **${line("- Contract liabilities (unearned deposits + deferred billed)")}**. Deferred open A/R is **${line("- Deferred open A/R (billed, not yet recognized)")}**.`;
  }
  if (q.includes("recogn") || q.includes("606") || q.includes("revenue")) {
    return `Recognized billed revenue in the position view is **${line("- Recognized revenue (billed & recognized)")}**. Recognition requires performance (and evidence on Compliance). See /compliance/recognition and Policies.`;
  }
  if (q.includes("alert")) {
    return `There are **${line("- Open billing alerts")}** unacknowledged aging alerts right now.`;
  }

  return [
    "I can answer from MainEvent’s live Billing & Compliance snapshot even without an AI key.",
    "",
    `- Outstanding A/R: ${line("- Total outstanding A/R")}`,
    `- Unearned deposits: ${line("- Unearned deposits (liability)")}`,
    `- Contract assets: ${line("- Contract assets (earned not billed)")}`,
    `- Contract liabilities: ${line("- Contract liabilities (unearned deposits + deferred billed)")}`,
    "",
    "Add a free GEMINI_API_KEY (or GROQ_API_KEY) to .env.local for full natural-language answers. Try asking about deposits, aging, contract assets, or recognition.",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
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
    const snapshot = await buildCompanySnapshot();

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    let reply: string;
    let provider: "gemini" | "groq" | "snapshot";
    let notice: string | undefined;

    if (geminiKey) {
      try {
        reply = await callGemini(
          geminiKey,
          ASSISTANT_SYSTEM,
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
          ASSISTANT_SYSTEM,
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
