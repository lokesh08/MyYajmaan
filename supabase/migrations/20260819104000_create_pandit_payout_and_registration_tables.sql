-- Sensitive payout information and repeatable Pandit onboarding submissions.
-- Ciphertext is produced by the application/backend before storage.

CREATE TABLE IF NOT EXISTS public.pandit_bank_details (
  pandit_id UUID PRIMARY KEY
    REFERENCES public.pandits(id)
    ON DELETE CASCADE,
  account_no_enc TEXT NOT NULL,
  ifsc_enc TEXT NOT NULL,
  upi_id_enc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_timestamp_pandit_bank_details ON public.pandit_bank_details;
CREATE TRIGGER set_timestamp_pandit_bank_details
BEFORE UPDATE ON public.pandit_bank_details
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS public.pandit_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pandit_id UUID NOT NULL
    REFERENCES public.pandits(id)
    ON DELETE CASCADE,
  id_proof_url TEXT,
  certificate_url TEXT,
  reviewed_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pandit_registrations_pandit_id
  ON public.pandit_registrations(pandit_id);

CREATE INDEX IF NOT EXISTS idx_pandit_registrations_reviewed_by
  ON public.pandit_registrations(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pandit_registrations_pending_review
  ON public.pandit_registrations(submitted_at)
  WHERE reviewed_at IS NULL;

ALTER TABLE public.pandit_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pandit_registrations ENABLE ROW LEVEL SECURITY;

-- Application access is mediated by the FastAPI service-role client.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.pandit_bank_details, public.pandit_registrations
  TO service_role;
