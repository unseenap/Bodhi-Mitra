import {
  BookOpen,
  CaretRight,
  ChartBar,
  ClockCounterClockwise,
  FirstAid,
  House,
  IdentificationCard,
  List,
  ShieldCheck,
  SignOut,
  Stethoscope,
  User,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { AnimatedGradientText, ShineBorder } from "../magicui/ProfileMagic";
import { TextReveal } from "../reactbits/TextReveal";
import { SessionErrorBoundary } from "../session/SessionErrorBoundary";
import { Button } from "../ui/Button";
import { GlobalFooter } from "./Footer";

type Role = "student" | "psychologist" | "admin";
type NavigationItem = {
  to: string;
  label: string;
  description: string;
  icon: typeof House;
};

const roleNavigation: Record<Role, NavigationItem[]> = {
  student: [
    { to: "/student", label: "Home", description: "Your wellbeing hub", icon: House },
    { to: "/student/assessment", label: "Assessment", description: "Monthly check-in", icon: FirstAid },
    { to: "/student/session", label: "My session", description: "Connect securely", icon: ClockCounterClockwise },
    { to: "/student/resources", label: "Resources", description: "Guides and support", icon: BookOpen },
    { to: "/student/profile", label: "My profile", description: "Personal details", icon: IdentificationCard },
  ],
  psychologist: [
    { to: "/psychologist", label: "Dashboard", description: "Queue and priorities", icon: Stethoscope },
    { to: "/psychologist/sessions", label: "Session history", description: "Past conversations", icon: ClockCounterClockwise },
    { to: "/psychologist/profile", label: "Professional profile", description: "Credentials and status", icon: IdentificationCard },
  ],
  admin: [
    { to: "/admin", label: "Command centre", description: "Platform overview", icon: ChartBar },
    { to: "/admin/psychologists", label: "Psychologists", description: "Team and verification", icon: UsersThree },
    { to: "/admin/students", label: "Students", description: "Student directory", icon: User },
    { to: "/admin/assessments", label: "Assessments", description: "Wellbeing insights", icon: FirstAid },
    { to: "/admin/sessions", label: "Sessions", description: "Service activity", icon: ClockCounterClockwise },
    { to: "/admin/reports", label: "Reports", description: "Trends and exports", icon: WarningCircle },
  ],
};

const roleContext = {
  student: { eyebrow: "Student wellbeing", title: "Student portal", status: "Private support space", welcome: "A calmer place for your next step.", icon: ShieldCheck },
  psychologist: { eyebrow: "Care delivery", title: "Psychologist portal", status: "Professional access", welcome: "Care coordination with clarity.", icon: Stethoscope },
  admin: { eyebrow: "Platform operations", title: "Admin control centre", status: "Secure administrator access", welcome: "Clear oversight for safer support.", icon: ShieldCheck },
} satisfies Record<Role, { eyebrow: string; title: string; status: string; welcome: string; icon: typeof House }>;

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLiveSession = /\/(student|psychologist)\/session\/[^/]+$/.test(location.pathname);
  const role: Role = user?.role ?? "student";
  const context = roleContext[role];
  const ContextIcon = context.icon;
  const routes = roleNavigation[role];
  const currentRoute = routes.find(({ to }) =>
    to === `/${role}` ? location.pathname === to : location.pathname.startsWith(to),
  ) ?? routes[0];

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const identityDetail =
    role === "student"
      ? user?.rollNumber ?? "GBU student"
      : role === "psychologist"
        ? "Verified mental health professional"
        : "Platform administrator";

  const content = isLiveSession ? (
    <SessionErrorBoundary><Outlet /></SessionErrorBoundary>
  ) : (
    <Outlet />
  );

  return (
    <>
      <div className={`dashboard role-dashboard role-dashboard--${role}${isLiveSession ? " dashboard--live-session" : ""}`}>
        {!isLiveSession && (
          <>
            <header className="role-mobile-header">
              <a className="role-mobile-brand" href="/" aria-label="Bodhi-Mitra home">
                <img src="/images/pschylogo.svg" alt="" />
                <span><strong>Bodhi-Mitra</strong><small>{context.title}</small></span>
              </a>
              <button
                className="role-menu-trigger"
                type="button"
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={menuOpen}
                aria-controls="role-navigation"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X /> : <List />}
              </button>
            </header>

            <button
              className={`role-nav-scrim${menuOpen ? " is-visible" : ""}`}
              aria-label="Close navigation"
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
            />

            <aside id="role-navigation" className={`role-sidebar${menuOpen ? " is-open" : ""}`}>
              <a className="role-brand" href="/">
                <img src="/images/pschylogo.svg" alt="" />
                <span><strong><AnimatedGradientText speed={1.4}>Bodhi-Mitra</AnimatedGradientText></strong><small>Gautam Buddha University</small></span>
              </a>

              <section className="role-context-card" aria-label={context.title}>
                <ShineBorder duration={18} />
                <span className="role-context-icon"><ContextIcon /></span>
                <div><small>{context.eyebrow}</small><strong><AnimatedGradientText speed={1.5}>{context.title}</AnimatedGradientText></strong></div>
              </section>

              <section className="role-identity" aria-label="Signed-in account">
                <span className="role-avatar">{user?.displayName?.trim().charAt(0).toUpperCase() || "U"}</span>
                <div><strong>{user?.displayName ?? "Bodhi-Mitra user"}</strong><small>{identityDetail}</small></div>
                <span className="role-status-dot" title="Account active" />
              </section>

              <p className="role-nav-label">Navigation</p>
              <nav aria-label={`${context.title} navigation`}>
                {routes.map(({ to, label, description, icon: Icon }) => (
                  <NavLink key={to} end={to.split("/").length === 2} to={to}>
                    <span className="role-link-effect" aria-hidden="true"><i /><i /><i /><i /></span>
                    <span className="role-link-icon"><Icon /></span>
                    <span className="role-link-copy"><strong>{label}</strong><small>{description}</small></span>
                  </NavLink>
                ))}
              </nav>

              <div className="role-sidebar-footer">
                <div className="role-access-note"><ShieldCheck /><span><strong>Protected workspace</strong><small>{context.status}</small></span></div>
                <Button variant="ghost" onClick={signOut}><SignOut /> <span>Sign out</span></Button>
              </div>
            </aside>
          </>
        )}
        <main className={isLiveSession ? "dashboard-session-shell" : "role-dashboard-content"}>
          {!isLiveSession && (
            <header className="role-topbar">
              <div className="role-topbar-heading">
                <div className="role-breadcrumb" aria-label="Current location">
                  <span>{context.title}</span><CaretRight /><strong>{currentRoute.label}</strong>
                </div>
                <TextReveal key={location.pathname} as="h1" className="role-topbar-title" text={currentRoute.label} delay={0.01} />
                <p className="role-topbar-description">{currentRoute.description} <span>{context.welcome}</span></p>
              </div>
              <div className="role-topbar-actions">
                {role === "student" && <Link className="role-urgent-link" to="/emergency"><WarningCircle /> Emergency help</Link>}
                <span className="role-security-chip"><ShieldCheck weight="fill" /> {context.status}</span>
                <div className="role-topbar-account">
                  <span className="role-topbar-avatar">{user?.displayName?.trim().charAt(0).toUpperCase() || "U"}</span>
                  <span><strong>{user?.displayName ?? "Bodhi-Mitra user"}</strong><small>{identityDetail}</small></span>
                </div>
              </div>
            </header>
          )}
          <div className={isLiveSession ? undefined : "role-page-stage"}>{content}</div>
        </main>
      </div>
      {!isLiveSession && <GlobalFooter />}
    </>
  );
}
