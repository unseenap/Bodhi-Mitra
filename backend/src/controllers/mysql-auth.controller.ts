import type { Request, Response } from "express";
import { otpRequestSchema, otpVerifySchema, passwordChangeSchema, passwordLoginSchema, passwordResetSchema, studentRegistrationSchema } from "@bodhi/shared";
import type { SafeUser as RepositoryUser } from "../repositories/repository.types.js";
import { MysqlAuthError, MysqlAuthService } from "../services/mysql-auth.service.js";
import { signToken } from "../utils/auth.js";
import { getMysqlDatabase } from "../database/client.js";

const service = new MysqlAuthService();
const apiUser = async (user: RepositoryUser) => ({
  id: user.id,
  role: user.role,
  displayName: user.fullName ?? user.email,
  ...(user.role === "student" ? await studentFields(user.id, user.email) : {}),
  mustChangePassword: user.mustChangePassword,
});
async function studentFields(userUuid: string, email: string) {
  const row = await getMysqlDatabase().selectFrom("student_profiles as p").innerJoin("users as u", "u.id", "p.user_id").innerJoin("departments as d", "d.id", "p.department_id")
    .select(["p.roll_number", "p.mobile_number", "d.name as department"]).where("u.user_uuid", "=", userUuid).executeTakeFirst();
  return { email, rollNumber: row?.roll_number, mobileNumber: row?.mobile_number, department: row?.department };
}
const respond = async (res: Response, user: RepositoryUser) =>
  res.json({ token: signToken(user.id, user.role), user: await apiUser(user) });

export async function mysqlRegisterStudent(req: Request, res: Response) {
  const result = await service.registerStudent(studentRegistrationSchema.parse(req.body));
  res.status(201).json(result);
}

export async function mysqlRequestOtp(req: Request, res: Response) {
  const { identifier } = otpRequestSchema.parse(req.body);
  await service.requestStudentOtp(identifier);
  res.json({ message: "If the account exists, a code has been emailed" });
}

export async function mysqlVerifyOtp(req: Request, res: Response) {
  const { identifier, otp } = otpVerifySchema.parse(req.body);
  try {
    return respond(res, await service.verifyPendingStudent(identifier, otp));
  } catch (error) {
    if (!(error instanceof MysqlAuthError) || error.status !== 401) throw error;
    return respond(res, await service.verifyStudentOtp(identifier, otp));
  }
}

export async function mysqlPasswordLogin(req: Request, res: Response) {
  const user = await service.passwordLogin(passwordLoginSchema.parse(req.body));
  return respond(res, user);
}

export async function mysqlRequestPasswordReset(req: Request, res: Response) {
  const { identifier } = otpRequestSchema.parse(req.body);
  await service.requestStudentOtp(identifier);
  res.json({ message: "If the account exists, a reset code has been emailed" });
}

export async function mysqlResetPassword(req: Request, res: Response) {
  const data = passwordResetSchema.parse(req.body);
  await service.resetStudentPassword(data.identifier, data.otp, data.newPassword);
  res.json({ message: "Your password has been reset. You can now sign in." });
}

export async function mysqlChangePassword(req: Request, res: Response) {
  const data = passwordChangeSchema.parse(req.body);
  return respond(res, await service.changePassword(req.auth!.id, data.currentPassword, data.newPassword));
}

export async function mysqlMe(req: Request, res: Response) {
  res.json({ user: await apiUser(await service.currentUser(req.auth!.id)) });
}
