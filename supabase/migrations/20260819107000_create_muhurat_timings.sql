-- Date-specific auspicious time windows. One timing can apply to one or many pujas.

CREATE TABLE IF NOT EXISTS public.muhurat_timings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puja_ids UUID[] NOT NULL,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT muhurat_timings_puja_ids_not_empty
    CHECK (cardinality(puja_ids) > 0),
  CONSTRAINT muhurat_timings_puja_ids_no_nulls
    CHECK (array_position(puja_ids, NULL) IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_muhurat_timings_date
  ON public.muhurat_timings(date);

CREATE INDEX IF NOT EXISTS idx_muhurat_timings_puja_ids
  ON public.muhurat_timings USING GIN(puja_ids);

CREATE INDEX IF NOT EXISTS idx_muhurat_timings_date_recommended
  ON public.muhurat_timings(date)
  WHERE is_recommended = TRUE;

DROP TRIGGER IF EXISTS set_timestamp_muhurat_timings ON public.muhurat_timings;
CREATE TRIGGER set_timestamp_muhurat_timings
BEFORE UPDATE ON public.muhurat_timings
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();
