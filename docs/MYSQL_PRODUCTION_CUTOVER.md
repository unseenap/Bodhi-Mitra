# Bodhi-Mitra MySQL Production Cutover

This runbook is the final deployment checklist for switching the hosted backend
to the Aiven MySQL database. It intentionally contains no credentials.

## Required Render environment

Configure these as Render environment variables, never in Git:

```env
NODE_ENV=production
CLIENT_URL=https://your-frontend-host.example
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/bodhi_mitra
DATABASE_SSL=required
DATABASE_SSL_CA_BASE64=BASE64_ENCODED_CA_CERTIFICATE
JWT_SECRET=AT_LEAST_32_RANDOM_CHARACTERS
JWT_EXPIRES_IN=12h
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...
TURN_URL=turns:...
TURN_SHARED_SECRET=...
TURN_TTL_SECONDS=3600
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

`MONGODB_URI` and `DATASTORE_PROVIDER` are not runtime settings after this
cutover. Do not add them to the MySQL-only deployment.

## Before deployment

1. Confirm Aiven automatic backups are enabled and record the latest successful
   backup time.
2. Preserve the pre-cutover implementation on
   `codex/mongodb-backup-2026-09-01`.
3. Run `npm run mysql:cutover-check -w backend` from a trusted environment.
4. Run `RUN_MYSQL_INTEGRATION=1 npm test -w backend -- tests/mysql.repositories.integration.test.ts`.
5. Run backend and frontend tests and production builds.
6. Schedule a maintenance window and stop writes to the former data store.

## Deploy and verify

1. Deploy the MySQL-only backend revision to Render.
2. Open `https://YOUR_BACKEND/api/health`. It must return HTTP 200 with
   `activeDatastore: "mysql"` and MySQL status `ok`.
3. Verify login for student, psychologist, and admin roles.
4. Verify student registration and OTP confirmation with a new test account.
5. From two separate accounts, verify emergency request, psychologist
   acceptance, chat, session end, and feedback.
6. From two separate devices and networks, verify voice and video media. A
   successful signaling smoke test does not replace this TURN/media test.
7. Verify assessment submission, admin reporting, notification inbox, push
   delivery, and protected-route PWA refresh.
8. Re-run the cutover check and confirm no integrity failures.

## Monitor

For the first deployment window, watch Render and Aiven for connection errors,
pool saturation, failed OTP email, emergency timeouts, duplicate notifications,
Socket.IO disconnects, and TURN allocation failures. Logs must not contain
database URLs, passwords, OTP values, assessment answers, or message bodies.

## Rollback

If a critical gate fails, stop writes before rollback. Deploy the protected
Mongo snapshot only with its matching environment and reconcile any MySQL-only
writes before reopening the old application. Never allow both databases to act
as independent writable sources of truth.

Remove the rollback database only after the University approves production
operation and the backup/restore procedure has been tested.
