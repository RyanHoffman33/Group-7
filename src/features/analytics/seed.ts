/** Demo monthly series used when live Supabase views are slow/unavailable. */

export type AnalyticsMonth = {
  month: string; // YYYY-MM-01
  revenue: number;
  cogs: number;
  margin: number;
  events: number;
  arOutstanding: number;
};

export const ANALYTICS_SEED_MONTHS: AnalyticsMonth[] = [
  { month: "2025-03-01", revenue: 182000, cogs: 118000, margin: 64000, events: 4, arOutstanding: 92000 },
  { month: "2025-04-01", revenue: 195000, cogs: 124000, margin: 71000, events: 5, arOutstanding: 88000 },
  { month: "2025-05-01", revenue: 210000, cogs: 132000, margin: 78000, events: 5, arOutstanding: 101000 },
  { month: "2025-06-01", revenue: 248000, cogs: 151000, margin: 97000, events: 6, arOutstanding: 115000 },
  { month: "2025-07-01", revenue: 226000, cogs: 140000, margin: 86000, events: 5, arOutstanding: 98000 },
  { month: "2025-08-01", revenue: 261000, cogs: 158000, margin: 103000, events: 7, arOutstanding: 124000 },
  { month: "2025-09-01", revenue: 274000, cogs: 165000, margin: 109000, events: 6, arOutstanding: 131000 },
  { month: "2025-10-01", revenue: 255000, cogs: 156000, margin: 99000, events: 6, arOutstanding: 118000 },
  { month: "2025-11-01", revenue: 289000, cogs: 172000, margin: 117000, events: 8, arOutstanding: 142000 },
  { month: "2025-12-01", revenue: 312000, cogs: 188000, margin: 124000, events: 7, arOutstanding: 156000 },
  { month: "2026-01-01", revenue: 238000, cogs: 149000, margin: 89000, events: 4, arOutstanding: 121000 },
  { month: "2026-02-01", revenue: 251000, cogs: 154000, margin: 97000, events: 5, arOutstanding: 128000 },
  { month: "2026-03-01", revenue: 268000, cogs: 161000, margin: 107000, events: 6, arOutstanding: 134000 },
  { month: "2026-04-01", revenue: 279000, cogs: 166000, margin: 113000, events: 6, arOutstanding: 139000 },
  { month: "2026-05-01", revenue: 291000, cogs: 171000, margin: 120000, events: 7, arOutstanding: 145000 },
  { month: "2026-06-01", revenue: 305000, cogs: 178000, margin: 127000, events: 7, arOutstanding: 151000 },
  { month: "2026-07-01", revenue: 298000, cogs: 175000, margin: 123000, events: 6, arOutstanding: 148000 },
  { month: "2026-08-01", revenue: 286000, cogs: 169000, margin: 117000, events: 7, arOutstanding: 152000 },
];
