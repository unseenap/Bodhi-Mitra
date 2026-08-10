-- Bodhi-Mitra production schema for MySQL 8.0.17+
-- Version: 2
-- Store all DATETIME values in UTC.
-- Chat message bodies remain transient until a legal retention policy exists.

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET time_zone = '+00:00';

-- Create/select the database through the managed provider. For a local server:
-- CREATE DATABASE bodhi_mitra CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
-- USE bodhi_mitra;

CREATE TABLE IF NOT EXISTS departments (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(12) NOT NULL,
  name VARCHAR(160) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (code),
  UNIQUE KEY uq_departments_name (name)
) ENGINE = InnoDB;

INSERT IGNORE INTO departments (code, name) VALUES
  ('SoM', 'School of Management'),
  ('SoBT', 'School of Biotechnology'),
  ('SoICT', 'School of Information & Communication Technology'),
  ('SoE', 'School of Engineering'),
  ('SoHSS', 'School of Humanities & Social Sciences'),
  ('SoVSAS', 'School of Vocational Studies & Applied Sciences'),
  ('SoLJG', 'School of Law, Justice & Governance'),
  ('SoBSC', 'School of Buddhist Studies & Civilization');

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role VARCHAR(20) NOT NULL,
  full_name VARCHAR(160) NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NULL,
  otp_hash VARCHAR(255) NULL,
  otp_expires_at DATETIME(3) NULL,
  otp_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_uuid (user_uuid),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_id_role (id, role),
  KEY ix_users_role_state (role, verified, is_active),
  CONSTRAINT chk_users_uuid CHECK (
    user_uuid REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT chk_users_role CHECK (role IN ('student', 'psychologist', 'admin')),
  CONSTRAINT chk_users_name CHECK (role = 'admin' OR full_name IS NOT NULL),
  CONSTRAINT chk_users_password CHECK (verified = FALSE OR password_hash IS NOT NULL),
  CONSTRAINT chk_users_otp_attempts CHECK (otp_attempts <= 5),
  CONSTRAINT chk_users_otp_pair CHECK (
    (otp_hash IS NULL AND otp_expires_at IS NULL)
    OR (otp_hash IS NOT NULL AND otp_expires_at IS NOT NULL)
  )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  roll_number CHAR(9) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  department_id SMALLINT UNSIGNED NOT NULL,
  assessment_next_eligible_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_student_profiles_roll_number (roll_number),
  KEY ix_student_profiles_department (department_id),
  KEY ix_student_profiles_assessment_eligibility (assessment_next_eligible_at),
  CONSTRAINT fk_student_profiles_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_student_profiles_department FOREIGN KEY (department_id)
    REFERENCES departments (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_student_roll_number CHECK (
    roll_number REGEXP '^[0-9]{3}U(CM|CS|CD|BT)[0-9]{3}$'
  ),
  CONSTRAINT chk_student_mobile CHECK (
    mobile_number REGEXP '^[+]91[6-9][0-9]{9}$'
  )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS psychologist_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  professional_title VARCHAR(180) NOT NULL,
  expert_category VARCHAR(20) NOT NULL DEFAULT 'consultant',
  portrait_url VARCHAR(2048) NULL,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  KEY ix_psychologist_profiles_directory (expert_category, is_available),
  KEY ix_psychologist_profiles_live (is_online, is_available),
  CONSTRAINT fk_psychologist_profiles_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_psychologist_category CHECK (
    expert_category IN ('senior', 'consultant', 'trainee')
  )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS psychologist_specializations (
  psychologist_id BIGINT UNSIGNED NOT NULL,
  specialization VARCHAR(160) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (psychologist_id, specialization),
  KEY ix_psychologist_specializations_name (specialization),
  CONSTRAINT fk_psychologist_specializations_profile
    FOREIGN KEY (psychologist_id) REFERENCES psychologist_profiles (user_id)
    ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS pending_student_registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  registration_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  roll_number CHAR(9) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email VARCHAR(254) NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  department_id SMALLINT UNSIGNED NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  otp_expires_at DATETIME(3) NOT NULL,
  otp_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_pending_student_uuid (registration_uuid),
  UNIQUE KEY uq_pending_student_email (email),
  UNIQUE KEY uq_pending_student_roll_number (roll_number),
  KEY ix_pending_student_expiration (expires_at),
  CONSTRAINT fk_pending_student_department FOREIGN KEY (department_id)
    REFERENCES departments (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_pending_student_uuid CHECK (
    registration_uuid REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT chk_pending_student_roll_number CHECK (
    roll_number REGEXP '^[0-9]{3}U(CM|CS|CD|BT)[0-9]{3}$'
  ),
  CONSTRAINT chk_pending_student_mobile CHECK (
    mobile_number REGEXP '^[+]91[6-9][0-9]{9}$'
  ),
  CONSTRAINT chk_pending_student_otp_attempts CHECK (otp_attempts <= 5),
  CONSTRAINT chk_pending_student_expiration CHECK (
    expires_at >= created_at AND otp_expires_at <= expires_at
  )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  subscription JSON NOT NULL,
  endpoint_hash BINARY(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_subscription_endpoint (user_id, endpoint_hash),
  CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT chk_push_subscription CHECK (
    JSON_SCHEMA_VALID(
      '{"type":"object","required":["endpoint","keys"],"properties":{"endpoint":{"type":"string","minLength":1},"keys":{"type":"object","required":["p256dh","auth"],"properties":{"p256dh":{"type":"string","minLength":1},"auth":{"type":"string","minLength":1}}}},"additionalProperties":true}',
      subscription
    )
  ),
  CONSTRAINT chk_push_endpoint_hash CHECK (
    endpoint_hash = UNHEX(
      SHA2(JSON_UNQUOTE(JSON_EXTRACT(subscription, '$.endpoint')), 256)
    )
  )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS emergency_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  anon_id VARCHAR(40) NOT NULL,
  mode VARCHAR(10) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  mood VARCHAR(32) NULL,
  urgent BOOLEAN NOT NULL DEFAULT FALSE,
  psychologist_id BIGINT UNSIGNED NULL,
  matched_at DATETIME(3) NULL,
  timeout_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  live_student_id BIGINT UNSIGNED GENERATED ALWAYS AS (
    CASE WHEN status IN ('pending', 'matched') THEN student_id ELSE NULL END
  ) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emergency_requests_uuid (request_uuid),
  UNIQUE KEY uq_one_live_emergency_per_student (live_student_id),
  KEY ix_emergency_queue (status, urgent, created_at),
  KEY ix_emergency_timeout (status, timeout_at),
  KEY ix_emergency_student_history (student_id, created_at),
  KEY ix_emergency_psychologist_history (psychologist_id, matched_at),
  CONSTRAINT fk_emergency_student FOREIGN KEY (student_id)
    REFERENCES student_profiles (user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_emergency_psychologist FOREIGN KEY (psychologist_id)
    REFERENCES psychologist_profiles (user_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_emergency_uuid CHECK (
    request_uuid REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT chk_emergency_mode CHECK (mode IN ('chat', 'voice', 'video')),
  CONSTRAINT chk_emergency_status CHECK (
    status IN ('pending', 'matched', 'timeout', 'cancelled', 'ended')
  ),
  CONSTRAINT chk_emergency_mood CHECK (
    mood IS NULL OR mood IN (
      'Anxious', 'Depressed', 'Overwhelmed', 'Angry',
      'Confused', 'Just need to talk'
    )
  ),
  CONSTRAINT chk_emergency_times CHECK (
    timeout_at >= created_at AND (matched_at IS NULL OR matched_at >= created_at)
  )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_id BIGINT UNSIGNED NOT NULL,
  mode VARCHAR(10) NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  psychologist_id BIGINT UNSIGNED NOT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at DATETIME(3) NULL,
  rating TINYINT UNSIGNED NULL,
  feedback_text VARCHAR(1000) NULL,
  feedback_submitted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_uuid (session_uuid),
  UNIQUE KEY uq_sessions_request (request_id),
  KEY ix_sessions_student_active (student_id, ended_at),
  KEY ix_sessions_student_history (student_id, started_at),
  KEY ix_sessions_psychologist_history (psychologist_id, started_at),
  CONSTRAINT fk_sessions_request FOREIGN KEY (request_id)
    REFERENCES emergency_requests (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_sessions_student FOREIGN KEY (student_id)
    REFERENCES student_profiles (user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_sessions_psychologist FOREIGN KEY (psychologist_id)
    REFERENCES psychologist_profiles (user_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_sessions_uuid CHECK (
    session_uuid REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT chk_sessions_mode CHECK (mode IN ('chat', 'voice', 'video')),
  CONSTRAINT chk_sessions_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  CONSTRAINT chk_sessions_times CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT chk_sessions_feedback CHECK (
    (feedback_submitted_at IS NULL AND rating IS NULL AND feedback_text IS NULL)
    OR (feedback_submitted_at IS NOT NULL AND ended_at IS NOT NULL AND rating IS NOT NULL)
  )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS assessments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assessment_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  answers JSON NOT NULL,
  score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  band VARCHAR(12) NOT NULL DEFAULT 'low',
  safety_flag BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_assessments_uuid (assessment_uuid),
  KEY ix_assessments_student_history (student_id, completed_at),
  KEY ix_assessments_admin_review (safety_flag, band, completed_at),
  CONSTRAINT fk_assessments_student FOREIGN KEY (student_id)
    REFERENCES student_profiles (user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_assessments_uuid CHECK (
    assessment_uuid REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT chk_assessments_answers CHECK (
    JSON_SCHEMA_VALID(
      '{"type":"array","minItems":20,"maxItems":20,"items":{"type":"boolean"}}',
      answers
    )
  ),
  CONSTRAINT chk_assessments_score CHECK (score BETWEEN 0 AND 20),
  CONSTRAINT chk_assessments_band CHECK (
    band IN ('low', 'moderate', 'high', 'urgent')
  )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  audit_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  action VARCHAR(120) NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  actor_role VARCHAR(20) NULL,
  target_type VARCHAR(80) NULL,
  target_id VARCHAR(64) NULL,
  metadata JSON NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at DATETIME(3) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_audit_logs_uuid (audit_uuid),
  KEY ix_audit_action_created (action, created_at),
  KEY ix_audit_reports (resolved, action, created_at),
  KEY ix_audit_actor (actor_id, created_at),
  KEY ix_audit_target (target_type, target_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id)
    REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT fk_audit_resolver FOREIGN KEY (resolved_by)
    REFERENCES users (id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_audit_uuid CHECK (
    audit_uuid REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT chk_audit_actor_role CHECK (
    actor_role IS NULL OR actor_role IN ('student', 'psychologist', 'admin')
  ),
  CONSTRAINT chk_audit_resolution CHECK (
    (resolved = FALSE AND resolved_at IS NULL)
    OR (resolved = TRUE AND resolved_at IS NOT NULL)
  )
) ENGINE = InnoDB;

-- Temporary mapping used by the MongoDB-to-MySQL import process. It can be
-- archived after migration verification and is not used by application code.
CREATE TABLE IF NOT EXISTS legacy_mongo_id_map (
  entity_type VARCHAR(40) NOT NULL,
  mongo_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mysql_id BIGINT UNSIGNED NOT NULL,
  migrated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (entity_type, mongo_id),
  UNIQUE KEY uq_legacy_mysql_entity (entity_type, mysql_id),
  CONSTRAINT chk_legacy_mongo_id CHECK (mongo_id REGEXP '^[0-9a-f]{24}$')
) ENGINE = InnoDB;

-- The server computes assessment fields so clients cannot provide a false
-- score, safety flag, or band. Question 15 is array index 14.
DELIMITER $$

DROP TRIGGER IF EXISTS trg_users_before_update$$
CREATE TRIGGER trg_users_before_update
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  IF NEW.role <> OLD.role THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A user role is immutable';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_student_profiles_before_insert$$
CREATE TRIGGER trg_student_profiles_before_insert
BEFORE INSERT ON student_profiles
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'student'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student profile requires a student user';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_student_profiles_before_update$$
CREATE TRIGGER trg_student_profiles_before_update
BEFORE UPDATE ON student_profiles
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'student'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student profile requires a student user';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_psychologist_profiles_before_insert$$
CREATE TRIGGER trg_psychologist_profiles_before_insert
BEFORE INSERT ON psychologist_profiles
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'psychologist'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Psychologist profile requires a psychologist user';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_psychologist_profiles_before_update$$
CREATE TRIGGER trg_psychologist_profiles_before_update
BEFORE UPDATE ON psychologist_profiles
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'psychologist'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Psychologist profile requires a psychologist user';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_emergency_requests_before_insert$$
CREATE TRIGGER trg_emergency_requests_before_insert
BEFORE INSERT ON emergency_requests
FOR EACH ROW
BEGIN
  IF NOT (
    (NEW.status = 'pending' AND NEW.psychologist_id IS NULL AND NEW.matched_at IS NULL)
    OR (NEW.status IN ('matched', 'ended') AND NEW.psychologist_id IS NOT NULL AND NEW.matched_at IS NOT NULL)
    OR (NEW.status IN ('timeout', 'cancelled') AND NEW.psychologist_id IS NULL AND NEW.matched_at IS NULL)
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Emergency request status and allocation are inconsistent';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_emergency_requests_before_update$$
CREATE TRIGGER trg_emergency_requests_before_update
BEFORE UPDATE ON emergency_requests
FOR EACH ROW
BEGIN
  IF NEW.request_uuid <> OLD.request_uuid
    OR NEW.student_id <> OLD.student_id
    OR NEW.mode <> OLD.mode THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Emergency request identity is immutable';
  END IF;

  IF NOT (
    (OLD.status = 'pending' AND NEW.status IN ('pending', 'matched', 'timeout', 'cancelled'))
    OR (OLD.status = 'matched' AND NEW.status IN ('matched', 'ended'))
    OR (OLD.status IN ('timeout', 'cancelled', 'ended') AND NEW.status = OLD.status)
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid emergency request status transition';
  END IF;

  IF OLD.status IN ('matched', 'ended')
    AND NOT (NEW.psychologist_id <=> OLD.psychologist_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Allocated psychologist is immutable';
  END IF;

  IF NOT (
    (NEW.status = 'pending' AND NEW.psychologist_id IS NULL AND NEW.matched_at IS NULL)
    OR (NEW.status IN ('matched', 'ended') AND NEW.psychologist_id IS NOT NULL AND NEW.matched_at IS NOT NULL)
    OR (NEW.status IN ('timeout', 'cancelled') AND NEW.psychologist_id IS NULL AND NEW.matched_at IS NULL)
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Emergency request status and allocation are inconsistent';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_sessions_before_insert$$
CREATE TRIGGER trg_sessions_before_insert
BEFORE INSERT ON sessions
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM emergency_requests AS emergency
    WHERE emergency.id = NEW.request_id
      AND emergency.student_id = NEW.student_id
      AND emergency.psychologist_id = NEW.psychologist_id
      AND emergency.mode = NEW.mode
      AND emergency.status = 'matched'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Session does not match an allocated emergency request';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_sessions_before_update$$
CREATE TRIGGER trg_sessions_before_update
BEFORE UPDATE ON sessions
FOR EACH ROW
BEGIN
  IF NEW.session_uuid <> OLD.session_uuid
    OR NEW.request_id <> OLD.request_id
    OR NEW.student_id <> OLD.student_id
    OR NEW.psychologist_id <> OLD.psychologist_id
    OR NEW.mode <> OLD.mode THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Session identity and participants are immutable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM emergency_requests AS emergency
    WHERE emergency.id = NEW.request_id
      AND emergency.student_id = NEW.student_id
      AND emergency.psychologist_id = NEW.psychologist_id
      AND emergency.mode = NEW.mode
      AND emergency.status IN ('matched', 'ended')
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Session does not match an allocated emergency request';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_assessments_before_insert$$
CREATE TRIGGER trg_assessments_before_insert
BEFORE INSERT ON assessments
FOR EACH ROW
BEGIN
  DECLARE calculated_score TINYINT UNSIGNED DEFAULT 0;
  DECLARE calculated_safety BOOLEAN DEFAULT FALSE;

  UPDATE student_profiles
  SET assessment_next_eligible_at = DATE_ADD(NEW.completed_at, INTERVAL 7 DAY)
  WHERE user_id = NEW.student_id
    AND (
      assessment_next_eligible_at IS NULL
      OR assessment_next_eligible_at <= NEW.completed_at
    );

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student is not yet eligible for another assessment';
  END IF;

  SELECT COALESCE(SUM(answer_value), 0)
    INTO calculated_score
  FROM JSON_TABLE(
    NEW.answers,
    '$[*]' COLUMNS (answer_value BOOLEAN PATH '$')
  ) AS answers_table;

  SET calculated_safety = (
    JSON_UNQUOTE(JSON_EXTRACT(NEW.answers, '$[14]')) = 'true'
  );
  SET NEW.score = calculated_score;
  SET NEW.safety_flag = calculated_safety;
  SET NEW.band = CASE
    WHEN calculated_safety OR calculated_score >= 15 THEN 'urgent'
    WHEN calculated_score >= 11 THEN 'high'
    WHEN calculated_score >= 6 THEN 'moderate'
    ELSE 'low'
  END;
END$$

DROP TRIGGER IF EXISTS trg_assessments_before_update$$
CREATE TRIGGER trg_assessments_before_update
BEFORE UPDATE ON assessments
FOR EACH ROW
BEGIN
  DECLARE calculated_score TINYINT UNSIGNED DEFAULT 0;
  DECLARE calculated_safety BOOLEAN DEFAULT FALSE;

  IF NEW.assessment_uuid <> OLD.assessment_uuid
    OR NEW.student_id <> OLD.student_id
    OR NEW.completed_at <> OLD.completed_at THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Assessment identity and completion time are immutable';
  END IF;

  SELECT COALESCE(SUM(answer_value), 0)
    INTO calculated_score
  FROM JSON_TABLE(
    NEW.answers,
    '$[*]' COLUMNS (answer_value BOOLEAN PATH '$')
  ) AS answers_table;

  SET calculated_safety = (
    JSON_UNQUOTE(JSON_EXTRACT(NEW.answers, '$[14]')) = 'true'
  );
  SET NEW.score = calculated_score;
  SET NEW.safety_flag = calculated_safety;
  SET NEW.band = CASE
    WHEN calculated_safety OR calculated_score >= 15 THEN 'urgent'
    WHEN calculated_score >= 11 THEN 'high'
    WHEN calculated_score >= 6 THEN 'moderate'
    ELSE 'low'
  END;
END$$

DELIMITER ;

-- Authorization remains in the API. These views provide the same flattened
-- shape currently returned by the Mongoose User model.
CREATE OR REPLACE VIEW student_directory AS
SELECT
  u.id,
  u.user_uuid,
  u.full_name,
  u.email,
  u.verified,
  u.is_active,
  sp.roll_number,
  sp.mobile_number,
  d.code AS department_code,
  d.name AS department_name,
  CONCAT(d.name, ' (', d.code, ')') AS department,
  sp.assessment_next_eligible_at,
  u.created_at,
  u.updated_at
FROM users AS u
INNER JOIN student_profiles AS sp ON sp.user_id = u.id
INNER JOIN departments AS d ON d.id = sp.department_id
WHERE u.role = 'student';

CREATE OR REPLACE VIEW psychologist_directory AS
SELECT
  u.id,
  u.user_uuid,
  u.full_name,
  u.email,
  u.verified,
  u.is_active,
  u.must_change_password,
  pp.professional_title,
  pp.expert_category,
  pp.portrait_url,
  pp.is_online,
  pp.is_available,
  u.created_at,
  u.updated_at
FROM users AS u
INNER JOIN psychologist_profiles AS pp ON pp.user_id = u.id
WHERE u.role = 'psychologist';
