-- Add is_founding_member column to User Dps table
ALTER TABLE "User Dps"
ADD COLUMN IF NOT EXISTS is_founding_member boolean DEFAULT false;

-- Set initial founding members
UPDATE "User Dps"
SET is_founding_member = true
WHERE email IN (
  'abhijatasen18+charlotte@gmail.com',
  'lisa@coachlisagodfrey.com'
);