-- Customer Contracts & Engagements foundation (Gabriel / Gabriel-Housey)
-- ACCY628 MainEvent — extends Billing stub contracts; does not recreate Billing cash tables.
-- Applied remotely as: contracts_engagements_foundation
--
-- Accounting notes (schema-level):
-- - deposits remain Billing-owned with unearned/applied/refunded; no revenue on insert.
-- - contract approval timestamps do not write invoices or recognition.
-- - milestones support billable schedule; billed_invoice_id prevents double bill of same key.
-- - original_contract_value preserved; change orders track prior_contract_value + line items.
-- - performance obligations for recognition remain in work_performance_obligations / recognition_evidence.

-- ---------------------------------------------------------------------------
-- 1) Extend public.contracts (engagement = one event; no separate events table)
-- ---------------------------------------------------------------------------

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS project_manager_label text,
  ADD COLUMN IF NOT EXISTS project_manager_party_id uuid REFERENCES public.work_parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS event_start timestamptz,
  ADD COLUMN IF NOT EXISTS event_end timestamptz,
  ADD COLUMN IF NOT EXISTS venue_name text,
  ADD COLUMN IF NOT EXISTS venue_city text,
  ADD COLUMN IF NOT EXISTS guest_count integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_requires_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS discount_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_contract_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS change_order_value_total numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_deposit_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS requires_deposit_before_work boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancellation_policy_text text,
  ADD COLUMN IF NOT EXISTS cancellation_fee_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS canceled_by text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS internal_memo text,
  ADD COLUMN IF NOT EXISTS closeout_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill commercial identity + value history without touching Billing amounts
UPDATE public.contracts c
SET
  contract_number = COALESCE(
    c.contract_number,
    'ME-' || to_char(c.created_at, 'YYYY') || '-' || upper(right(replace(c.id::text, '-', ''), 12))
  ),
  project_manager_label = COALESCE(NULLIF(btrim(c.project_manager_label), ''), 'MainEvent Project Manager'),
  original_contract_value = COALESCE(c.original_contract_value, c.contract_value),
  change_order_value_total = COALESCE(c.change_order_value_total, 0),
  event_type = COALESCE(c.event_type, 'corporate_event'),
  requires_deposit_before_work = COALESCE(c.requires_deposit_before_work, c.deposit_required),
  currency = COALESCE(c.currency, 'USD'),
  updated_at = now()
WHERE true;

ALTER TABLE public.contracts
  ALTER COLUMN contract_number SET NOT NULL,
  ALTER COLUMN project_manager_label SET NOT NULL,
  ALTER COLUMN original_contract_value SET NOT NULL;

ALTER TABLE public.contracts
  ALTER COLUMN status SET DEFAULT 'draft';

-- Status domain (seed already uses approved among these values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_status_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_status_check CHECK (
        status = ANY (ARRAY[
          'draft'::text,
          'pending_approval'::text,
          'approved'::text,
          'deposit_pending'::text,
          'active'::text,
          'completed'::text,
          'canceled'::text,
          'closed'::text
        ])
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_discount_amount_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_discount_amount_check CHECK (discount_amount >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_discount_percent_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_discount_percent_check
      CHECK (discount_percent >= 0 AND discount_percent <= 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_cancellation_fee_percent_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_cancellation_fee_percent_check
      CHECK (cancellation_fee_percent >= 0 AND cancellation_fee_percent <= 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_change_order_value_total_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_change_order_value_total_check
      CHECK (change_order_value_total >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_original_value_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_original_value_check
      CHECK (original_contract_value >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_guest_count_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_guest_count_check
      CHECK (guest_count IS NULL OR guest_count >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_minimum_deposit_amount_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_minimum_deposit_amount_check
      CHECK (minimum_deposit_amount IS NULL OR minimum_deposit_amount >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_event_dates_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_event_dates_check
      CHECK (event_end IS NULL OR event_start IS NULL OR event_end >= event_start);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_cancel_docs_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_cancel_docs_check
      CHECK (
        status <> 'canceled'
        OR (cancel_reason IS NOT NULL AND btrim(cancel_reason) <> '' AND canceled_at IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_currency_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_currency_check CHECK (char_length(currency) = 3);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS contracts_contract_number_uidx
  ON public.contracts (contract_number);

CREATE INDEX IF NOT EXISTS contracts_status_idx
  ON public.contracts (status);

CREATE INDEX IF NOT EXISTS contracts_customer_id_idx
  ON public.contracts (customer_id);

CREATE INDEX IF NOT EXISTS contracts_event_start_idx
  ON public.contracts (event_start);

CREATE INDEX IF NOT EXISTS contracts_pm_party_idx
  ON public.contracts (project_manager_party_id);

-- One open engagement per customer + event name + event date (allows re-book after cancel/close)
CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_open_event_uidx
  ON public.contracts (
    customer_id,
    lower(btrim(event_name)),
    COALESCE((event_start AT TIME ZONE 'UTC')::date, DATE 'epoch')
  )
  WHERE status = ANY (ARRAY[
    'draft'::text,
    'pending_approval'::text,
    'approved'::text,
    'deposit_pending'::text,
    'active'::text
  ]);

-- ---------------------------------------------------------------------------
-- 2) Extend contract_milestones (payment schedule; Billing already consumes)
-- ---------------------------------------------------------------------------

ALTER TABLE public.contract_milestones
  ADD COLUMN IF NOT EXISTS sequence_no integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS milestone_type text NOT NULL DEFAULT 'progress',
  ADD COLUMN IF NOT EXISTS percent_of_contract numeric(5,2),
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_approval_to_bill boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_milestones_type_check'
  ) THEN
    ALTER TABLE public.contract_milestones
      ADD CONSTRAINT contract_milestones_type_check CHECK (
        milestone_type = ANY (ARRAY[
          'deposit'::text,
          'progress'::text,
          'final'::text,
          'retainer'::text,
          'other'::text
        ])
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_milestones_percent_check'
  ) THEN
    ALTER TABLE public.contract_milestones
      ADD CONSTRAINT contract_milestones_percent_check
      CHECK (percent_of_contract IS NULL OR (percent_of_contract >= 0 AND percent_of_contract <= 100));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contract_milestones_contract_seq_idx
  ON public.contract_milestones (contract_id, sequence_no);

-- ---------------------------------------------------------------------------
-- 3) Extend contract_modifications (change orders; keep GAAP hooks)
-- ---------------------------------------------------------------------------

ALTER TABLE public.contract_modifications
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_by text,
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS new_contract_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_modifications_new_value_check'
  ) THEN
    ALTER TABLE public.contract_modifications
      ADD CONSTRAINT contract_modifications_new_value_check
      CHECK (new_contract_value IS NULL OR new_contract_value >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Extend contract_deliverables (services / promised deliverables)
-- ---------------------------------------------------------------------------

ALTER TABLE public.contract_deliverables
  ADD COLUMN IF NOT EXISTS is_performance_obligation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commercial_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS service_code text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_deliverables_commercial_amount_check'
  ) THEN
    ALTER TABLE public.contract_deliverables
      ADD CONSTRAINT contract_deliverables_commercial_amount_check
      CHECK (commercial_amount IS NULL OR commercial_amount >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) contract_line_items (commercial scope / pricing lines)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  line_number integer NOT NULL DEFAULT 1,
  line_type text NOT NULL DEFAULT 'service'
    CHECK (line_type = ANY (ARRAY[
      'service'::text,
      'package'::text,
      'optional'::text,
      'discount'::text,
      'reimbursable'::text,
      'other'::text
    ])),
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_rate >= 0),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  is_optional boolean NOT NULL DEFAULT false,
  is_included boolean NOT NULL DEFAULT true,
  performance_obligation_ref text,
  deliverable_id uuid REFERENCES public.contract_deliverables(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, line_number)
);

CREATE INDEX IF NOT EXISTS contract_line_items_contract_idx
  ON public.contract_line_items (contract_id);

-- ---------------------------------------------------------------------------
-- 6) contract_modification_line_items (CO detail; preserves original contract lines)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_modification_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modification_id uuid NOT NULL REFERENCES public.contract_modifications(id) ON DELETE RESTRICT,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  source_line_item_id uuid REFERENCES public.contract_line_items(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT 'add'
    CHECK (action = ANY (ARRAY['add'::text, 'change'::text, 'remove'::text])),
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_rate >= 0),
  amount_change numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_mod_line_items_mod_idx
  ON public.contract_modification_line_items (modification_id);

CREATE INDEX IF NOT EXISTS contract_mod_line_items_contract_idx
  ON public.contract_modification_line_items (contract_id);

-- ---------------------------------------------------------------------------
-- 7) contract_approvals (submit / approve / reject trail)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (
    action = ANY (ARRAY[
      'submit'::text,
      'approve'::text,
      'reject'::text,
      'withdraw'::text,
      'request_changes'::text
    ])
  ),
  from_status text,
  to_status text,
  actor_label text NOT NULL,
  actor_role text,
  comments text,
  acted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_approvals_contract_idx
  ON public.contract_approvals (contract_id, acted_at DESC);

CREATE INDEX IF NOT EXISTS contract_approvals_pending_idx
  ON public.contract_approvals (action, acted_at DESC);

-- ---------------------------------------------------------------------------
-- 8) contract_documents (commercial/legal register — distinct from work scan docs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  doc_type text NOT NULL CHECK (
    doc_type = ANY (ARRAY[
      'proposal'::text,
      'contract'::text,
      'change_order'::text,
      'cancellation'::text,
      'approval'::text,
      'other'::text
    ])
  ),
  title text NOT NULL,
  storage_path text,
  external_url text,
  mime_type text,
  uploaded_by text NOT NULL DEFAULT 'system',
  modification_id uuid REFERENCES public.contract_modifications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_documents_has_location CHECK (
    storage_path IS NOT NULL OR external_url IS NOT NULL OR title IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS contract_documents_contract_idx
  ON public.contract_documents (contract_id);

CREATE INDEX IF NOT EXISTS contract_documents_type_idx
  ON public.contract_documents (contract_id, doc_type);

-- ---------------------------------------------------------------------------
-- 9) contract_audit_events (append-only operational audit / status history)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  summary text NOT NULL,
  actor_label text NOT NULL DEFAULT 'system',
  from_status text,
  to_status text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_audit_events_contract_idx
  ON public.contract_audit_events (contract_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contract_audit_events_type_idx
  ON public.contract_audit_events (event_type);

-- ---------------------------------------------------------------------------
-- 10) Triggers & functions (controls + audit; no revenue recognition side effects)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.contracts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contracts_set_updated_at ON public.contracts;
CREATE TRIGGER trg_contracts_set_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.contracts_set_updated_at();

-- Preserve original commercial value; track revised value via contract_value + COs
CREATE OR REPLACE FUNCTION public.contracts_protect_original_value()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.original_contract_value IS NOT NULL
       AND NEW.original_contract_value IS DISTINCT FROM OLD.original_contract_value THEN
      RAISE EXCEPTION 'original_contract_value is immutable after set (contract %)', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.original_contract_value IS NULL THEN
      NEW.original_contract_value := OLD.original_contract_value;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contracts_protect_original_value ON public.contracts;
CREATE TRIGGER trg_contracts_protect_original_value
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.contracts_protect_original_value();

-- Status / key field audit (history). Does NOT create invoices or recognize revenue.
CREATE OR REPLACE FUNCTION public.contracts_audit_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contract_audit_events (
      contract_id, event_type, summary, actor_label, from_status, to_status, payload
    ) VALUES (
      NEW.id,
      'contract_created',
      'Contract created: ' || COALESCE(NEW.contract_number, NEW.id::text),
      COALESCE(NEW.submitted_by, NEW.approved_by, 'system'),
      NULL,
      NEW.status,
      jsonb_build_object(
        'contract_value', NEW.contract_value,
        'customer_id', NEW.customer_id,
        'note', 'Creation does not recognize revenue or create deposits'
      )
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.contract_audit_events (
      contract_id, event_type, summary, actor_label, from_status, to_status, payload
    ) VALUES (
      NEW.id,
      'status_change',
      'Status ' || OLD.status || ' → ' || NEW.status,
      COALESCE(NEW.approved_by, NEW.submitted_by, NEW.canceled_by, 'system'),
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'approved_at', NEW.approved_at,
        'note', 'Status changes do not recognize revenue'
      )
    );
  END IF;

  IF NEW.contract_value IS DISTINCT FROM OLD.contract_value THEN
    INSERT INTO public.contract_audit_events (
      contract_id, event_type, summary, actor_label, payload
    ) VALUES (
      NEW.id,
      'value_change',
      'Contract value ' || OLD.contract_value::text || ' → ' || NEW.contract_value::text,
      COALESCE(NEW.approved_by, 'system'),
      jsonb_build_object(
        'prior', OLD.contract_value,
        'new', NEW.contract_value,
        'original_contract_value', NEW.original_contract_value
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contracts_audit_status_change ON public.contracts;
CREATE TRIGGER trg_contracts_audit_status_change
  AFTER INSERT OR UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.contracts_audit_status_change();

-- Block hard delete when Billing financial history exists
CREATE OR REPLACE FUNCTION public.contracts_prevent_financial_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inv_count integer;
  dep_count integer;
  pay_app integer;
BEGIN
  SELECT count(*) INTO inv_count FROM public.invoices i WHERE i.contract_id = OLD.id;
  SELECT count(*) INTO dep_count FROM public.deposits d WHERE d.contract_id = OLD.id;
  IF inv_count > 0 OR dep_count > 0 THEN
    RAISE EXCEPTION
      'Cannot delete contract %: % invoice(s), % deposit(s) exist. Cancel/close instead.',
      OLD.id, inv_count, dep_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_contracts_prevent_financial_delete ON public.contracts;
CREATE TRIGGER trg_contracts_prevent_financial_delete
  BEFORE DELETE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.contracts_prevent_financial_delete();

-- Change orders only against contracts that are past pure draft (approved lineage)
CREATE OR REPLACE FUNCTION public.contract_modifications_require_approved_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  c_status text;
BEGIN
  SELECT status INTO c_status FROM public.contracts WHERE id = NEW.contract_id;
  IF c_status IS NULL THEN
    RAISE EXCEPTION 'contract_id % not found', NEW.contract_id;
  END IF;

  -- Draft COs may be prepared once contract is at least approved; applied COs need approved+ lifecycle
  IF NEW.status IN ('approved', 'applied') AND c_status = ANY (ARRAY['draft', 'pending_approval', 'canceled']) THEN
    RAISE EXCEPTION
      'Change order cannot be % while contract status is %', NEW.status, c_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.approved_by IS NOT NULL AND NEW.approved_at IS NULL AND NEW.status IN ('approved', 'applied') THEN
    NEW.approved_at := now();
  END IF;

  IF NEW.status = 'applied' THEN
    IF NEW.prior_contract_value IS NULL THEN
      SELECT contract_value INTO NEW.prior_contract_value
      FROM public.contracts WHERE id = NEW.contract_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_modifications_require_approved ON public.contract_modifications;
CREATE TRIGGER trg_contract_modifications_require_approved
  BEFORE INSERT OR UPDATE ON public.contract_modifications
  FOR EACH ROW
  EXECUTE FUNCTION public.contract_modifications_require_approved_contract();

-- Keep change_order_value_total in sync when a mod is applied (does not touch revenue)
CREATE OR REPLACE FUNCTION public.contract_modifications_apply_value()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'applied'
     AND (OLD.status IS DISTINCT FROM 'applied') THEN
    UPDATE public.contracts c
    SET
      change_order_value_total = COALESCE(c.change_order_value_total, 0) + COALESCE(NEW.price_change, 0),
      -- Prefer explicit new_contract_value; otherwise leave value (Billing/GAAP may set it)
      contract_value = COALESCE(NEW.new_contract_value, c.contract_value),
      version = c.version + 1,
      terms_locked_at = COALESCE(c.terms_locked_at, now())
    WHERE c.id = NEW.contract_id;
    -- original_contract_value intentionally not updated
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_modifications_apply_value ON public.contract_modifications;
CREATE TRIGGER trg_contract_modifications_apply_value
  AFTER UPDATE ON public.contract_modifications
  FOR EACH ROW
  EXECUTE FUNCTION public.contract_modifications_apply_value();

-- Approvals require actor + timestamp (acted_at has default)
CREATE OR REPLACE FUNCTION public.contract_approvals_require_actor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.actor_label IS NULL OR btrim(NEW.actor_label) = '' THEN
    RAISE EXCEPTION 'contract_approvals.actor_label is required';
  END IF;
  IF NEW.acted_at IS NULL THEN
    NEW.acted_at := now();
  END IF;
  INSERT INTO public.contract_audit_events (
    contract_id, event_type, summary, actor_label, from_status, to_status, payload
  ) VALUES (
    NEW.contract_id,
    'approval_' || NEW.action,
    'Approval action: ' || NEW.action,
    NEW.actor_label,
    NEW.from_status,
    NEW.to_status,
    jsonb_build_object('comments', NEW.comments, 'actor_role', NEW.actor_role)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_approvals_require_actor ON public.contract_approvals;
CREATE TRIGGER trg_contract_approvals_require_actor
  BEFORE INSERT ON public.contract_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.contract_approvals_require_actor();

-- Cancellation documentation: if document type cancellation exists path is optional;
-- status check enforces cancel_reason. Extra: block cancel CO without reason already on contracts.

-- Append-only audit table
CREATE OR REPLACE FUNCTION public.contract_audit_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'contract_audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_audit_events_no_update ON public.contract_audit_events;
CREATE TRIGGER trg_contract_audit_events_no_update
  BEFORE UPDATE OR DELETE ON public.contract_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.contract_audit_events_append_only();

-- ---------------------------------------------------------------------------
-- 11) Views — read models for Contracts + Billing integration (no rename of GAAP views)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_contract_commercial_position
WITH (security_invoker = true) AS
SELECT
  c.id AS contract_id,
  c.contract_number,
  c.customer_id,
  cu.name AS customer_name,
  c.event_name,
  c.event_type,
  c.event_start,
  c.event_end,
  c.status,
  c.project_manager_label,
  c.billing_method,
  c.original_contract_value,
  c.change_order_value_total,
  c.contract_value AS current_contract_value,
  c.deposit_required,
  c.deposit_percent,
  c.minimum_deposit_amount,
  c.requires_deposit_before_work,
  c.performance_complete,
  c.approved_at,
  c.approved_by,
  COALESCE((
    SELECT sum(d.amount) FROM public.deposits d
    WHERE d.contract_id = c.id AND d.status = 'unearned'
  ), 0)::numeric AS unearned_deposits,
  COALESCE((
    SELECT sum(d.amount) FROM public.deposits d
    WHERE d.contract_id = c.id AND d.status IN ('unearned', 'applied')
  ), 0)::numeric AS deposits_received_total,
  COALESCE((
    SELECT count(*)::int FROM public.contract_milestones m WHERE m.contract_id = c.id
  ), 0) AS milestone_count,
  COALESCE((
    SELECT count(*)::int FROM public.contract_milestones m
    WHERE m.contract_id = c.id AND m.billed_invoice_id IS NOT NULL
  ), 0) AS milestones_billed_count
FROM public.contracts c
JOIN public.customers cu ON cu.id = c.customer_id;

GRANT SELECT ON public.v_contract_commercial_position TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12) RLS — demo open policies (Users & Roles will tighten; intent documented)
-- Role intent (app-layer until Brandon ships):
--   executive/admin: full
--   project_manager: draft/edit/submit/approve where authorized
--   accounting: financial terms, milestones (read); no unrestricted delete
--   employee/coordinator: limited operational read
--   customer: no contract access (no customer policies beyond internal anon demo)
-- ---------------------------------------------------------------------------

ALTER TABLE public.contract_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_modification_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_line_items_demo_all ON public.contract_line_items;
CREATE POLICY contract_line_items_demo_all ON public.contract_line_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS contract_mod_line_items_demo_all ON public.contract_modification_line_items;
CREATE POLICY contract_mod_line_items_demo_all ON public.contract_modification_line_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS contract_approvals_demo_all ON public.contract_approvals;
CREATE POLICY contract_approvals_demo_all ON public.contract_approvals
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS contract_documents_demo_all ON public.contract_documents;
CREATE POLICY contract_documents_demo_all ON public.contract_documents
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS contract_audit_events_demo_select ON public.contract_audit_events;
CREATE POLICY contract_audit_events_demo_select ON public.contract_audit_events
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS contract_audit_events_demo_insert ON public.contract_audit_events;
CREATE POLICY contract_audit_events_demo_insert ON public.contract_audit_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
-- no UPDATE/DELETE policies → append-only for roles under RLS

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_line_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_modification_line_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_approvals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_documents TO anon, authenticated;
GRANT SELECT, INSERT ON public.contract_audit_events TO anon, authenticated;

COMMENT ON TABLE public.contract_line_items IS 'Commercial line items for MainEvent contracts; not AR invoice lines.';
COMMENT ON TABLE public.contract_modification_line_items IS 'Change-order line detail; preserves original commercial scope.';
COMMENT ON TABLE public.contract_approvals IS 'Contract approval workflow history; does not recognize revenue.';
COMMENT ON TABLE public.contract_documents IS 'Commercial/legal document register (distinct from work_contract_documents scans).';
COMMENT ON TABLE public.contract_audit_events IS 'Append-only contract audit and status history.';
COMMENT ON COLUMN public.contracts.original_contract_value IS 'Immutable original approved commercial value; COs do not alter this field.';
COMMENT ON COLUMN public.contracts.contract_value IS 'Current revised contract value (original + applied change orders).';
COMMENT ON COLUMN public.contracts.change_order_value_total IS 'Sum of applied change-order price_change amounts.';
COMMENT ON VIEW public.v_contract_commercial_position IS 'Contracts commercial position + deposit cash snapshot from Billing deposits table.';
