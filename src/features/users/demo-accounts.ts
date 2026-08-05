/** Client-safe demo constants (no server imports). */
export const DEMO_PASSWORD = "demo";

export const DEMO_ACCOUNTS = [
  { email: "executive@gmail.com", role: "Executive" },
  { email: "manager@gmail.com", role: "Project Manager" },
  { email: "employee@gmail.com", role: "Event Coordinator" },
  { email: "accounting@gmail.com", role: "Accounting" },
  { email: "vendor@gmail.com", role: "Vendor" },
  { email: "customer@gmail.com", role: "Customer" },
  { email: "deptmanager@gmail.com", role: "Department Manager" },
  { email: "attendee@gmail.com", role: "Attendee" },
  { email: "admin@gmail.com", role: "System Admin" },
] as const;
