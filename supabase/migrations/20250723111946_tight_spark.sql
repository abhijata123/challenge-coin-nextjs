/*
  # Add approved_at column to Vetting_Table

  1. Schema Changes
    - Add `approved_at` column to `Vetting_Table`
      - Type: `timestamp with time zone`
      - Nullable: true (default null)
      - Purpose: Track when vetting requests are approved

  2. Notes
    - This column will be set when an admin approves a vetting request
    - Existing records will have null values for this column
    - The approve_vetting_request function will update this column
*/

-- Add the approved_at column to Vetting_Table
ALTER TABLE "Vetting_Table" 
ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT null;

-- Add a comment to document the column
COMMENT ON COLUMN "Vetting_Table".approved_at IS 'Timestamp when the vetting request was approved by an admin';