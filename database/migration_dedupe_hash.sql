USE moneymate;

ALTER TABLE transactions
  ADD COLUMN dedupe_hash CHAR(64) NULL;

UPDATE transactions
SET dedupe_hash = SHA2(CONCAT(
  user_id, CHAR(10), DATE_FORMAT(txn_date, '%Y-%m-%d'),
  CHAR(10), raw_description, CHAR(10), CAST(amount AS CHAR)
), 256)
WHERE dedupe_hash IS NULL;

ALTER TABLE transactions
  MODIFY dedupe_hash CHAR(64) NOT NULL,
  ADD UNIQUE KEY uk_transactions_dedupe_hash (dedupe_hash);
