# MoneyMate

MoneyMate is a local, four-service transaction organizer. It combines a
MySQL 8 database, a FastAPI/scikit-learn categorizer, a Spring Boot API, and a
vanilla HTML/CSS/JavaScript interface.

## Start the complete application

Requirements: Docker Desktop with Docker Compose, and a network connection for
the first image build.

From this folder (`MLproject`):

```powershell
docker compose up --build -d
docker compose ps
```

Open <http://localhost:8080>. The browser UI is served by nginx and proxies
`/api` requests to Spring Boot. MySQL initializes the schema and demo user plus
categories on the first start of its data volume.

The demo workspace uses user ID `1`. No authentication layer is included in
this local demo. For non-local use, provide strong credentials before startup:

```powershell
$env:MYSQL_PASSWORD = "choose-a-local-database-password"
$env:MYSQL_ROOT_PASSWORD = "choose-a-local-root-password"
docker compose up --build -d
```

The services are also available directly at:

| Service | URL |
| --- | --- |
| Frontend | <http://localhost:8080> |
| Spring Boot API | <http://localhost:8081/api> |
| API health | <http://localhost:8081/actuator/health> |
| ML service | <http://localhost:8000/health> |
| MySQL | `localhost:3306` |

Upload [`frontend/sample-bank.csv`](frontend/sample-bank.csv) through the
Upload screen to exercise CSV import, categorization, persistence, review, and
insights. The CSV includes Indian dates, rupee amounts with grouping commas,
separate debit/credit columns, and extra columns that are intentionally ignored.
Repeated upload rows are skipped using a SHA-256 hash of user, transaction
date, description, and amount; the upload response reports `skippedDuplicates`.

Useful container commands:

```powershell
docker compose logs -f backend ml-service
docker compose down
```

`docker compose down` keeps the database volume. The schema and seed scripts
are initialization scripts and run only when MySQL creates a fresh volume.

## Services and endpoints

### Database

`database/schema.sql` creates the six MySQL tables: `users`, `transactions`,
`categories`, `budgets`, `goals`, and `badges`. `budgets` has the composite
`(user_id, category_id)` key for the user/category many-to-many relation.
Amounts use `DECIMAL`; relationships and lookup indexes are defined in the
schema. `database/seed.sql` inserts the demo user and categories.

### ML service

`ml-service/api.py` exposes:

- `GET /health`
- `POST /predict` with either a `transactions` array or a `descriptions` array
- `POST /retrain` with optional labeled transactions

Predictions have category, confidence, cleaned description, and one of the
`auto`, `soft`, or `unverified` statuses. The API trains its Decision Tree from
synthetic UPI examples at startup; `POST /retrain` can replace it with labeled
records. The existing pipeline modules at this folder's root provide text
preprocessing, near-duplicate cache, TF-IDF/amount/date features, routing,
synthetic data generation, and Isolation Forest anomaly scoring.

The synthetic training set covers seven categories (including Health), varied
UPI description layouts, category-relevant descriptors, and overlapping spend
ranges. Training adds about 7% label noise plus intentionally ambiguous
Amazon/Paytm/PhonePe examples. The model combines word and character
`char_wb` n-gram TF-IDF, five coarse amount buckets, day-of-month, and a
learned merchant-category hint for recognized non-ambiguous merchants. Known
merchant hints are input features to the Decision Tree; amount remains a
separate, coarse feature. The Decision Tree is limited to depth 8 and leaf
size 5 so predicted confidence does not collapse to 1.0 on every example.
Training prints the held-out confidence distribution and auto/soft/unverified
routing percentages. With the default seed and 1,200 generated rows, the
unverified share is about 10%; this is a synthetic-data target, not a guarantee
for other datasets.

### Backend

The Spring Boot API parses one CSV upload (maximum 1,000 data rows and 5 MB),
keeps only the date, description, and amount/debit/credit values, sends the
batch to the ML service, and persists predictions. It accepts common Indian
date formats and quoted rupee amounts with comma grouping. If header detection
fails, the frontend offers a manual column mapping and retries.

Endpoints include:

- `POST /api/upload`
- `GET /api/transactions`, `GET /api/review-queue`
- `PUT /api/transactions/{id}` for category correction
- `GET /api/insights` (defaults to the latest month with transactions)
- `GET /api/insights?month=YYYY-MM` (selects a month; returns all available
  months and up to 12 months of trend data ending at the selected month)
- `GET/POST/PUT/DELETE /api/budgets`
- `GET/POST/PUT/DELETE /api/goals`
- `GET /api/categories` for category selectors

Requests default to the seeded demo user; endpoints that accept a `userId`
query parameter can select another existing user.

### Frontend

The interface has Home, Upload, Review Queue, Transaction History, Insights,
and Budgets screens. Insights render SVG category and monthly charts as well as
an accessible table. All displayed financial data is fetched from Spring Boot.

## Local development and tests (Windows PowerShell)

From the workspace root, install Python dependencies into the chosen virtual
environment:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\MLproject\requirements.txt -r .\MLproject\ml-service\requirements.txt
```

Run both the existing ML pipeline tests and FastAPI tests:

```powershell
$env:PYTHONPATH = "$PWD\MLproject\ml-service;$PWD"
python -m pytest .\MLproject\tests .\MLproject\ml-service\tests -q
```

Train and inspect the baseline model:

```powershell
python -m MLproject.train
```

Run backend tests (Java 17 and Maven required):

```powershell
Set-Location .\MLproject\backend
mvn test
```

The backend tests also parse the included sample CSV. Check frontend JavaScript
syntax (Node.js required):

```powershell
node --check .\MLproject\frontend\app.js
```

The complete end-to-end flow requires Docker Compose and a running MySQL
container. If an upload fails, the API returns a message; the frontend shows
the message and offers manual mapping when column detection was the problem.

For an existing database volume created before upload deduplication was added,
apply the one-time migration before starting the rebuilt backend:

```powershell
Get-Content -Raw .\database\migration_dedupe_hash.sql | docker compose exec -T mysql mysql -uroot -proot
```

Fresh MySQL volumes get the deduplication column and index from
`database/schema.sql` directly.
