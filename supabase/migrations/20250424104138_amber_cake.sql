/*
  # Delete specific users while keeping required ones
  
  1. Changes
    - Delete users with email starting with 'abhijatasen18+'
    - Keep specified users
    - Clean up related data
    
  2. Security
    - Use transaction for data consistency
*/

BEGIN;

-- Delete user data except for specified emails
DELETE FROM "User Dps"
WHERE email LIKE 'abhijatasen18+%'
AND email NOT IN (
  'abhijatasen18+send@gmail.com',
  'abhijatasen18+charlotte@gmail.com'
);

-- Clean up any orphaned notifications
DELETE FROM notifications
WHERE user_id LIKE 'abhijatasen18+%'
AND user_id NOT IN (
  'abhijatasen18+send@gmail.com',
  'abhijatasen18+charlotte@gmail.com'
);

-- Clean up any orphaned followers/following relationships
DELETE FROM followers
WHERE follower_id LIKE 'abhijatasen18+%'
AND follower_id NOT IN (
  'abhijatasen18+send@gmail.com',
  'abhijatasen18+charlotte@gmail.com'
);

DELETE FROM followers
WHERE following_id LIKE 'abhijatasen18+%'
AND following_id NOT IN (
  'abhijatasen18+send@gmail.com',
  'abhijatasen18+charlotte@gmail.com'
);

-- Clean up any orphaned posts and related data
DELETE FROM posts
WHERE user_id LIKE 'abhijatasen18+%'
AND user_id NOT IN (
  'abhijatasen18+send@gmail.com',
  'abhijatasen18+charlotte@gmail.com'
);

-- Clean up any orphaned coin transfers
DELETE FROM coin_transfers
WHERE sender_id LIKE 'abhijatasen18+%'
AND sender_id NOT IN (
  'abhijatasen18+send@gmail.com',
  'abhijatasen18+charlotte@gmail.com'
);

DELETE FROM coin_transfers
WHERE receiver_id LIKE 'abhijatasen18+%'
AND receiver_id NOT IN (
  'abhijatasen18+send@gmail.com',
  'abhijatasen18+charlotte@gmail.com'
);

-- Clean up any orphaned pending transfers
DELETE FROM pending_coin_transfers
WHERE sender_email LIKE 'abhijatasen18+%'
AND sender_email NOT IN (
  'abhijatasen18+send@gmail.com',
  'abhijatasen18+charlotte@gmail.com'
);

DELETE FROM pending_coin_transfers
WHERE receiver_email LIKE 'abhijatasen18+%'
AND receiver_email NOT IN (
  'abhijatasen18+send@gmail.com',
  'abhijatasen18+charlotte@gmail.com'
);

COMMIT;