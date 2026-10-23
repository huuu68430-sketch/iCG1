-- Add user_id column to admin_users table for Supabase Auth integration
-- Run this in Supabase SQL Editor

-- Check if user_id column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN user_id UUID;
        
        -- Create index for better performance
        CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
        
        RAISE NOTICE 'user_id column added successfully';
    ELSE
        RAISE NOTICE 'user_id column already exists';
    END IF;
END $$;

-- Enable RLS if not enabled
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "admin_users_read_self" ON admin_users;
DROP POLICY IF EXISTS "admin_users_admin_all" ON admin_users;
DROP POLICY IF EXISTS "admin_users_insert_self" ON admin_users;
DROP POLICY IF EXISTS "admin_users_update_self" ON admin_users;
DROP POLICY IF EXISTS "admin_users_delete_self" ON admin_users;

-- Allow logged-in user to read their own admin row
CREATE POLICY "admin_users_read_self"
ON admin_users FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow authenticated users to insert themselves (for first admin setup)
CREATE POLICY "admin_users_insert_self"
ON admin_users FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow users to update their own record
CREATE POLICY "admin_users_update_self"
ON admin_users FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow users to delete their own record
CREATE POLICY "admin_users_delete_self"
ON admin_users FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Verify the changes
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'admin_users' ORDER BY ordinal_position;
