/*
  # Create transfer_coins_with_note function

  1. New Functions
    - `transfer_coins_with_note` - Handles coin transfers with custom notes
      - Validates sender and receiver exist
      - Checks coin ownership and quantity
      - Reduces original coin quantity
      - Creates duplicate coins for receiver with custom notes
      - Returns success/error status

  2. Security
    - Function uses proper validation for all inputs
    - Handles edge cases and errors gracefully
    - Uses transactions to ensure data consistency
*/

CREATE OR REPLACE FUNCTION public.transfer_coins_with_note(
    sender_email text,
    receiver_email text,
    p_coin_id bigint,
    p_quantity integer,
    p_note text
)
RETURNS text
LANGUAGE plpgsql
AS $$
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
BEGIN
    -- Validate inputs
    IF p_quantity <= 0 THEN
        RETURN 'Invalid quantity';
    END IF;

    -- Get sender's user ID (email is already the ID in User Dps)
    SELECT email INTO sender_user_id FROM "User Dps" WHERE email = sender_email;
    IF sender_user_id IS NULL THEN
        RETURN 'Sender not found';
    END IF;

    -- Get receiver's user ID and username
    SELECT email, "Username" INTO receiver_user_id, receiver_username FROM "User Dps" WHERE email = receiver_email;
    IF receiver_user_id IS NULL THEN
        RETURN 'Receiver not found';
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
    WHERE id = p_coin_id AND "UserId" = sender_email;

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
            'received from ' || (SELECT "Username" FROM "User Dps" WHERE email = sender_email),
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
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Error: ' || SQLERRM;
END;
$$;