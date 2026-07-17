import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SafeUser } from "@bodhi/shared";
import { api } from "../lib/api"; import { closeSocket } from "../lib/socket";
import { clearAuthToken, getAuthToken, setAuthToken } from "../lib/authToken";
interface AuthValue { user: SafeUser | null; loading: boolean; signIn: (token: string, user: SafeUser) => void; signOut: () => void }
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) { const [user, setUser] = useState<SafeUser | null>(null); const [loading, setLoading] = useState(true); useEffect(() => { if (!getAuthToken()) { setLoading(false); return; } api<{ user: SafeUser }>("/auth/me").then(r => setUser(r.user)).catch(() => clearAuthToken()).finally(() => setLoading(false)); }, []); const signIn = (token: string, value: SafeUser) => { setAuthToken(token); setUser(value); }; const signOut = () => { clearAuthToken(); closeSocket(); setUser(null); }; return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>; }
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be inside AuthProvider"); return value; }
