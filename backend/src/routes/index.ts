import { Router } from "express";
import rateLimit from "express-rate-limit";
import { checkMysqlHealth } from "../database/health.js";
import { mysqlChangePassword, mysqlMe, mysqlPasswordLogin, mysqlRegisterStudent, mysqlRequestOtp, mysqlRequestPasswordReset, mysqlResetPassword, mysqlVerifyOtp } from "../controllers/mysql-auth.controller.js";
import { requireMysqlAuth } from "../middleware/mysql-auth.js";
import { mysqlCreatePsychologist, mysqlExperts, mysqlListPsychologists, mysqlUpdatePsychologist } from "../controllers/mysql-psychologist.controller.js";
import { mysqlActiveStudentEmergency, mysqlMetrics, mysqlPsychologistProfile, mysqlPsychologistQueue, mysqlPsychologistSummary, mysqlSessionHistory, mysqlSetAvailability, mysqlStudentHistory, mysqlSubscribePush } from "../controllers/mysql-data.controller.js";
import { mysqlEscalateSession, mysqlRateSession, mysqlSessionDetails, mysqlSessionIceConfiguration } from "../controllers/mysql-session.controller.js";
import { mysqlAdminAssessments, mysqlAssessmentStatus, mysqlSubmitAssessment } from "../controllers/mysql-assessment.controller.js";
import { mysqlAdminAnalytics, mysqlAdminReports, mysqlAdminSessions, mysqlAdminStudents, mysqlResolveReport } from "../controllers/mysql-admin.controller.js";
import { mysqlAcknowledgeNotification, mysqlGetNotificationPreferences, mysqlListNotifications, mysqlMarkAllNotificationsRead, mysqlMarkNotificationRead, mysqlSubscribeNotificationPush, mysqlUnreadNotificationCount, mysqlUnsubscribeNotificationPush, mysqlUpdateNotificationPreferences } from "../controllers/mysql-notification.controller.js";

export const api = Router();
const otpLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 3, standardHeaders: true, legacyHeaders: false, message: { message: "Too many code requests. Please wait before trying again" } });
const otpVerifyLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: "Too many verification attempts. Please wait before trying again" } });
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { message: "Too many failed sign-in attempts. Please wait before trying again" } });
const notificationMutationLimit = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
const sessionActionLimit = rateLimit({ windowMs: 5 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

api.get("/health", async (_req, res) => {
  const mysql = await checkMysqlHealth(); const ready = mysql.status === "ok";
  res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "degraded", activeDatastore: "mysql", databases: { mysql } });
});

api.post("/auth/student/register", otpLimit, mysqlRegisterStudent);
api.post("/auth/student/request-otp", otpLimit, mysqlRequestOtp);
api.post("/auth/student/verify-otp", otpVerifyLimit, mysqlVerifyOtp);
api.post("/auth/student/forgot-password", otpLimit, mysqlRequestPasswordReset);
api.post("/auth/student/reset-password", otpVerifyLimit, mysqlResetPassword);
api.post("/auth/login", loginLimit, mysqlPasswordLogin);
api.get("/auth/me", requireMysqlAuth(), mysqlMe);
api.post("/auth/change-password", requireMysqlAuth(["psychologist", "admin"]), mysqlChangePassword);

api.get("/notifications", requireMysqlAuth(), mysqlListNotifications);
api.get("/notifications/unread-count", requireMysqlAuth(), mysqlUnreadNotificationCount);
api.patch("/notifications/:notificationId/read", notificationMutationLimit, requireMysqlAuth(), mysqlMarkNotificationRead);
api.patch("/notifications/:notificationId/acknowledge", notificationMutationLimit, requireMysqlAuth(), mysqlAcknowledgeNotification);
api.post("/notifications/mark-all-read", notificationMutationLimit, requireMysqlAuth(), mysqlMarkAllNotificationsRead);
api.get("/notifications/preferences", requireMysqlAuth(), mysqlGetNotificationPreferences);
api.patch("/notifications/preferences", notificationMutationLimit, requireMysqlAuth(), mysqlUpdateNotificationPreferences);
api.post("/notifications/push-subscription", notificationMutationLimit, requireMysqlAuth(), mysqlSubscribeNotificationPush);
api.delete("/notifications/push-subscription", notificationMutationLimit, requireMysqlAuth(), mysqlUnsubscribeNotificationPush);

api.get("/experts", mysqlExperts);
api.get("/student/history", requireMysqlAuth(["student"]), mysqlStudentHistory);
api.get("/student/emergency/active", requireMysqlAuth(["student"]), mysqlActiveStudentEmergency);
api.get("/student/assessment", requireMysqlAuth(["student"]), mysqlAssessmentStatus);
api.post("/student/assessment", requireMysqlAuth(["student"]), mysqlSubmitAssessment);
api.get("/psychologist/queue", requireMysqlAuth(["psychologist"]), mysqlPsychologistQueue);
api.get("/psychologist/sessions", requireMysqlAuth(["psychologist"]), mysqlSessionHistory);
api.get("/psychologist/summary", requireMysqlAuth(["psychologist"]), mysqlPsychologistSummary);
api.get("/psychologist/profile", requireMysqlAuth(["psychologist"]), mysqlPsychologistProfile);
api.patch("/psychologist/availability", requireMysqlAuth(["psychologist"]), mysqlSetAvailability);
api.post("/psychologist/push-subscription", requireMysqlAuth(["psychologist"]), mysqlSubscribePush);

api.get("/admin/psychologists", requireMysqlAuth(["admin"]), mysqlListPsychologists);
api.post("/admin/psychologists", requireMysqlAuth(["admin"]), mysqlCreatePsychologist);
api.patch("/admin/psychologists/:id", requireMysqlAuth(["admin"]), mysqlUpdatePsychologist);
api.get("/admin/metrics", requireMysqlAuth(["admin"]), mysqlMetrics);
api.get("/admin/analytics", requireMysqlAuth(["admin"]), mysqlAdminAnalytics);
api.get("/admin/students", requireMysqlAuth(["admin"]), mysqlAdminStudents);
api.get("/admin/sessions", requireMysqlAuth(["admin"]), mysqlAdminSessions);
api.get("/admin/reports", requireMysqlAuth(["admin"]), mysqlAdminReports);
api.get("/admin/assessments", requireMysqlAuth(["admin"]), mysqlAdminAssessments);
api.patch("/admin/reports/:id/resolve", requireMysqlAuth(["admin"]), mysqlResolveReport);

api.get("/sessions/:sessionId", requireMysqlAuth(["student", "psychologist"]), mysqlSessionDetails);
api.get("/sessions/:sessionId/ice-config", sessionActionLimit, requireMysqlAuth(["student", "psychologist"]), mysqlSessionIceConfiguration);
api.post("/sessions/:sessionId/rating", sessionActionLimit, requireMysqlAuth(["student"]), mysqlRateSession);
api.post("/sessions/:sessionId/escalate", sessionActionLimit, requireMysqlAuth(["student", "psychologist"]), mysqlEscalateSession);
