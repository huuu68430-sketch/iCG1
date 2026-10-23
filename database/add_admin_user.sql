-- Add abs@gmail.com as admin
-- IMPORTANT: Replace 'YOUR_USER_UUID_HERE' with the actual user_id from Supabase Auth > Users
-- You can find this in Supabase Dashboard > Authentication > Users > click on abs@gmail.com

-- First, temporarily disable RLS for this operation
alter table public.admin_users disable row level security;

-- Insert the user as admin (replace UUID with actual user_id)
INSERT INTO public.admin_users (user_id, role, is_active)
VALUES ('YOUR_USER_UUID_HERE', 'admin', true)
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_active = true;

-- Re-enable RLS
alter table public.admin_users enable row level security;

-- Verify the insertion
SELECT * FROM public.admin_users;
