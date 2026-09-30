import type { ColumnType, Generated, JSONColumnType } from "kysely";

type DbId = string;
type DbBoolean = ColumnType<boolean, boolean | number | undefined, boolean | number>;
type Timestamp = ColumnType<Date, Date | string, Date | string>;
type GeneratedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;

export interface DepartmentsTable {
  id: Generated<number>;
  code: string;
  name: string;
  is_active: DbBoolean;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface UsersTable {
  id: Generated<DbId>;
  user_uuid: string;
  role: "student" | "psychologist" | "admin";
  full_name: string | null;
  email: string;
  password_hash: string | null;
  otp_hash: string | null;
  otp_expires_at: NullableTimestamp;
  otp_attempts: number;
  verified: DbBoolean;
  is_active: DbBoolean;
  must_change_password: DbBoolean;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface StudentProfilesTable {
  user_id: DbId;
  roll_number: string;
  mobile_number: string;
  department_id: number;
  assessment_next_eligible_at: NullableTimestamp;
  legacy_imported: DbBoolean;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface PsychologistProfilesTable {
  user_id: DbId;
  professional_title: string;
  expert_category: "senior" | "consultant" | "trainee";
  portrait_url: string | null;
  is_online: DbBoolean;
  is_available: DbBoolean;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface PsychologistSpecializationsTable {
  psychologist_id: DbId;
  specialization: string;
  position: number;
  created_at: GeneratedTimestamp;
}

export interface PendingStudentRegistrationsTable {
  id: Generated<DbId>;
  registration_uuid: string;
  full_name: string;
  roll_number: string;
  email: string;
  mobile_number: string;
  department_id: number;
  password_hash: string;
  otp_hash: string;
  otp_expires_at: Timestamp;
  otp_attempts: number;
  expires_at: Timestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

export interface PushSubscriptionsTable {
  id: Generated<DbId>;
  user_id: DbId;
  subscription: JSONColumnType<PushSubscriptionPayload>;
  endpoint_hash: Uint8Array;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface NotificationPreferencesTable {
  user_id: DbId;
  in_app_enabled: DbBoolean;
  push_enabled: DbBoolean;
  email_enabled: DbBoolean;
  assessment_reminders: DbBoolean;
  wellbeing_reminders: DbBoolean;
  maintenance_notices: DbBoolean;
  quiet_hours_enabled: DbBoolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

type NotificationChannel = "in_app" | "socket" | "push" | "email";

export interface NotificationsTable {
  id: Generated<DbId>;
  notification_uuid: string;
  recipient_id: DbId;
  recipient_role: "student" | "psychologist" | "admin";
  event_type: string;
  title: string;
  message: string;
  priority: "critical" | "high" | "normal" | "low";
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  channels: JSONColumnType<NotificationChannel[]>;
  deduplication_key: string;
  read_at: NullableTimestamp;
  acknowledged_at: NullableTimestamp;
  scheduled_at: NullableTimestamp;
  delivered_at: NullableTimestamp;
  expires_at: NullableTimestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface NotificationDeliveryAttemptsTable {
  id: Generated<DbId>;
  notification_id: DbId;
  channel: NotificationChannel;
  status: "pending" | "sent" | "failed" | "expired";
  attempted_at: GeneratedTimestamp;
  provider_message_id: string | null;
  failure_code: string | null;
  retry_count: number;
  created_at: GeneratedTimestamp;
}

export interface EmergencyRequestsTable {
  id: Generated<DbId>;
  request_uuid: string;
  student_id: DbId;
  anon_id: string;
  mode: "chat" | "voice" | "video";
  status: "pending" | "matched" | "timeout" | "cancelled" | "ended";
  mood: "Anxious" | "Depressed" | "Overwhelmed" | "Angry" | "Confused" | "Just need to talk" | null;
  urgent: DbBoolean;
  psychologist_id: DbId | null;
  matched_at: NullableTimestamp;
  timeout_at: Timestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
  live_student_id: Generated<DbId | null>;
}

export interface SessionsTable {
  id: Generated<DbId>;
  session_uuid: string;
  request_id: DbId;
  mode: "chat" | "voice" | "video";
  student_id: DbId;
  psychologist_id: DbId;
  started_at: GeneratedTimestamp;
  ended_at: NullableTimestamp;
  rating: number | null;
  feedback_text: string | null;
  feedback_submitted_at: NullableTimestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface AssessmentsTable {
  id: Generated<DbId>;
  assessment_uuid: string;
  student_id: DbId;
  answers: JSONColumnType<boolean[]>;
  score: number;
  band: "low" | "moderate" | "high" | "urgent";
  safety_flag: DbBoolean;
  completed_at: GeneratedTimestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface AuditLogsTable {
  id: Generated<DbId>;
  audit_uuid: string;
  action: string;
  actor_id: DbId | null;
  actor_role: "student" | "psychologist" | "admin" | null;
  target_type: string | null;
  target_id: string | null;
  metadata: JSONColumnType<Record<string, unknown> | null, string | null, string | null>;
  resolved: DbBoolean;
  resolved_at: NullableTimestamp;
  resolved_by: DbId | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface SchedulerLeasesTable {
  lease_name: string;
  owner_uuid: string;
  acquired_at: Timestamp;
  heartbeat_at: Timestamp;
  expires_at: Timestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface LegacyMongoIdMapTable {
  entity_type: string;
  mongo_id: string;
  mysql_id: DbId;
  migrated_at: GeneratedTimestamp;
}

export interface Database {
  departments: DepartmentsTable;
  users: UsersTable;
  student_profiles: StudentProfilesTable;
  psychologist_profiles: PsychologistProfilesTable;
  psychologist_specializations: PsychologistSpecializationsTable;
  pending_student_registrations: PendingStudentRegistrationsTable;
  push_subscriptions: PushSubscriptionsTable;
  notification_preferences: NotificationPreferencesTable;
  notifications: NotificationsTable;
  notification_delivery_attempts: NotificationDeliveryAttemptsTable;
  emergency_requests: EmergencyRequestsTable;
  sessions: SessionsTable;
  assessments: AssessmentsTable;
  audit_logs: AuditLogsTable;
  scheduler_leases: SchedulerLeasesTable;
  legacy_mongo_id_map: LegacyMongoIdMapTable;
}
