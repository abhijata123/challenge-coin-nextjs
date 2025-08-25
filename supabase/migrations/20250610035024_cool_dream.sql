/*
  # Update process pending transfers function

  1. Changes
    - Process pending transfers when new user signs up
    - Transfer coins from pending_coin_transfers to Challenge Coin Table
    - Delete processed pending transfers
*/

CREATE OR REPLACE FUNCTION public.process_pending_transfers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    pending_transfer RECORD;
    sender_username text;
BEGIN
    -- Process all pending transfers for the new user
    FOR pending_transfer IN 
        SELECT * FROM pending_coin_transfers 
        WHERE receiver_email = NEW.email
    LOOP
        -- Get sender's username
        SELECT "Username" INTO sender_username 
        FROM "User Dps" 
        WHERE email = pending_transfer.sender_email;
        
        -- Create coins for the new user
        FOR i IN 1..pending_transfer.quantity LOOP
            INSERT INTO "Challenge Coin Table" (
                "Coin Name",
                "Date Issued",
                "Coin Image",
                "BacksideUrl",
                "Number Of Coins",
                "Mode Of Acquiring",
                "UserId",
                "Username",
                "Notes",
                "Awarded By",
                "Issuer Name",
                "Featured",
                "Public Display",
                "Has Copyright",
                "Priority",
                available_quantity
            ) VALUES (
                pending_transfer.coin_name,
                CURRENT_DATE,
                pending_transfer.coin_image,
                pending_transfer.backside_url,
                1, -- Each new coin is quantity 1
                'received from ' || COALESCE(sender_username, 'unknown sender'),
                NEW.email,
                NEW."Username",
                'This coin was sent to you before you joined!',
                null,
                null,
                false, -- New coins are not featured by default
                false, -- New coins are private by default
                false, -- No copyright by default
                0, -- Default priority
                1 -- Each new coin has quantity 1
            );
        END LOOP;
        
        -- Delete the processed pending transfer
        DELETE FROM pending_coin_transfers WHERE id = pending_transfer.id;
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- Update the trigger to use the new function
DROP TRIGGER IF EXISTS process_pending_transfers_trigger ON "User Dps";
CREATE TRIGGER process_pending_transfers_trigger
    AFTER INSERT ON "User Dps"
    FOR EACH ROW
    EXECUTE FUNCTION process_pending_transfers();