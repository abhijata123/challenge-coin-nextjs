/*
  # Update User Dps table ID type

  1. Changes
    - Change id column type from bigint to uuid to match Supabase Auth user IDs
    - Remove identity property and use gen_random_uuid() as default
    
  2. Security
    - Temporarily drop existing RLS policies
    - Recreate RLS policies after column type change
*/

-- Store existing policies to recreate them later
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can insert their own profile" ON "User Dps";
  DROP POLICY IF EXISTS "Users can update their own profile" ON "User Dps";
  DROP POLICY IF EXISTS "Users can view their own profile" ON "User Dps";
END $$;

-- Remove identity and change column type
ALTER TABLE "User Dps" ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE "User Dps" 
  ALTER COLUMN id SET DATA TYPE uuid USING id::text::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "User Dps" ALTER COLUMN id SET NOT NULL;

-- Recreate policies with the new UUID type
CREATE POLICY "Users can insert their own profile"
  ON "User Dps"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own profile"
  ON "User Dps"
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Users can view their own profile"
  ON "User Dps"
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);