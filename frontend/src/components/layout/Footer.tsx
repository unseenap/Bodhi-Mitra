import { MapPin, Phone, Warning } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const year = new Date().getFullYear();

function FooterBrand({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "page-footer__brand page-footer__brand--compact" : "page-footer__brand"}>
    <span className="page-footer__logo"><img src="/images/pschylogo.svg" alt="" /></span>
    <strong>Bodhi-Mitra</strong>
  </div>;
}

export function GlobalFooter() {
  return <footer className="global-credit-footer">
    <p>© {year} Managed &amp; Developed by Abhishek Prajapati, Abhinav Kumar, and Vivek Khatkar</p>
  </footer>;
}

export function HomeFooter() {
  return <footer className="home-page-footer">
    <div className="home-page-footer__grid">
      <div className="home-page-footer__about">
        <FooterBrand />
        <p>A student-first mental health platform — fast, safe, and always there for you.</p>
      </div>
      <nav aria-label="Footer quick links">
        <h2>Quick Links</h2>
        <Link to="/about">About</Link>
        <a href="/#how-it-works">How It Works</a>
        <Link to="/privacy">Privacy Policy</Link>
        <a href="#terms">Terms of Use</a>
      </nav>
      <nav aria-label="Footer support links">
        <h2>Support</h2>
        <Link to="/contact">Contact Us</Link>
        <Link to="/faq">FAQ</Link>
        <Link to="/emergency">Crisis Resources</Link>
        <Link to="/contact">Campus Partners</Link>
      </nav>
      <div className="home-page-footer__crisis">
        <h2>Crisis Help</h2>
        <a className="home-page-footer__danger" href="tel:112"><Warning weight="fill" /> <span>Immediate Danger? Call 112</span></a>
        <a href="tel:9152987821"><Phone weight="fill" /> <span>Helpline: 9152987821</span></a>
        <Link to="/contact"><MapPin weight="fill" /> <span>Find Campus Support</span></Link>
      </div>
    </div>
    <div className="home-page-footer__bottom">© {year} Bodhi-Mitra. All rights reserved.</div>
  </footer>;
}

export function AboutFooter() {
  return <footer className="page-footer page-footer--about">
    <FooterBrand />
    <p>A student-first mental health platform, always here for you.</p>
    <div>© {year} Bodhi-Mitra <span aria-hidden="true">|</span> Gautam Buddha University</div>
  </footer>;
}

export function SimplePageFooter() {
  return <footer className="page-footer page-footer--simple">
    <FooterBrand compact />
    <p>© {year} Bodhi-Mitra. All rights reserved.</p>
  </footer>;
}

export function PageSpecificFooter({ pathname }: { pathname: string }) {
  if (pathname === "/") return <HomeFooter />;
  if (pathname === "/about") return <AboutFooter />;
  if (["/contact", "/faq", "/privacy"].includes(pathname)) return <SimplePageFooter />;
  return null;
}
