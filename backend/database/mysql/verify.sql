-- Read-only verification for a fresh Bodhi-Mitra MySQL installation.

SET time_zone = '+00:00';

SELECT VERSION() AS mysql_version;

SELECT COUNT(*) AS installed_tables
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'departments',
    'users',
    'student_profiles',
    'psychologist_profiles',
    'psychologist_specializations',
    'pending_student_registrations',
    'push_subscriptions',
    'emergency_requests',
    'sessions',
    'assessments',
    'audit_logs',
    'legacy_mongo_id_map'
  );

SELECT COUNT(*) AS installed_views
FROM information_schema.views
WHERE table_schema = DATABASE()
  AND table_name IN ('student_directory', 'psychologist_directory');

SELECT COUNT(*) AS installed_triggers
FROM information_schema.triggers
WHERE trigger_schema = DATABASE()
  AND trigger_name IN (
    'trg_users_before_update',
    'trg_student_profiles_before_insert',
    'trg_student_profiles_before_update',
    'trg_psychologist_profiles_before_insert',
    'trg_psychologist_profiles_before_update',
    'trg_emergency_requests_before_insert',
    'trg_emergency_requests_before_update',
    'trg_sessions_before_insert',
    'trg_sessions_before_update',
    'trg_assessments_before_insert',
    'trg_assessments_before_update'
  );

SELECT COUNT(*) AS seeded_departments FROM departments;

SELECT
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
        AND table_name IN (
          'departments', 'users', 'student_profiles',
          'psychologist_profiles', 'psychologist_specializations',
          'pending_student_registrations', 'push_subscriptions',
          'emergency_requests', 'sessions', 'assessments', 'audit_logs',
          'legacy_mongo_id_map'
        )
    ) = 12
    AND (
      SELECT COUNT(*) FROM information_schema.views
      WHERE table_schema = DATABASE()
        AND table_name IN ('student_directory', 'psychologist_directory')
    ) = 2
    AND (
      SELECT COUNT(*) FROM information_schema.triggers
      WHERE trigger_schema = DATABASE()
        AND trigger_name IN (
          'trg_users_before_update',
          'trg_student_profiles_before_insert',
          'trg_student_profiles_before_update',
          'trg_psychologist_profiles_before_insert',
          'trg_psychologist_profiles_before_update',
          'trg_emergency_requests_before_insert',
          'trg_emergency_requests_before_update',
          'trg_sessions_before_insert', 'trg_sessions_before_update',
          'trg_assessments_before_insert', 'trg_assessments_before_update'
        )
    ) = 11
    AND (SELECT COUNT(*) FROM departments) = 8
    THEN 'PASS'
    ELSE 'FAIL'
  END AS installation_status;
