CREATE TYPE public.coupon_discount_type AS ENUM ('percentage', 'flat');

CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  discount_type public.coupon_discount_type NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount_amount NUMERIC(10,2) CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  min_booking_amount NUMERIC(10,2) CHECK (min_booking_amount IS NULL OR min_booking_amount >= 0),
  applicable_puja_ids UUID[] NOT NULL DEFAULT '{}',
  usage_limit_total INTEGER CHECK (usage_limit_total IS NULL OR usage_limit_total > 0),
  usage_limit_per_user INTEGER CHECK (usage_limit_per_user IS NULL OR usage_limit_per_user > 0),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coupons_validity_window CHECK (
    valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from
  )
);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  discount_applied NUMERIC(10,2) NOT NULL CHECK (discount_applied > 0),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT offers_display_window CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date > start_date
  )
);

CREATE INDEX IF NOT EXISTS idx_coupons_active_window
  ON public.coupons (is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_user
  ON public.coupon_usages (coupon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_offers_active_window
  ON public.offers (is_active, start_date, end_date, display_order);

DROP TRIGGER IF EXISTS set_timestamp_coupons ON public.coupons;
CREATE TRIGGER set_timestamp_coupons
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_offers ON public.offers;
CREATE TRIGGER set_timestamp_offers
BEFORE UPDATE ON public.offers
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();

NOTIFY pgrst, 'reload schema';
