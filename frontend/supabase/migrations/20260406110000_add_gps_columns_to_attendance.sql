ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS gps_first_in text;

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS gps_last_out text;

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS gps_total_hours numeric;