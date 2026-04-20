CREATE POLICY "Allow public insert access to drivers"
ON public.drivers
FOR INSERT
TO public
WITH CHECK (true);