USE moneymate;

INSERT INTO users (id, name, email)
VALUES (1, 'Demo User', 'demo@moneymate.local')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO categories (name, color)
VALUES
  ('Food & Dining', '#E69F00'),
  ('Transport', '#56B4E9'),
  ('Shopping', '#CC79A7'),
  ('Bills', '#0072B2'),
  ('Entertainment', '#F0E442'),
  ('Transfer', '#009E73'),
  ('Health', '#D55E00'),
  ('Other', '#666666')
ON DUPLICATE KEY UPDATE color = VALUES(color);

DELETE FROM transactions
WHERE user_id = 1
  AND raw_description IN (
    'UPI-NETFLIX-SUBSCRIPTION-20251011-paytm@ybl',
    'PHARMACY-MEDICINE-20251012@oksbi',
    'UPI-UBER-TRIP-20251013@okaxis'
  );

INSERT INTO transactions (
  user_id, raw_description, cleaned_description, amount, txn_date,
  category_id, confidence_score, status, dedupe_hash
)
SELECT seed.user_id, seed.raw_description, seed.cleaned_description,
       seed.amount, seed.txn_date, categories.id, seed.confidence_score,
       seed.status,
       SHA2(CONCAT(seed.user_id, CHAR(10), DATE_FORMAT(seed.txn_date, '%Y-%m-%d'),
                   CHAR(10), seed.raw_description, CHAR(10),
                   CAST(seed.amount AS CHAR)), 256)
FROM (
  SELECT 1 AS user_id, 'UPI-NETFLIX-SUBSCRIPTION-20250811-paytm@ybl' AS raw_description,
         'upi netflix subscription <NUM> <HANDLE>' AS cleaned_description,
         649.00 AS amount, DATE '2025-08-11' AS txn_date,
         'Entertainment' AS category_name, 0.9200 AS confidence_score, 'auto' AS status
  UNION ALL
  SELECT 1, 'PHARMACY-MEDICINE-20250812@oksbi',
         'pharmacy medicine <NUM> <HANDLE>', 650.00, DATE '2025-08-12',
         'Health', 0.8800, 'auto'
  UNION ALL
  SELECT 1, 'UPI-UBER-TRIP-20250813@okaxis',
         'upi uber trip <NUM> <HANDLE>', 285.00, DATE '2025-08-13',
         'Transport', 0.7800, 'soft'
) AS seed
JOIN categories ON categories.name = seed.category_name
ON DUPLICATE KEY UPDATE dedupe_hash = VALUES(dedupe_hash);
