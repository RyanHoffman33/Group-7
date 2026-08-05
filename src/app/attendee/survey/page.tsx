import Link from "next/link";
import { PageHeader, Panel } from "@/components/billing/ui";
import { AlertCard } from "@/components/dashboard";

export default function AttendeeSurveyPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Event survey"
        description="Thank you for attending. Feedback helps improve future programs."
      />
      <AlertCard
        tone="info"
        title="Demo survey"
        body="Responses are not persisted to Supabase yet — this screen is a draft form for the class demo."
      />
      <Panel>
        <form className="space-y-4" action="/attendee">
          <label className="block text-sm">
            <span className="font-medium">Overall experience</span>
            <select
              name="rating"
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2"
            >
              <option>Excellent</option>
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Comments</span>
            <textarea
              name="comments"
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2"
              rows={4}
              placeholder="What worked well?"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white"
          >
            Submit feedback (returns to portal)
          </button>
        </form>
        <p className="mt-4 text-sm">
          <Link href="/attendee" className="text-[var(--accent)] hover:underline">
            ← Back to my event
          </Link>
        </p>
      </Panel>
    </div>
  );
}
