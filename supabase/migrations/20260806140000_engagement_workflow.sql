-- Customer ↔ Company ↔ Vendor engagement workflow
-- New tables/columns only. Project: ACCY628-FINAL-PROJECT (eslwjydxevrdgeiqkwtq)
-- Status machine (engagement_inquiries.status):
--   pending_approval → quote_sent → quote_denied | awaiting_signature_deposit
--   → customer_accepted → vendor_sourcing → vendor_offer_sent → completed | terminated
--   quote_denied → quote_sent (amend) | terminated

-- ---------------------------------------------------------------------------
-- Vendor portal email linkage (demo auth → vendors row)
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS portal_email text;

UPDATE public.vendors
SET portal_email = 'vendor@gmail.com'
WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
)
  AND (portal_email IS NULL OR portal_email = '');

CREATE INDEX IF NOT EXISTS vendors_portal_email_idx
  ON public.vendors (lower(portal_email));

-- ---------------------------------------------------------------------------
-- 1) Engagement inquiries (customer intake)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.engagement_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id),
  customer_user_email text NOT NULL,
  organization text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL DEFAULT '',
  event_name text NOT NULL,
  event_type text NOT NULL,
  preferred_start date NOT NULL,
  preferred_end date,
  location text NOT NULL,
  guest_count integer,
  budget_range text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval',
  assigned_to text,
  approved_by text,
  approved_at timestamptz,
  contract_id uuid REFERENCES public.contracts(id),
  deposit_id uuid REFERENCES public.deposits(id),
  terminate_reason text,
  terminated_at timestamptz,
  terminated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagement_inquiries_status_check CHECK (
    status = ANY (ARRAY[
      'pending_approval'::text,
      'quote_sent'::text,
      'quote_denied'::text,
      'awaiting_signature_deposit'::text,
      'customer_accepted'::text,
      'vendor_sourcing'::text,
      'vendor_offer_sent'::text,
      'completed'::text,
      'terminated'::text
    ])
  )
);

CREATE INDEX IF NOT EXISTS engagement_inquiries_status_idx
  ON public.engagement_inquiries (status);
CREATE INDEX IF NOT EXISTS engagement_inquiries_customer_email_idx
  ON public.engagement_inquiries (lower(customer_user_email));
CREATE INDEX IF NOT EXISTS engagement_inquiries_customer_id_idx
  ON public.engagement_inquiries (customer_id);

-- ---------------------------------------------------------------------------
-- 2) Company quotes (versioned; required on inquiry approval)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.engagement_inquiries(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  valid_until date,
  status text NOT NULL DEFAULT 'draft',
  created_by text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_quotes_status_check CHECK (
    status = ANY (ARRAY[
      'draft'::text,
      'submitted'::text,
      'superseded'::text,
      'accepted'::text,
      'denied'::text
    ])
  ),
  CONSTRAINT company_quotes_version_check CHECK (version >= 1),
  CONSTRAINT company_quotes_inquiry_version_unique UNIQUE (inquiry_id, version)
);

CREATE INDEX IF NOT EXISTS company_quotes_inquiry_idx
  ON public.company_quotes (inquiry_id);

-- ---------------------------------------------------------------------------
-- 3) Demo-grade digital signatures
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.engagement_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.engagement_inquiries(id) ON DELETE CASCADE,
  related_quote_id uuid,
  signature_type text NOT NULL,
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagement_signatures_type_check CHECK (
    signature_type = ANY (ARRAY[
      'preliminary_contract'::text,
      'vendor_offer'::text
    ])
  )
);

CREATE INDEX IF NOT EXISTS engagement_signatures_inquiry_idx
  ON public.engagement_signatures (inquiry_id);

-- ---------------------------------------------------------------------------
-- 4) Vendor RFQs + vendor quotes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.engagement_inquiries(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  sent_by text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_rfqs_status_check CHECK (
    status = ANY (ARRAY[
      'sent'::text,
      'quoted'::text,
      'declined'::text,
      'closed'::text
    ])
  )
);

CREATE INDEX IF NOT EXISTS vendor_rfqs_inquiry_idx ON public.vendor_rfqs (inquiry_id);
CREATE INDEX IF NOT EXISTS vendor_rfqs_vendor_idx ON public.vendor_rfqs (vendor_id);
CREATE INDEX IF NOT EXISTS vendor_rfqs_status_idx ON public.vendor_rfqs (status);

CREATE TABLE IF NOT EXISTS public.vendor_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.vendor_rfqs(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_quotes_status_check CHECK (
    status = ANY (ARRAY[
      'submitted'::text,
      'selected'::text,
      'rejected'::text,
      'superseded'::text
    ])
  )
);

CREATE INDEX IF NOT EXISTS vendor_quotes_rfq_idx ON public.vendor_quotes (rfq_id);
CREATE INDEX IF NOT EXISTS vendor_quotes_vendor_idx ON public.vendor_quotes (vendor_id);

-- ---------------------------------------------------------------------------
-- 5) Marked-up vendor offers to customer (customer sees price only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_vendor_quote_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.engagement_inquiries(id) ON DELETE CASCADE,
  vendor_quote_id uuid NOT NULL REFERENCES public.vendor_quotes(id),
  version integer NOT NULL DEFAULT 1,
  vendor_cost numeric(14,2) NOT NULL CHECK (vendor_cost > 0),
  markup_percent numeric(8,2) NOT NULL DEFAULT 0,
  markup_amount numeric(14,2) NOT NULL DEFAULT 0,
  customer_price numeric(14,2) NOT NULL CHECK (customer_price > 0),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  sent_by text,
  sent_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_vendor_offers_status_check CHECK (
    status = ANY (ARRAY[
      'draft'::text,
      'sent'::text,
      'accepted'::text,
      'rejected'::text,
      'superseded'::text
    ])
  ),
  CONSTRAINT customer_vendor_offers_version_check CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS customer_vendor_offers_inquiry_idx
  ON public.customer_vendor_quote_offers (inquiry_id);
CREATE INDEX IF NOT EXISTS customer_vendor_offers_status_idx
  ON public.customer_vendor_quote_offers (status);

-- ---------------------------------------------------------------------------
-- 6) Simple in-app notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.engagement_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid REFERENCES public.engagement_inquiries(id) ON DELETE CASCADE,
  audience text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagement_notifications_audience_check CHECK (
    audience = ANY (ARRAY[
      'internal'::text,
      'customer'::text,
      'vendor'::text
    ])
  )
);

CREATE INDEX IF NOT EXISTS engagement_notifications_audience_idx
  ON public.engagement_notifications (audience, created_at DESC);
CREATE INDEX IF NOT EXISTS engagement_notifications_unread_idx
  ON public.engagement_notifications (audience)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS (demo-permissive, matches existing project pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE public.engagement_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_vendor_quote_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'engagement_inquiries_demo_all'
  ) THEN
    CREATE POLICY engagement_inquiries_demo_all ON public.engagement_inquiries
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'company_quotes_demo_all'
  ) THEN
    CREATE POLICY company_quotes_demo_all ON public.company_quotes
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'engagement_signatures_demo_all'
  ) THEN
    CREATE POLICY engagement_signatures_demo_all ON public.engagement_signatures
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'vendor_rfqs_demo_all'
  ) THEN
    CREATE POLICY vendor_rfqs_demo_all ON public.vendor_rfqs
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'vendor_quotes_demo_all'
  ) THEN
    CREATE POLICY vendor_quotes_demo_all ON public.vendor_quotes
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'customer_vendor_offers_demo_all'
  ) THEN
    CREATE POLICY customer_vendor_offers_demo_all ON public.customer_vendor_quote_offers
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'engagement_notifications_demo_all'
  ) THEN
    CREATE POLICY engagement_notifications_demo_all ON public.engagement_notifications
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Seed demo workflow states for customer@ / manager@ / vendor@
-- ---------------------------------------------------------------------------
INSERT INTO public.engagement_inquiries (
  id, customer_id, customer_user_email, organization, contact_name, contact_email,
  contact_phone, event_name, event_type, preferred_start, preferred_end, location,
  guest_count, budget_range, description, status, created_at, updated_at
) VALUES
(
  'e1111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111108',
  'customer@gmail.com',
  'Delta Consulting',
  'Casey Customer',
  'customer@gmail.com',
  '555-0108',
  'Delta Spring Leadership Summit',
  'corporate_conference',
  '2026-09-18',
  '2026-09-19',
  'Chicago, IL — downtown hotel ballroom',
  180,
  '$75,000 – $150,000',
  'Two-day leadership summit with AV, catering, and breakout rooms. Awaiting exec/PM approval and company quote.',
  'pending_approval',
  now() - interval '2 days',
  now() - interval '2 days'
),
(
  'e1111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111108',
  'customer@gmail.com',
  'Delta Consulting',
  'Casey Customer',
  'customer@gmail.com',
  '555-0108',
  'Delta Client Appreciation Gala',
  'gala',
  '2026-10-24',
  '2026-10-24',
  'Chicago, IL — lakefront venue',
  220,
  '$75,000 – $150,000',
  'Evening gala with plated dinner and entertainment. Company quote ready for customer accept/deny.',
  'quote_sent',
  now() - interval '5 days',
  now() - interval '1 day'
),
(
  'e1111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111108',
  'customer@gmail.com',
  'Delta Consulting',
  'Casey Customer',
  'customer@gmail.com',
  '555-0108',
  'Delta Product Launch Night',
  'product_launch',
  '2026-11-12',
  '2026-11-12',
  'Chicago, IL — riverfront loft',
  140,
  '$25,000 – $75,000',
  'Accepted preliminary quote; deposit recorded. Ready for vendor sourcing and marked-up vendor offers.',
  'vendor_sourcing',
  now() - interval '14 days',
  now() - interval '3 days'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.company_quotes (
  id, inquiry_id, version, amount, line_items, notes, valid_until, status, created_by, submitted_at
) VALUES
(
  'e2222222-2222-2222-2222-222222222201',
  'e1111111-1111-1111-1111-111111111102',
  1,
  96000.00,
  '[
    {"description":"Venue coordination & staffing","amount":32000},
    {"description":"Catering & beverage package","amount":38000},
    {"description":"AV / lighting / entertainment","amount":26000}
  ]'::jsonb,
  'Preliminary company quote for the Client Appreciation Gala. Deposit due on acceptance: 25%.',
  '2026-09-30',
  'submitted',
  'manager@gmail.com',
  now() - interval '1 day'
),
(
  'e2222222-2222-2222-2222-222222222202',
  'e1111111-1111-1111-1111-111111111103',
  1,
  52000.00,
  '[
    {"description":"Event production package","amount":52000}
  ]'::jsonb,
  'Accepted preliminary estimate for Product Launch Night.',
  '2026-10-15',
  'accepted',
  'manager@gmail.com',
  now() - interval '10 days'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.engagement_inquiries
SET
  approved_by = 'manager@gmail.com',
  approved_at = now() - interval '1 day',
  updated_at = now() - interval '1 day'
WHERE id = 'e1111111-1111-1111-1111-111111111102'
  AND approved_at IS NULL;

UPDATE public.engagement_inquiries
SET
  approved_by = 'executive@gmail.com',
  approved_at = now() - interval '12 days',
  updated_at = now() - interval '3 days'
WHERE id = 'e1111111-1111-1111-1111-111111111103'
  AND approved_at IS NULL;

-- Create preliminary contract + deposit for the accepted launch inquiry
INSERT INTO public.contracts (
  id, customer_id, contract_number, event_name, event_type, event_start, event_end,
  venue_name, venue_city, guest_count, project_manager_label, billing_method,
  contract_value, original_contract_value, change_order_value_total,
  deposit_required, deposit_percent, minimum_deposit_amount, requires_deposit_before_work,
  discount_amount, discount_percent, cancellation_policy_text, cancellation_fee_percent,
  status, performance_complete, involvement_model, notes, approved_at, approved_by,
  activated_at, currency, version, updated_at
)
SELECT
  'e3333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111108',
  'ME-ENG-9001',
  'Delta Product Launch Night',
  'product_launch',
  '2026-11-12T18:00:00+00',
  '2026-11-12T23:00:00+00',
  'Riverfront Loft',
  'Chicago',
  140,
  'Morgan Manager',
  'fixed_price',
  52000,
  52000,
  0,
  true,
  25,
  13000,
  true,
  0,
  0,
  'Cancellation within 30 days incurs 50% of contract value.',
  50,
  'active',
  false,
  'collaborative',
  'Created from engagement inquiry acceptance (demo seed).',
  now() - interval '10 days',
  'executive@gmail.com',
  now() - interval '9 days',
  'USD',
  1,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.contracts WHERE id = 'e3333333-3333-3333-3333-333333333301'
);

INSERT INTO public.deposits (
  id, contract_id, customer_id, amount, received_at, status
)
SELECT
  'e4444444-4444-4444-4444-444444444401',
  'e3333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111108',
  13000,
  (now() - interval '9 days')::date,
  'unearned'
WHERE NOT EXISTS (
  SELECT 1 FROM public.deposits WHERE id = 'e4444444-4444-4444-4444-444444444401'
);

UPDATE public.engagement_inquiries
SET
  contract_id = 'e3333333-3333-3333-3333-333333333301',
  deposit_id = 'e4444444-4444-4444-4444-444444444401'
WHERE id = 'e1111111-1111-1111-1111-111111111103';

INSERT INTO public.engagement_signatures (
  id, inquiry_id, related_quote_id, signature_type, signer_name, signer_email,
  signed_at, ip_address, user_agent
)
SELECT
  'e5555555-5555-5555-5555-555555555501',
  'e1111111-1111-1111-1111-111111111103',
  'e2222222-2222-2222-2222-222222222202',
  'preliminary_contract',
  'Casey Customer',
  'customer@gmail.com',
  now() - interval '10 days',
  '127.0.0.1',
  'MainEvent-Demo/1.0'
WHERE NOT EXISTS (
  SELECT 1 FROM public.engagement_signatures WHERE id = 'e5555555-5555-5555-5555-555555555501'
);

INSERT INTO public.vendor_rfqs (
  id, inquiry_id, vendor_id, title, message, status, sent_by, sent_at
) VALUES
(
  'e6666666-6666-6666-6666-666666666601',
  'e1111111-1111-1111-1111-111111111103',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'Catering RFQ — Delta Product Launch',
  'Please quote plated dinner + beverage for 140 guests at the riverfront loft on 2026-11-12.',
  'quoted',
  'manager@gmail.com',
  now() - interval '4 days'
),
(
  'e6666666-6666-6666-6666-666666666602',
  'e1111111-1111-1111-1111-111111111103',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'AV RFQ — Delta Product Launch',
  'Need stage AV, screens, and lighting for a 90-minute product reveal.',
  'sent',
  'manager@gmail.com',
  now() - interval '2 days'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vendor_quotes (
  id, rfq_id, vendor_id, amount, line_items, notes, status, submitted_at
) VALUES
(
  'e7777777-7777-7777-7777-777777777701',
  'e6666666-6666-6666-6666-666666666601',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  18500.00,
  '[
    {"description":"Plated dinner (140 covers)","amount":14000},
    {"description":"Beverage package","amount":4500}
  ]'::jsonb,
  'Includes service staff through dessert. Dietary accommodations included.',
  'submitted',
  now() - interval '3 days'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customer_vendor_quote_offers (
  id, inquiry_id, vendor_quote_id, version, vendor_cost, markup_percent, markup_amount,
  customer_price, notes, status, sent_by, sent_at
) VALUES
(
  'e8888888-8888-8888-8888-888888888801',
  'e1111111-1111-1111-1111-111111111103',
  'e7777777-7777-7777-7777-777777777701',
  1,
  18500.00,
  20,
  3700.00,
  22200.00,
  'Catering package for Product Launch Night (customer-facing price).',
  'sent',
  'manager@gmail.com',
  now() - interval '1 day'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.engagement_inquiries
SET status = 'vendor_offer_sent', updated_at = now() - interval '1 day'
WHERE id = 'e1111111-1111-1111-1111-111111111103'
  AND status = 'vendor_sourcing';

INSERT INTO public.engagement_notifications (inquiry_id, audience, title, body, href)
SELECT
  'e1111111-1111-1111-1111-111111111101',
  'internal',
  'New customer inquiry awaiting approval',
  'Delta Spring Leadership Summit needs exec/PM approval and a company quote.',
  '/engagement/approvals'
WHERE NOT EXISTS (
  SELECT 1 FROM public.engagement_notifications
  WHERE inquiry_id = 'e1111111-1111-1111-1111-111111111101'
    AND title = 'New customer inquiry awaiting approval'
);

INSERT INTO public.engagement_notifications (inquiry_id, audience, title, body, href)
SELECT
  'e1111111-1111-1111-1111-111111111102',
  'customer',
  'Company quote ready for review',
  'Your quote for Delta Client Appreciation Gala is ready. Sign and pay the deposit to accept.',
  '/dashboard/customer/engagement'
WHERE NOT EXISTS (
  SELECT 1 FROM public.engagement_notifications
  WHERE inquiry_id = 'e1111111-1111-1111-1111-111111111102'
    AND title = 'Company quote ready for review'
);

INSERT INTO public.engagement_notifications (inquiry_id, audience, title, body, href)
SELECT
  'e1111111-1111-1111-1111-111111111103',
  'vendor',
  'New RFQ: AV for Delta Product Launch',
  'MainEvent requested an AV quote for Delta Product Launch Night.',
  '/vendor/rfqs'
WHERE NOT EXISTS (
  SELECT 1 FROM public.engagement_notifications
  WHERE inquiry_id = 'e1111111-1111-1111-1111-111111111103'
    AND title = 'New RFQ: AV for Delta Product Launch'
);

INSERT INTO public.engagement_notifications (inquiry_id, audience, title, body, href)
SELECT
  'e1111111-1111-1111-1111-111111111103',
  'customer',
  'Vendor package ready for review',
  'A marked-up catering package is ready for your sign-off.',
  '/dashboard/customer/engagement'
WHERE NOT EXISTS (
  SELECT 1 FROM public.engagement_notifications
  WHERE inquiry_id = 'e1111111-1111-1111-1111-111111111103'
    AND title = 'Vendor package ready for review'
);

INSERT INTO public.engagement_notifications (inquiry_id, audience, title, body, href)
SELECT
  'e1111111-1111-1111-1111-111111111103',
  'internal',
  'Customer accepted — start vendor sourcing',
  'Delta Product Launch Night is ready for vendor RFQs and markup.',
  '/engagement/sourcing'
WHERE NOT EXISTS (
  SELECT 1 FROM public.engagement_notifications
  WHERE inquiry_id = 'e1111111-1111-1111-1111-111111111103'
    AND title = 'Customer accepted — start vendor sourcing'
);
