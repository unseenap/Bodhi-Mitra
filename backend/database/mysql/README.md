# Bodhi-Mitra MySQL database

The production schema targets MySQL 8.0.17 or newer. It uses InnoDB, `utf8mb4`, millisecond timestamps, UTC, foreign keys, JSON Schema validation, and database-calculated assessment results.

## Files

- `schema.sql`: required tables, constraints, indexes, triggers, seed data and views.
- `maintenance.sql`: optional MySQL event that replaces MongoDB TTL cleanup.
- `verify.sql`: read-only post-install checks for tables, views, triggers and seed data.

## Install on a fresh database

Create an empty database named `bodhi_mitra` with `utf8mb4_0900_ai_ci`, then run:

```powershell
mysql -h YOUR_HOST -u YOUR_USER -p bodhi_mitra < backend/database/mysql/schema.sql
```

Verify the installation:

```powershell
mysql -h YOUR_HOST -u YOUR_USER -p bodhi_mitra < backend/database/mysql/verify.sql
```

If the provider supports MySQL events, enable `event_scheduler` in its settings and run:

```powershell
mysql -h YOUR_HOST -u YOUR_USER -p bodhi_mitra < backend/database/mysql/maintenance.sql
```

If events are unavailable, run this query from a backend scheduled job every five minutes:

```sql
DELETE FROM pending_student_registrations
WHERE expires_at <= UTC_TIMESTAMP(3);
```

## Application rules

- Generate lowercase RFC 4122 UUIDs in Node for every `*_uuid` field.
- Expose UUIDs through APIs; keep numeric IDs internal.
- Create a user and its role profile in one transaction.
- Allocate a psychologist, update the emergency request and create the session in one transaction with row locking.
- Insert assessments in chronological order. The insert trigger atomically enforces
  the rolling seven-day interval by updating `assessment_next_eligible_at`.
- Store all application timestamps in UTC.
- Configure every application connection for UTC (for example, execute
  `SET time_zone = '+00:00'` when a pooled connection is created). `DATETIME`
  defaults use the connection time zone.
- Hash passwords and OTPs in Node. Never send plain credentials to MySQL.
- Compute `endpoint_hash` as the raw 32-byte SHA-256 digest of the push
  subscription endpoint before insert/update. This keeps endpoint uniqueness
  portable across MySQL providers.
- Use `legacy_mongo_id_map` only while migrating existing Atlas records.

Assessment triggers derive `score`, `safety_flag` and `band` from the 20 Boolean answers. Client-provided values are overwritten.

Chat messages remain transient because the legal retention policy has not been finalized. Voice and video media never belong in this database.

## Required backend migration

Creating these tables does not switch the existing backend to MySQL. The backend currently imports Mongoose models and validates emergency request IDs as MongoDB ObjectIds. The integration phase must:

1. install and configure a MySQL ORM or client;
2. replace Mongoose queries and aggregations;
3. change public emergency request validation from a 24-character ObjectId to UUID;
4. align the shared roll-number validator with the accepted `UCM`, `UCS`, `UCD` and `UBT` formats;
5. change `MONGODB_URI` to a secret `DATABASE_URL`;
6. migrate and verify existing MongoDB records before switching production traffic.
