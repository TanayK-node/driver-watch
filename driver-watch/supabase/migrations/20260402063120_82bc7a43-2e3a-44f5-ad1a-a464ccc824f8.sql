
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS raw_name text;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_driver_date_unique ON public.attendance (driver_id, date);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to attendance" ON public.attendance FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to attendance" ON public.attendance FOR INSERT WITH CHECK (true);
