import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import App from "./App";
import { initializeSeo } from "./components/seo/SeoManager";
import { InstallAppButton } from "./components/pwa/InstallAppButton";
import "./styles.css";
import "./form-controls.css";
import "./redesign.css";
import "./dashboard-mobile.css";
import "./student-portal.css";
import "./student-profile-magic.css";
import "./global-nav.css";
import "./admin-session.css";
import "./psychologist-portal.css";
import "./psychologist-theme.css";
import "./home-rebuild.css";
import "./about-rebuild.css";
import "./about-magic.css";
import "./vice-chancellor-message.css";
import "./leadership-layout.css";
import "./emergency-workflow.css";
import "./emergency-production.css";
import "./emergency-confirmation.css";
import "./experts-directory.css";
import "./expert-admin.css";
import "./auth-experience.css";
import "./auth-password.css";
import "./auth-redesign.css";
import "./registration.css";
import "./footer-system.css";
import "./role-session.css";
import "./call-production.css";
import "./pwa.css";
import "./assessment.css";
import "./assessment-magic.css";
import "./assessment-redesign.css";
import "./react-bits-text.css";
import "./student-dashboard-magic.css";
import "./assessment-admin.css";
import "./dashboard-shell.css";
import "./mobile-navigation-fix.css";

initializeSeo();
if ("serviceWorker" in navigator) window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <InstallAppButton />
  </StrictMode>,
);
