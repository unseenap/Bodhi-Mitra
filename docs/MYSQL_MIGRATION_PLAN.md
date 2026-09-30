# Bodhi-Mitra MongoDB to MySQL Migration Plan

## Objective

Replace MongoDB and Mongoose with a production-ready MySQL data layer while
preserving all current frontend routes, API response shapes, authentication,
Socket.IO events, emergency matching, chat, voice/video signaling,
assessments, notifications, administration, and PWA behavior.

The protected MongoDB snapshot is available on:

```text
codex/mongodb-backup-2026-09-01
```

The MySQL conversion will happen on `main`. MongoDB will not be removed until
all MySQL acceptance gates pass.

## Technical decisions

### Database stack

- MySQL 8.0 or newer.
- `mysql2` for connection pooling and prepared statements.
- Kysely for typed queries and transactions.
- `backend/database/mysql/schema.sql` remains the only canonical SQL file.
- Application database types live in `backend/src/database/types.ts`.
- Repositories isolate controllers, services, Socket.IO, and scheduled jobs
  from SQL details.

Kysely is preferred for this migration because the existing SQL schema uses
MySQL constraints, generated columns, JSON checks, and operational indexes
that should remain controlled by `schema.sql`.

### Compatibility rules

- Existing HTTP routes and Socket.IO event names remain unchanged.
- Existing frontend response shapes remain unchanged.
- Dates are stored in UTC and returned as ISO-8601 strings.
- Password and OTP bcrypt hashes remain compatible.
- Public entities use UUIDs. Internal joins may use `BIGINT UNSIGNED` keys.
- Chat message bodies remain transient until the legal retention policy is
  approved.
- Sensitive values never appear in logs, notification previews, or migration
  reports.

## Target architecture

```text
HTTP controllers / Socket.IO / scheduled jobs
                    |
              domain services
                    |
            repository interfaces
                    |
        Kysely MySQL repositories
                    |
        mysql2 connection pool
                    |
                  MySQL
```

Controllers and sockets must not contain raw SQL. Transactions belong in
services or transactional repository methods.

## Target tables

The canonical schema must contain and validate:

1. `departments`
2. `users`
3. `student_profiles`
4. `psychologist_profiles`
5. `psychologist_specializations`
6. `pending_student_registrations`
7. `push_subscriptions`
8. `notification_preferences`
9. `notifications`
10. `notification_delivery_attempts`
11. `emergency_requests`
12. `sessions`
13. `assessments`
14. `audit_logs`
15. `scheduler_leases`
16. `legacy_mongo_id_map`

The scheduler lease table is required because more than one backend instance
may execute scheduled notification jobs.

## Phase 1: Schema validation and database foundation

- [x] Review every MySQL table against the eight current Mongoose models.
- [x] Confirm foreign keys and delete behavior for all relationships.
- [x] Confirm unique email and roll-number handling is case-safe.
- [x] Confirm the one-live-emergency-per-student generated-column constraint.
- [x] Confirm one session per emergency request.
- [x] Confirm one assessment submission per eligibility window.
- [x] Confirm notification recipient and deduplication constraints.
- [x] Add a scheduler lease mechanism if multiple server instances are used.
- [x] Validate every JSON column and maximum payload size.
- [x] Validate all indexes using the actual application query inventory.
- [x] Test `schema.sql` against an empty MySQL 8 database.
- [x] Test running `schema.sql` twice without destructive side effects.

Deliverables:

```text
backend/database/mysql/schema.sql
backend/src/database/config.ts
backend/src/database/client.ts
backend/src/database/types.ts
backend/src/database/health.ts
```

Environment changes:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/bodhi_mitra
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_CONNECT_TIMEOUT_SECONDS=10
```

`MONGODB_URI` was removed from active configuration at final cutover. Historical
rollback code is retained only on the protected backup branch.

### Phase 1 acceptance gate

- MySQL starts with the complete schema.
- The backend can connect, run `SELECT 1`, and shut down cleanly.
- Pool exhaustion, invalid credentials, and unavailable database errors are
  handled without leaking secrets.
- Production startup fails fast when `DATABASE_URL` is missing.

### Phase 1 execution status — 2026-09-01

Completed:

- Installed `mysql2` and Kysely and added a bounded, UTC-configured pool.
- Added typed definitions for all 16 tables.
- Added safe MySQL health reporting and clean pool shutdown.
- Added `npm run mysql:verify -w backend` for non-destructive live schema
  verification.
- Added the distributed scheduler lease table.
- Added explicit limits and enum validation for stored JSON payloads.
- Added missing indexes for role listings, emergency analytics, and global
  session history.
- Added and passed the MySQL foundation tests and backend typecheck.

Live acceptance completed:

- Applied all 46 schema statements to the Aiven `bodhi_mitra` database twice.
- Verified 16 tables, 2 views, and 11 triggers after the second application.
- Confirmed secure remote authentication and clean connection shutdown.

Staged cutover note:

- `DATABASE_URL` is optional while MongoDB remains the active production data
  store. It becomes mandatory at final cutover; requiring it now would break
  the existing deployed application before repositories have migrated.

Phase 1 is complete. Phase 2 may now begin.

## Phase 2: Repository contracts

Create domain-facing repository interfaces:

```text
backend/src/repositories/
  user.repository.ts
  registration.repository.ts
  psychologist.repository.ts
  emergency.repository.ts
  session.repository.ts
  assessment.repository.ts
  audit.repository.ts
  notification.repository.ts
  push-subscription.repository.ts
```

Create MySQL implementations under:

```text
backend/src/repositories/mysql/
```

Repository rules:

- Return application DTOs, not raw MySQL rows.
- Convert `BIGINT` values safely to strings where required.
- Never expose password, OTP, push-subscription, or private assessment data by
  default.
- Use prepared parameters for every value.
- Centralize pagination and search escaping.
- Keep role and ownership checks inside protected queries.

### Phase 2 acceptance gate

- Repository unit tests pass using deterministic fixtures.
- MySQL integration tests verify foreign keys, unique constraints, pagination,
  and transaction rollback.
- No controller or socket file imports Mongoose models after its repository is
  migrated.

### Phase 2 execution status — 2026-09-01

Completed:

- Added contracts for users, pending registrations, psychologists,
  emergencies, sessions, assessments, audit records, notifications, and push
  subscriptions.
- Added Kysely/MySQL adapters for all nine contracts.
- Repositories accept either the shared database client or an injected
  transaction, which lets domain services compose atomic workflows.
- Public methods return application DTOs with UUIDs; internal `BIGINT` keys,
  password hashes, OTP hashes, assessment answers, and push payloads remain
  scoped to repositories that require them.
- Added bounded list queries, escaped search input, recipient-scoped
  notification mutations, deterministic notification cursor pagination, and
  idempotent notification creation.
- Added atomic pending-registration promotion into a verified user and student
  profile.
- Added deterministic unit tests and rollback-only Aiven integration tests.

Live acceptance results:

- Transaction rollback left no fixture rows behind.
- Case-insensitive email uniqueness passed.
- Role guards and foreign-key enforcement passed.
- Notification recipient pagination returned every item exactly once.
- Pending registration promotion created the user/profile and removed the
  pending record atomically.

Phase 2 is complete. Controllers and Socket.IO were migrated through these
repositories in Phases 3–6.

## Phase 3: Authentication, users, and psychologist directory

Migration order:

1. Authentication middleware lookup.
2. Student pending registration.
3. OTP issuance and consumption.
4. Student verification and account creation.
5. Password login, reset, and change.
6. Current-user endpoint.
7. Admin creation and seeding.
8. Psychologist creation, verification, status, profile, and specialization.
9. Public expert directory.
10. Push-subscription storage.

Required transactions:

- Verify OTP, create the student user/profile, and delete the pending
  registration in one transaction.
- Consume OTP and change password atomically.
- Create psychologist user, profile, and specializations atomically.
- Replace psychologist specializations atomically during profile updates.

Security requirements:

- Preserve enumeration-resistant authentication messages.
- Preserve bcrypt cost and dummy-password comparison behavior.
- Lock or conditionally update OTP attempts to prevent concurrent reuse.
- Normalize email and roll numbers before queries.
- JWT `sub` changes from Mongo ObjectId to user UUID. Existing sessions will be
  intentionally signed out during final cutover.

### Phase 3 acceptance gate

- Registration does not create a student before OTP verification.
- OTPs cannot be reused or verified concurrently.
- Password login works for all three roles.
- Password reset and forced password change work.
- Admin psychologist management and expert-directory filters work.
- Existing authentication security tests pass against MySQL.

### Phase 3 execution status — completed 2026-09-02

Completed:

- Audited JWT, HTTP middleware, Socket.IO authentication, registration,
  password, psychologist, seed, and push-subscription dependencies.
- Added a MySQL authentication domain service for pending student
  registration, locked OTP verification, OTP issuance, and password login.
- Added atomic OTP consumption helpers to the MySQL user repository.
- Preserved dummy-hash password comparisons and enumeration-resistant errors.

Cutover implementation:

- Authentication routes use the MySQL middleware and controllers exclusively
  and issue UUID JWT subjects.
- Student registration remains pending until OTP verification; OTP
  consumption and student creation are transactional.
- Admin seeding, psychologist management, expert listings, password login,
  password reset/change, and push-subscription storage use MySQL.

## Phase 4: Emergency matching and sessions

Migrate:

- Active student emergency lookup.
- Request creation, cancellation, timeout, and history.
- Psychologist queue ordering.
- Atomic request acceptance.
- Session creation and participant authorization.
- Session history and feedback.
- Safety escalation and audit records.
- Socket authentication, online state, presence, and reconnect handling.
- Voice/video ICE configuration authorization.

Critical request-acceptance transaction:

1. Lock the pending emergency row with `SELECT ... FOR UPDATE`.
2. Verify it is pending and not expired.
3. Verify the psychologist is active, verified, and available.
4. Change the request to matched.
5. Create exactly one session.
6. Create required persistent notifications.
7. Commit.
8. Emit Socket.IO events only after commit.

Timeout workers must update only rows still marked `pending`. Multiple backend
instances must not expire or match the same request twice.

### Phase 4 acceptance gate

- Two psychologists cannot accept the same request.
- A student cannot create two live requests from separate tabs.
- Failed session creation rolls the entire match transaction back.
- Unauthorized users cannot read or join another session.
- Chat, voice signaling, video signaling, participant reconnect, ending, and
  feedback work without API-contract changes.
- Emergency timeout recovery works after a backend restart.

## Phase 5: Assessments and administration

Migrate:

- Weekly eligibility lookup and lock.
- Assessment submission and scoring.
- Safety-alert audit creation.
- Student assessment history.
- Admin assessment listing and band distribution.
- Admin student and psychologist directories.
- Session metadata reporting.
- Safety reports and resolution.
- Operational metrics and seven-day analytics.

Assessment submission must atomically:

1. Lock the student's eligibility state.
2. Confirm the assessment is eligible.
3. Insert the answers and calculated score.
4. Update the next eligible timestamp.
5. Create a safety audit record when required.
6. Create notifications.
7. Commit.

Admin analytics will use explicit SQL aggregates and joins. Query plans must be
checked with `EXPLAIN` for emergency queue, student search, assessment history,
notification inbox, and reporting queries.

### Phase 5 acceptance gate

- Concurrent submissions produce only one weekly assessment.
- Score, band, and safety-flag behavior matches the MongoDB implementation.
- Admin reports never expose session messages or assessment answers.
- Dashboard metrics match controlled fixture data.

## Phase 6: Notifications, scheduler, and delivery

Migrate:

- Persistent notification creation and recipient deduplication.
- Notification list cursor, unread count, read state, and acknowledgement.
- Preferences and push subscriptions.
- Web Push delivery and invalid-subscription removal.
- Weekly assessment reminder scheduler.
- Emergency, session, account, and administrator notifications.

Cursor pagination will use `created_at` plus `notification_uuid`, not MongoDB
ObjectId ordering.

Notification creation that belongs to a business operation must use the same
MySQL transaction as that operation. Socket.IO, push, and email delivery occur
only after commit.

Scheduled jobs must use a MySQL lease or equivalent distributed lock and
deduplication keys so Render scaling cannot send duplicate reminders.

### Phase 6 acceptance gate

- Notifications survive page refresh and backend restart.
- Cross-user access is impossible.
- Duplicate events do not create duplicate notifications.
- Invalid push subscriptions are removed.
- Critical acknowledgement works with admin report resolution.
- Repeated scheduler execution remains idempotent.

## Phase 7: MongoDB-to-MySQL data migration

Create a one-time migration tool outside the production request path:

```text
backend/src/migration/mongo-to-mysql.ts
backend/src/migration/validators.ts
backend/src/migration/report.ts
```

Migration sequence:

1. Departments.
2. Users and role profiles.
3. Psychologist specializations.
4. Valid pending registrations only.
5. Valid push subscriptions.
6. Emergency requests.
7. Sessions.
8. Assessments.
9. Audit logs.
10. Notification preferences and notifications.

Use `legacy_mongo_id_map` to map every Mongo ObjectId to the new table and
MySQL identifier. Migration batches must be resumable and idempotent.

Do not migrate:

- Expired OTPs.
- Expired pending registrations.
- Invalid push subscriptions.
- Transient chat messages.
- Data excluded by the approved retention policy.

Migration validation report:

- Counts per role and table.
- Counts per emergency status and session mode.
- Assessment distribution.
- Unresolved audit-report count.
- Notification unread count per role.
- Missing relationship count, which must equal zero.
- Duplicate email and roll-number count, which must equal zero.
- Source-to-target mapping failures, which must equal zero.

### Phase 7 acceptance gate

- The migration can run twice without duplicates.
- A failed batch can resume safely.
- All validation totals match approved expectations.
- No secrets or sensitive assessment answers appear in migration logs.

## Phase 8: Full application verification

Automated verification:

- Unit tests for repositories and domain services.
- MySQL integration tests for every transaction and constraint.
- API tests for authentication, emergency, sessions, assessments, admin, and
  notifications.
- Socket tests for matching, chat, signaling, disconnect, and reconnect.
- End-to-end tests for student, psychologist, and admin flows.
- Production frontend build and backend build.

Manual verification:

- Student registration, OTP, login, reset, and profile.
- Psychologist login, availability, queue, session, and history.
- Admin psychologist verification, reports, analytics, and assessment review.
- Emergency chat, voice, and video from separate devices/networks.
- Notification bell, push delivery, acknowledgement, and preferences.
- PWA navigation and refresh on protected routes.

Performance gates:

- Emergency queue query uses its composite index.
- Request acceptance transaction completes within the service target.
- Notification inbox uses cursor pagination and its inbox index.
- Admin analytics does not perform N+1 queries.
- Connection pool remains below configured limits under load.

## Phases 4–8 execution checkpoint — 2026-09-02

Completed implementation:

- MySQL-backed emergency creation, cancellation, timeout recovery, queueing,
  row-locked acceptance, session creation, participant authorization,
  feedback, escalation, history, and ICE configuration.
- MySQL-backed Socket.IO authentication, presence, matching, chat relay,
  WebRTC voice/video signaling relay, reconnect notifications, and session
  ending.
- MySQL-backed weekly assessments, scoring triggers, eligibility enforcement,
  admin assessment views, directories, reports, metrics, and analytics.
- MySQL-backed notification inbox, preferences, acknowledgement, Web Push
  subscriptions, deduplication, and a distributed scheduler lease.
- The completed one-time migration and reconciliation tooling is preserved on
  the protected Mongo backup branch and is not shipped in the production path.
- A reusable disposable runtime suite: `mysql:smoke-runtime`.

Live migration evidence:

- Migrated 13/13 users, 39/39 emergency requests, 33/33 sessions, 3/3
  assessments, 14/14 source notifications, 11/11 audit logs, and 3/3
  notification preferences with zero migration issues.
- Deterministic legacy mappings reconcile exactly and both orphan counts are
  zero.
- One additional `assessment.eligible` notification was legitimately created
  by the active MySQL scheduler after migration.
- The one invalid historical test roll number is preserved behind
  `legacy_imported=TRUE`; all new registrations remain subject to the strict
  GBU roll-number constraint.

Automated verification evidence:

- Backend: 28 unit/contract tests passed.
- Live Aiven repository integration: 4/4 rollback-safe tests passed.
- Disposable MySQL HTTP smoke coverage passed for auth, student,
  psychologist, sessions, feedback, and assessment endpoints.
- Disposable Socket.IO coverage passed for emergency matching, chat relay,
  WebRTC signaling relay, and session-end persistence.
- Frontend: 6/6 tests passed, TypeScript passed, and the Vite production build
  completed successfully.
- Backend TypeScript production build passed.

Final local cutover checkpoint — 2026-09-02:

- The backend is MySQL-only and requires `DATABASE_URL` at startup.
- Mongoose models, Mongo controllers/services, Mongo startup/shutdown code,
  migration-only scripts, and the `mongoose` dependency were removed.
- The live Aiven integrity check found 16 tables, zero orphan profiles or
  sessions, and zero duplicate emails or roll numbers.
- The live repository integration suite passed 4/4 and rolled fixtures back.
- The disposable runtime suite again passed HTTP auth/domain flows, emergency
  matching, chat, signaling relay, session end, feedback, and assessment.
- Backend tests/build and frontend tests/typecheck/build pass.
- Hosted deployment, external-device media/push verification, provider backup
  confirmation, and rollback rehearsal remain operator-controlled gates; use
  `docs/MYSQL_PRODUCTION_CUTOVER.md`.

## Phase 9: Production cutover and rollback

Pre-cutover:

1. Create and verify a MongoDB backup.
2. Create and verify a MySQL backup.
3. Deploy the MySQL-capable backend to staging.
4. Run a full migration rehearsal.
5. Record migration duration and validation totals.
6. Announce a maintenance window.

Cutover:

1. Enable maintenance mode for writes.
2. Stop MongoDB-changing workers.
3. Take the final MongoDB backup.
4. Run the final idempotent migration.
5. Run all validation gates.
6. Deploy the MySQL-only backend environment.
7. Run smoke tests for all three roles.
8. Re-enable traffic.
9. Monitor errors, pool usage, matching, notifications, SMTP, and TURN.

Rollback:

- Stop MySQL writes.
- Restore the previous environment variables and deployment.
- Switch code to `codex/mongodb-backup-2026-09-01` if necessary.
- Reconcile any MySQL-only writes before reopening MongoDB writes.
- Do not run both databases as independent writable sources of truth.

Keep MongoDB read-only for the approved rollback period. Remove it only after
the University approves the MySQL production result and backup process.

## Removal phase

Only after every acceptance gate passes:

- [x] Remove Mongoose models.
- [x] Remove the `mongoose` dependency.
- [x] Remove `MONGODB_URI` from active configuration.
- [x] Remove MongoDB startup and shutdown code.
- [x] Replace the MongoDB seed script.
- [x] Remove Mongo-specific ObjectId handling and cursor logic.
- [x] Keep the backup branch and migration audit report.

## Final definition of done

The MySQL migration is complete only when:

- All application data is stored in MySQL.
- No runtime file imports Mongoose.
- All critical workflows use verified MySQL transactions.
- HTTP and Socket.IO contracts remain compatible with the frontend.
- All automated and manual acceptance tests pass.
- Production monitoring and backups are configured.
- Migration reconciliation reports show no unexplained differences.
- Rollback has been rehearsed.
- MongoDB is no longer required for application startup.

## Execution order I will follow

```text
Schema and pool
  -> typed repositories
  -> authentication and users
  -> emergency and sessions
  -> assessments and administration
  -> notifications and scheduler
  -> data migration tool
  -> full verification
  -> staged production cutover
  -> Mongoose removal
```

No later phase starts until the acceptance gate for the current phase passes.
