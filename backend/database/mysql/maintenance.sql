-- Optional MySQL event replacing MongoDB's TTL index for pending registrations.
-- The database user needs the EVENT privilege, and event_scheduler must be ON.

SET time_zone = '+00:00';

CREATE EVENT IF NOT EXISTS purge_expired_pending_student_registrations
  ON SCHEDULE EVERY 5 MINUTE
  STARTS CURRENT_TIMESTAMP + INTERVAL 5 MINUTE
  ON COMPLETION PRESERVE
  ENABLE
  DO
    DELETE FROM pending_student_registrations
    WHERE expires_at <= UTC_TIMESTAMP(3);
