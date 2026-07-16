import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import App from "./App";
import "./styles.css";
import "./form-controls.css";
import "./redesign.css";
import "./dashboard-mobile.css";
import "./student-portal.css";
import "./global-nav.css";
import "./admin-session.css";
import "./psychologist-portal.css";
import "./home-rebuild.css";
import "./about-rebuild.css";
import "./vice-chancellor-message.css";
import "./leadership-layout.css";
import "./emergency-workflow.css";
import "./emergency-confirmation.css";
import "./experts-directory.css";
import "./expert-admin.css";
import "./auth-experience.css";
import "./registration.css";
import "./footer-system.css";
import "./role-session.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
