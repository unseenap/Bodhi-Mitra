# Bodhi-Mitra Architecture

## Boundaries

- `frontend`: React client. It renders only role-safe API and socket payloads.
- `backend`: Express, Socket.io, authentication, matching, identity shielding, metrics, and persistence.
- `shared`: schemas, event names, and public data contracts used by both applications.

The backend is the privacy boundary. Student identity is never included in a psychologist DTO or socket event. Admin metrics are aggregation-only and contain no session content or student identity.

## Emergency lifecycle

`pending -> matched -> ended`, `pending -> timeout`, or `pending -> cancelled`.

Acceptance uses one MongoDB `findOneAndUpdate` whose filter includes `status: pending` and a future timeout. Only one concurrent caller can receive the updated document. The session is created only for that caller.

## Content retention

Chat is relayed through a private Socket.io room and is not written to MongoDB. WebRTC media is peer-to-peer where possible. The database stores only request and session metadata. This conservative default must be reviewed with the university before production.

## Required production infrastructure

- MongoDB replica set with backups and encryption at rest
- SMTP or transactional email provider
- HTTPS and secure reverse proxy
- VAPID keys for browser push
- STUN plus authenticated TURN service for reliable voice and video
- Centralized metadata-only logs and alerting

## Confirmed university rules

- Campus crisis hotline: `+91 1212121212`.
- Roll numbers contain exactly three digits, three letters, and three digits.
- Students select one of the eight configured university schools during registration.
- Admins verify qualifications before creating and activating psychologist accounts.
- Psychologists have a professional title plus an extensible specialization list.

The legal retention policy is still pending. Until it is approved, chat remains ephemeral and only session metadata is stored.
