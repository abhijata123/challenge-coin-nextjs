-- Update coin notification function to use email for follower relationship
CREATE OR REPLACE FUNCTION create_coin_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
BEGIN
  -- Get username
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = NEW."UserId";

  -- Create notifications for followers using email
  INSERT INTO notifications (
    recipient_id,
    type,
    content,
    reference_id,
    reference_type,
    metadata
  )
  SELECT 
    f.follower_id,
    'new_coin',
    format('%s added a new coin: %s', v_username, NEW."Coin Name"),
    NEW.id::text,
    'coin',
    jsonb_build_object(
      'coin_name', NEW."Coin Name",
      'coin_image', NEW."Coin Image",
      'date_issued', NEW."Date Issued",
      'username', v_username,
      'user_id', NEW."UserId",
      'public_url', format('/collection/%s/coin/%s', v_username, NEW.id),
      'is_public', NEW."Public Display"
    )
  FROM followers f
  WHERE f.following_id = NEW."UserId"
  AND f.follower_id != NEW."UserId"
  AND EXISTS (
    SELECT 1 FROM "User Dps" ud
    WHERE ud.email = f.follower_id
  );

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_coin_notification_trigger ON "Challenge Coin Table";
CREATE TRIGGER create_coin_notification_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION create_coin_notification();