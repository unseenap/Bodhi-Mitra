import type { Role } from "@bodhi/shared";
declare global { namespace Express { interface Request { auth?: { id: string; role: Role } } } }
export {};
