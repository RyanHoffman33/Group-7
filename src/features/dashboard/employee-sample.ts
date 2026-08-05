/** Temporary sample data for Employee Dashboard until auth + Work module wiring. */

export type EmployeeTaskStatus =
  | "overdue"
  | "due_today"
  | "due_soon"
  | "scheduled"
  | "completed";

export type EmployeeAssignmentStatus =
  | "scheduled"
  | "checked_in"
  | "completed"
  | "blocked";

export const SAMPLE_EMPLOYEE = {
  /** Auth not wired — leave null so greeting stays generic. */
  firstName: null as string | null,
};

export const SAMPLE_NEXT_EVENT = {
  id: "evt-year-end-gala",
  eventName: "Year-End Gala",
  eventDate: "2026-08-12",
  startTime: "4:00 PM",
  endTime: "11:00 PM",
  venue: "Grand Ballroom — Harbor Convention Center",
  role: "Lead A/V Technician",
  customerName: "Northstar Financial Group",
  href: "/compliance",
};

export const SAMPLE_TASKS = [
  {
    id: "task-1",
    name: "Confirm LED wall load-in",
    eventName: "Year-End Gala",
    dueDate: "2026-08-06",
    status: "overdue" as EmployeeTaskStatus,
    priority: "High",
    instructions: "Verify dock access and power drops with venue ops.",
    href: "/compliance",
    canMarkComplete: false,
  },
  {
    id: "task-2",
    name: "Stage wireless mic kits",
    eventName: "Year-End Gala",
    dueDate: "2026-08-07",
    status: "due_soon" as EmployeeTaskStatus,
    priority: "High",
    instructions: "Label kits for keynote + breakout rooms.",
    href: "/compliance",
    canMarkComplete: false,
  },
  {
    id: "task-3",
    name: "Walk venue power plan",
    eventName: "Product Launch",
    dueDate: "2026-08-08",
    status: "due_soon" as EmployeeTaskStatus,
    priority: "Medium",
    instructions: "Photo breaker panels and note circuit limits.",
    href: "/compliance",
    canMarkComplete: false,
  },
  {
    id: "task-4",
    name: "Submit rehearsal notes",
    eventName: "Year-End Gala",
    dueDate: "2026-08-10",
    status: "scheduled" as EmployeeTaskStatus,
    priority: "Medium",
    instructions: "Capture timing changes after client rehearsal.",
    href: "/compliance",
    canMarkComplete: false,
  },
  {
    id: "task-5",
    name: "Inventory spare lamps",
    eventName: "Charity Ball",
    dueDate: "2026-08-01",
    status: "completed" as EmployeeTaskStatus,
    priority: "Low",
    instructions: "Logged in shop inventory sheet.",
    href: "/compliance",
    canMarkComplete: false,
  },
];

export const SAMPLE_ASSIGNMENTS = [
  {
    id: "asg-1",
    eventName: "Year-End Gala",
    customerName: "Northstar Financial Group",
    date: "2026-08-12",
    startTime: "4:00 PM",
    detail: "Lead A/V — load-in 2:30 PM",
    venue: "Grand Ballroom",
    role: "Lead A/V Technician",
    status: "scheduled" as EmployeeAssignmentStatus,
    href: "/compliance",
  },
  {
    id: "asg-2",
    eventName: "Product Launch",
    customerName: "Summit Tech Labs",
    date: "2026-08-21",
    startTime: "9:00 AM",
    detail: "Site walk — 9:00 AM",
    venue: "Innovation Hall",
    role: "Stage Technician",
    status: "scheduled" as EmployeeAssignmentStatus,
    href: "/compliance",
  },
  {
    id: "asg-3",
    eventName: "Charity Ball",
    customerName: "Riverfront Civic League",
    date: "2026-08-28",
    startTime: "5:30 PM",
    detail: "Audio support — call 3:00 PM",
    venue: "Riverfront Pavilion",
    role: "Audio Support",
    status: "scheduled" as EmployeeAssignmentStatus,
    href: "/compliance",
  },
  {
    id: "asg-4",
    eventName: "Executive Offsite",
    customerName: "Northstar Financial Group",
    date: "2026-09-05",
    startTime: "8:00 AM",
    detail: "Setup crew — 8:00 AM",
    venue: "Lakeside Retreat",
    role: "Setup Crew",
    status: "scheduled" as EmployeeAssignmentStatus,
    href: "/compliance",
  },
];

export const SAMPLE_HOURS = {
  weekLabel: "Week of Aug 3–9, 2026",
  totalHours: 28.5,
  targetHours: 40,
  byDay: [
    { label: "Mon", hours: 8.0 },
    { label: "Tue", hours: 7.5 },
    { label: "Wed", hours: 6.5 },
    { label: "Thu", hours: 6.5 },
    { label: "Fri", hours: 0 },
  ],
  enterTimeHref: "/compliance/costs",
};

/** Temporary sample feed — no notifications table in Supabase yet. */
export const SAMPLE_UPDATES = [
  {
    id: "upd-1",
    type: "New task assigned",
    eventName: "Year-End Gala",
    when: "2026-08-04",
  },
  {
    id: "upd-2",
    type: "Schedule change",
    eventName: "Year-End Gala",
    when: "2026-08-03",
  },
  {
    id: "upd-3",
    type: "Manager note",
    eventName: "Product Launch",
    when: "2026-08-03",
  },
];

export const SAMPLE_ISSUES = [
  {
    id: "iss-1",
    title: "Dock access delayed",
    eventName: "Year-End Gala",
    type: "Schedule conflict",
    status: "submitted",
    submittedAt: "2026-08-04",
    href: "/compliance",
  },
];

export const SAMPLE_EXPENSES = [
  {
    id: "exp-1",
    eventName: "Year-End Gala",
    category: "Materials",
    amount: 86.4,
    status: "pending_approval",
    description: "Gaffer tape & labels",
    href: "/compliance/costs",
  },
];

export const SAMPLE_DOCUMENTS = [
  {
    id: "doc-1",
    name: "Year-End Gala — Run of show",
    eventName: "Year-End Gala",
    kind: "Schedule",
    href: "/compliance",
  },
  {
    id: "doc-2",
    name: "Grand Ballroom power plan",
    eventName: "Year-End Gala",
    kind: "Venue",
    href: "/compliance",
  },
  {
    id: "doc-3",
    name: "A/V setup checklist",
    eventName: "Year-End Gala",
    kind: "Instructions",
    href: "/compliance",
  },
];
