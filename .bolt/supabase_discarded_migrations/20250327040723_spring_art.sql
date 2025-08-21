CREATE OR REPLACE FUNCTION transfer_coins(
  p_sender_id bigint,
  p_receiver_id bigint,
  p_coin_id bigint,
  p_quantity integer,
  p_transaction_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coin_record RECORD;
BEGIN
  -- Start transaction
  BEGIN
    -- Lock the coin record for update
    SELECT * INTO v_coin_record
    FROM "Challenge Coin Table"
    WHERE id = p_coin_id AND "UserId" = p_sender_id::text
    FOR UPDATE;

    -- Validate coin exists and sender has sufficient balance
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Coin not found or does not belong to sender';
    END IF;

    IF v_coin_record.available_quantity < p_quantity THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Update sender's coin balance
    UPDATE "Challenge Coin Table"
    SET available_quantity = available_quantity - p_quantity
    WHERE id = p_coin_id;

    -- Create or update receiver's coin record
    WITH receiver_coin AS (
      SELECT id 
      FROM "Challenge Coin Table"
      WHERE "UserId" = p_receiver_id::text
      AND "Coin Name" = v_coin_record."Coin Name"
    )
    INSERT INTO "Challenge Coin Table" (
      "UserId",
      "Username",
      "Coin Name",
      "Coin Image",
      "BacksideUrl",
      "Date Issued",
      "Mode Of Acquiring",
      "Number Of Coins",
      "Notes",
      "Public Display",
      available_quantity
    )
    SELECT 
      p_receiver_id::text,
      (SELECT "Username" FROM "User Dps" WHERE id = p_receiver_id),
      v_coin_record."Coin Name",
      v_coin_record."Coin Image",
      v_coin_record."BacksideUrl",
      CURRENT_DATE,
      'Received',
      p_quantity,
      'Received from transfer',
      false,
      p_quantity
    WHERE NOT EXISTS (SELECT 1 FROM receiver_coin)
    ON CONFLICT (id) DO UPDATE
    SET available_quantity = "Challenge Coin Table".available_quantity + p_quantity;

    -- Record the transaction
    INSERT INTO coin_transactions (
      sender_id,
      receiver_id,
      coin_id,
      quantity,
      status,
      transaction_id
    ) VALUES (
      p_sender_id,
      p_receiver_id,
      p_coin_id,
      p_quantity,
      'completed',
      p_transaction_id
    );

    -- Update coin counts for both users
    UPDATE "User Dps"
    SET "Number Of Coins" = (
      SELECT COALESCE(SUM(available_quantity), 0)
      FROM "Challenge Coin Table"
      WHERE "UserId" = p_sender_id::text
    )
    WHERE id = p_sender_id;

    UPDATE "User Dps"
    SET "Number Of Coins" = (
      SELECT COALESCE(SUM(available_quantity), 0)
      FROM "Challenge Coin Table"
      WHERE "UserId" = p_receiver_id::text
    )
    WHERE id = p_receiver_id;

  EXCEPTION
    WHEN OTHERS THEN
      -- Record failed transaction
      INSERT INTO coin_transactions (
        sender_id,
        receiver_id,
        coin_id,
        quantity,
        status,
        transaction_id
      ) VALUES (
        p_sender_id,
        p_receiver_id,
        p_coin_id,
        p_quantity,
        'failed',
        p_transaction_id
      );
      RAISE;
  END;
END;
$$;