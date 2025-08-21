/*
  # Add indexes for faster coin queries
  
  1. Changes
    - Add indexes for commonly queried fields
    - Optimize coin table performance
    
  2. Security
    - No changes to security policies
*/

-- Add index for Username lookups
CREATE INDEX IF NOT EXISTS idx_challenge_coin_username 
ON "Challenge Coin Table" ("Username");

-- Add index for public coins
CREATE INDEX IF NOT EXISTS idx_challenge_coin_public 
ON "Challenge Coin Table" ("Public Display")
WHERE "Public Display" = true;

-- Add compound index for Username and Public Display
CREATE INDEX IF NOT EXISTS idx_challenge_coin_username_public 
ON "Challenge Coin Table" ("Username", "Public Display");

-- Add index for Priority ordering
CREATE INDEX IF NOT EXISTS idx_challenge_coin_priority 
ON "Challenge Coin Table" ("Priority");

-- Add index for Featured coins
CREATE INDEX IF NOT EXISTS idx_challenge_coin_featured 
ON "Challenge Coin Table" ("Featured");