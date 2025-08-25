-- Create email normalization function
CREATE OR REPLACE FUNCTION normalize_email(email_input text)
RETURNS text AS $$
BEGIN
  RETURN lower(trim(email_input));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the process_pending_transfers function with email normalization and SECURITY DEFINER
CREATE OR REPLACE FUNCTION process_pending_transfers()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    pending_transfer RECORD;
    sender_username text;
BEGIN
    -- Process all pending transfers for the new user (normalize email comparison)
    FOR pending_transfer IN 
        SELECT * FROM pending_coin_transfers 
        WHERE normalize_email(receiver_email) = normalize_email(NEW.email)
    LOOP
        -- Get sender's username
        SELECT "Username" INTO sender_username 
        FROM "User Dps" 
        WHERE normalize_email(email) = normalize_email(pending_transfer.sender_email);
        
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
                NEW.email, -- Use the normalized email from NEW record
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
$$ LANGUAGE plpgsql;

-- Update the transfer_coins_with_note function with email normalization
CREATE OR REPLACE FUNCTION transfer_coins_with_note(
    sender_email text,
    receiver_email text,
    p_coin_id bigint,
    p_quantity integer,
    p_note text DEFAULT NULL
)
RETURNS text AS $$
DECLARE
    sender_user_id text;
    receiver_user_id text;
    receiver_username text;
    original_coin_name text;
    original_coin_image text;
    original_backside_url text;
    original_date_issued date;
    original_mode_of_acquiring text;
    original_awarded_by text;
    original_issuer_name text;
    original_featured boolean;
    original_public_display boolean;
    original_has_copyright boolean;
    original_priority bigint;
    current_available_quantity integer;
    current_number_of_coins numeric;
    receiver_exists boolean := false;
    normalized_sender_email text;
    normalized_receiver_email text;
BEGIN
    -- Normalize email inputs
    normalized_sender_email := normalize_email(sender_email);
    normalized_receiver_email := normalize_email(receiver_email);
    
    -- Validate inputs
    IF p_quantity <= 0 THEN
        RETURN 'Invalid quantity';
    END IF;

    -- Get sender's user ID (email is already the ID in User Dps)
    SELECT email INTO sender_user_id FROM "User Dps" WHERE normalize_email(email) = normalized_sender_email;
    IF sender_user_id IS NULL THEN
        RETURN 'Sender not found';
    END IF;

    -- Check if receiver exists
    SELECT email, "Username" INTO receiver_user_id, receiver_username FROM "User Dps" WHERE normalize_email(email) = normalized_receiver_email;
    IF receiver_user_id IS NOT NULL THEN
        receiver_exists := true;
    END IF;

    -- Check if sender owns the coin and has enough quantity
    SELECT
        "Coin Name",
        "Coin Image",
        "BacksideUrl",
        "Date Issued",
        "Mode Of Acquiring",
        "Awarded By",
        "Issuer Name",
        "Featured",
        "Public Display",
        "Has Copyright",
        "Priority",
        COALESCE(available_quantity, 1),
        "Number Of Coins"
    INTO
        original_coin_name,
        original_coin_image,
        original_backside_url,
        original_date_issued,
        original_mode_of_acquiring,
        original_awarded_by,
        original_issuer_name,
        original_featured,
        original_public_display,
        original_has_copyright,
        original_priority,
        current_available_quantity,
        current_number_of_coins
    FROM "Challenge Coin Table"
    WHERE id = p_coin_id AND normalize_email("UserId") = normalized_sender_email;

    IF original_coin_name IS NULL THEN
        RETURN 'Coin not found or not owned by sender';
    END IF;

    IF current_available_quantity < p_quantity THEN
        RETURN 'Insufficient coin quantity';
    END IF;

    -- Reduce quantity of the original coin
    UPDATE "Challenge Coin Table"
    SET
        "Number Of Coins" = "Number Of Coins" - p_quantity,
        available_quantity = GREATEST(0, COALESCE(available_quantity, 1) - p_quantity)
    WHERE id = p_coin_id;

    -- If receiver exists, transfer directly
    IF receiver_exists THEN
        -- Create new coins for the receiver
        FOR i IN 1..p_quantity LOOP
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
                original_coin_name,
                original_date_issued,
                original_coin_image,
                original_backside_url,
                1, -- Each new coin is quantity 1
                'received from ' || (SELECT "Username" FROM "User Dps" WHERE normalize_email(email) = normalized_sender_email),
                receiver_user_id,
                receiver_username,
                COALESCE(p_note, ''), -- Use provided note or empty string
                original_awarded_by,
                original_issuer_name,
                false, -- New coins are not featured by default
                false, -- New coins are private by default
                original_has_copyright,
                COALESCE(original_priority, 0),
                1 -- Each new coin has quantity 1
            );
        END LOOP;
        
        RETURN 'success';
    ELSE
        -- Receiver doesn't exist, create pending transfer (store normalized emails)
        INSERT INTO pending_coin_transfers (
            sender_email,
            receiver_email,
            coin_id,
            coin_name,
            coin_image,
            backside_url,
            quantity
        ) VALUES (
            normalized_sender_email,
            normalized_receiver_email,
            p_coin_id,
            original_coin_name,
            original_coin_image,
            original_backside_url,
            p_quantity
        );
        
        RETURN 'pending';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;