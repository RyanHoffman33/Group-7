/**
 * Contract scan agent — extracts performance obligations, manpower, and supplies.
 * Uses Gemini/Groq when keys exist; otherwise a structured heuristic fallback
 * so demos still work. Output is shaped for Cost / Billing handoff views.
 */

export type ExtractedResource = {
  resource_type: "manpower" | "supply" | "equipment";
  label: string;
  role_or_sku?: string;
  quantity: number;
  unit?: string;
  estimated_unit_cost?: number;
  notes?: string;
};

export type ExtractedObligation = {
  code: string;
  title: string;
  description: string;
  phase: "planning" | "execution" | "wrapup";
  acceptance_criteria?: string;
  estimated_labor_hours?: number;
  estimated_supply_cost?: number;
  resources: ExtractedResource[];
};

export type ContractScanResult = {
  engine: "gemini" | "groq" | "heuristic";
  summary: string;
  obligations: ExtractedObligation[];
  raw?: unknown;
};

const SYSTEM_PROMPT = `You are MainEvent's contract analysis agent for an event-production company.
Read the engagement contract text and extract ASC 606-style performance obligations.

Return ONLY valid JSON with this shape:
{
  "summary": "1-2 sentence overview",
  "obligations": [
    {
      "code": "PO-1",
      "title": "short title",
      "description": "what MainEvent must deliver",
      "phase": "planning" | "execution" | "wrapup",
      "acceptance_criteria": "how completion is proven",
      "estimated_labor_hours": number,
      "estimated_supply_cost": number,
      "resources": [
        {
          "resource_type": "manpower" | "supply" | "equipment",
          "label": "Crew lead / LED wall / etc",
          "role_or_sku": "optional role or SKU",
          "quantity": number,
          "unit": "people|hours|units|days",
          "estimated_unit_cost": number,
          "notes": "optional"
        }
      ]
    }
  ]
}

Rules:
- Every promised deliverable/service is its own obligation.
- Include manpower AND supplies/equipment needed to fulfill each obligation.
- phase: prep/planning work = planning; show-day = execution; strike/reporting = wrapup.
- Be concrete for event production (AV, staging, staffing, florals, registration, etc.).
- Do not invent client billing invoices — only work obligations and resources.`;

function parseJsonPayload(text: string): ContractScanResult {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as {
    summary?: string;
    obligations?: ExtractedObligation[];
  };
  const obligations = (parsed.obligations ?? []).map((o, i) => ({
    code: o.code || `PO-${i + 1}`,
    title: o.title || `Obligation ${i + 1}`,
    description: o.description || "",
    phase: (["planning", "execution", "wrapup"].includes(o.phase)
      ? o.phase
      : "planning") as ExtractedObligation["phase"],
    acceptance_criteria: o.acceptance_criteria,
    estimated_labor_hours: Number(o.estimated_labor_hours ?? 0),
    estimated_supply_cost: Number(o.estimated_supply_cost ?? 0),
    resources: (o.resources ?? []).map((r) => ({
      resource_type: (["manpower", "supply", "equipment"].includes(
        r.resource_type,
      )
        ? r.resource_type
        : "supply") as ExtractedResource["resource_type"],
      label: r.label || "Resource",
      role_or_sku: r.role_or_sku,
      quantity: Number(r.quantity ?? 1) || 1,
      unit: r.unit,
      estimated_unit_cost: Number(r.estimated_unit_cost ?? 0),
      notes: r.notes,
    })),
  }));
  return {
    engine: "heuristic",
    summary: parsed.summary || "Extracted performance obligations from contract.",
    obligations,
    raw: parsed,
  };
}

async function callGemini(contractText: string): Promise<ContractScanResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze this engagement contract and return JSON only:\n\n${contractText.slice(0, 24000)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned empty scan.");
  const result = parseJsonPayload(text);
  return { ...result, engine: "gemini" };
}

async function callGroq(contractText: string): Promise<ContractScanResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY missing");
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze this engagement contract and return JSON only:\n\n${contractText.slice(0, 20000)}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned empty scan.");
  const result = parseJsonPayload(text);
  return { ...result, engine: "groq" };
}

/** Local fallback when no LLM key — still produces structured handoff data. */
export function heuristicScan(contractText: string): ContractScanResult {
  const text = contractText.replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets = lines.filter((l) =>
    /^(\d+[\).\]]|-|\*|•|PO[- ]?\d+|Obligation)/i.test(l),
  );

  const obligations: ExtractedObligation[] = [];

  const pushFromTitle = (
    title: string,
    description: string,
    phase: ExtractedObligation["phase"],
    resources: ExtractedResource[],
  ) => {
    obligations.push({
      code: `PO-${obligations.length + 1}`,
      title: title.slice(0, 120),
      description: description.slice(0, 500),
      phase,
      acceptance_criteria: "Client or manager sign-off / completion evidence on file",
      estimated_labor_hours: resources
        .filter((r) => r.resource_type === "manpower")
        .reduce((s, r) => s + r.quantity * 4, 0),
      estimated_supply_cost: resources
        .filter((r) => r.resource_type !== "manpower")
        .reduce((s, r) => s + r.quantity * (r.estimated_unit_cost ?? 0), 0),
      resources,
    });
  };

  for (const b of bullets.slice(0, 8)) {
    const cleaned = b.replace(/^(\d+[\).\]]|-|\*|•|PO[- ]?\d+|Obligation)\s*/i, "");
    const lower = cleaned.toLowerCase();
    let phase: ExtractedObligation["phase"] = "execution";
    if (/plan|walkthrough|design|brief|confirm|prep/.test(lower)) phase = "planning";
    if (/strike|wrap|report|reconcile|invoice pack|photo deliver/.test(lower))
      phase = "wrapup";

    const resources: ExtractedResource[] = [
      {
        resource_type: "manpower",
        label: /av|audio|lighting|stage/.test(lower)
          ? "AV technician"
          : /floral|centerpiece/.test(lower)
            ? "Floral installer"
            : /door|registration|badge/.test(lower)
              ? "Registration attendant"
              : "Event crew",
        role_or_sku: "crew",
        quantity: /load|stage|show|ball/.test(lower) ? 4 : 2,
        unit: "people",
        estimated_unit_cost: 45,
      },
    ];

    if (/av|led|mic|audio|screen/.test(lower)) {
      resources.push({
        resource_type: "equipment",
        label: "LED wall / audio package",
        role_or_sku: "AV-PKG",
        quantity: 1,
        unit: "package",
        estimated_unit_cost: 2500,
      });
    }
    if (/floral|centerpiece/.test(lower)) {
      resources.push({
        resource_type: "supply",
        label: "Centerpiece kit",
        role_or_sku: "FLR-CTR",
        quantity: 24,
        unit: "units",
        estimated_unit_cost: 85,
      });
    }
    if (/cater|dinner|plated/.test(lower)) {
      resources.push({
        resource_type: "manpower",
        label: "Catering coordinator",
        role_or_sku: "vendor-liaison",
        quantity: 1,
        unit: "people",
        estimated_unit_cost: 55,
      });
    }

    pushFromTitle(
      cleaned.slice(0, 80) || "Contracted service",
      cleaned,
      phase,
      resources,
    );
  }

  if (obligations.length === 0) {
    // Always return a usable starter set so the UI never looks empty after scan
    pushFromTitle(
      "Site prep & planning confirmations",
      "Confirm venue layout, power, and rider requirements prior to event day.",
      "planning",
      [
        {
          resource_type: "manpower",
          label: "Production manager",
          role_or_sku: "manager",
          quantity: 1,
          unit: "people",
          estimated_unit_cost: 75,
        },
        {
          resource_type: "supply",
          label: "Printed floor plans / cue sheets",
          quantity: 10,
          unit: "units",
          estimated_unit_cost: 3,
        },
      ],
    );
    pushFromTitle(
      "Live event execution",
      text.slice(0, 280) ||
        "Deliver contracted on-site services during the event window.",
      "execution",
      [
        {
          resource_type: "manpower",
          label: "Show crew",
          role_or_sku: "crew",
          quantity: 6,
          unit: "people",
          estimated_unit_cost: 45,
        },
        {
          resource_type: "equipment",
          label: "Staging / AV package",
          quantity: 1,
          unit: "package",
          estimated_unit_cost: 3500,
        },
      ],
    );
    pushFromTitle(
      "Strike & wrap-up reconciliation",
      "Strike, inventory return, and evidence pack for performance completion.",
      "wrapup",
      [
        {
          resource_type: "manpower",
          label: "Strike crew",
          role_or_sku: "crew",
          quantity: 4,
          unit: "people",
          estimated_unit_cost: 40,
        },
      ],
    );
  }

  return {
    engine: "heuristic",
    summary:
      "Heuristic scan (add GEMINI_API_KEY or GROQ_API_KEY for full LLM extraction). Obligations and resources are structured for Cost/Billing handoff views.",
    obligations,
  };
}

export async function scanContractText(
  contractText: string,
): Promise<ContractScanResult> {
  if (!contractText.trim()) {
    throw new Error("Contract text is empty — paste or attach text to scan.");
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGemini(contractText);
    } catch (e) {
      console.warn("Gemini scan failed, trying Groq/heuristic", e);
    }
  }
  if (process.env.GROQ_API_KEY) {
    try {
      return await callGroq(contractText);
    } catch (e) {
      console.warn("Groq scan failed, using heuristic", e);
    }
  }
  return heuristicScan(contractText);
}

/** Sample engagement contract text for demos / seed. */
export function sampleContractText(eventName: string, customerName: string) {
  return `ENGAGEMENT AGREEMENT — ${eventName}
Client: ${customerName}
Provider: MainEvent Productions

1. Site walkthrough & floor plan confirmation prior to event day.
2. AV package: LED walls, wireless microphones, and show-call operation.
3. Load-in and stage build on event day before doors.
4. Live run-of-show execution including stage management.
5. Strike, inventory return, and photo/evidence delivery within 48 hours.

MainEvent shall furnish manpower, supplies, and equipment reasonably required
to satisfy each performance obligation above. Change orders require written approval
before additional work is billable.
`;
}
