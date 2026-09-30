export type ExpertCategory = "senior" | "consultant" | "trainee";

export interface PsychologistProfile {
  id: string;
  name: string;
  email: string;
  professionalTitle: string;
  category: ExpertCategory;
  specializations: string[];
  portraitUrl: string | null;
  verified: boolean;
  isActive: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  createdAt: Date;
}

export interface CreatePsychologistInput {
  userUuid: string;
  name: string;
  email: string;
  passwordHash: string;
  professionalTitle: string;
  category: ExpertCategory;
  specializations: string[];
  portraitUrl?: string | null;
  verified?: boolean;
  isActive?: boolean;
}

export interface PsychologistRepository {
  list(filters?: { category?: ExpertCategory; publicOnly?: boolean; limit?: number }): Promise<PsychologistProfile[]>;
  findByUuid(userUuid: string): Promise<PsychologistProfile | null>;
  create(input: CreatePsychologistInput): Promise<PsychologistProfile>;
  update(userUuid: string, input: Partial<Omit<CreatePsychologistInput, "userUuid">> & { passwordHash?: string }): Promise<PsychologistProfile | null>;
  setAvailability(userUuid: string, available: boolean): Promise<boolean>;
  setPresence(userUuid: string, online: boolean): Promise<boolean>;
}
