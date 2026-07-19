import {
  ArrowRight,
  CheckCircle,
  GraduationCap,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  UserCircle,
  UsersThree,
  X
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import { BlurFade, NumberTicker, ShineBorder } from "../../components/magicui/ProfileMagic";
import { SpotlightCard } from "../../components/reactbits/SpotlightCard";
import { TextReveal } from "../../components/reactbits/TextReveal";
import directory from "../../data/psychologists.json";
import { api } from "../../lib/api";

type Category = "senior" | "consultant" | "trainee";
type Expert = {
  id: string;
  name: string;
  title: string;
  category: Category;
  image: string;
  specializations?: string[];
  source?: "directory" | "admin";
};

type RemoteExpert = {
  _id: string;
  fullName: string;
  professionalTitle?: string;
  expertCategory?: Category;
  portraitUrl?: string;
  specializations?: string[];
};

const labels: Record<Category, string> = { senior: "Senior", consultant: "Consultant", trainee: "Trainee" };
const order: Category[] = ["senior", "consultant", "trainee"];
const groupDetails: Record<Category, { description: string; Icon: ElementType }> = {
  senior: { description: "Leadership and experienced clinical guidance.", Icon: GraduationCap },
  consultant: { description: "Qualified professionals providing psychological care.", Icon: UsersThree },
  trainee: { description: "Psychologists developing practice under professional guidance.", Icon: UserCircle }
};
const normalize = (value: string) => value.toLowerCase().replace(/^(dr|ms|mrs|mr)\.\s*/, "").replace(/\s+/g, " ").trim();

export function ExpertsDirectoryPage() {
  const [remote, setRemote] = useState<RemoteExpert[]>([]);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [search, setSearch] = useState("");
  const [apiAvailable, setApiAvailable] = useState(true);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let active = true;
    api<{ experts: RemoteExpert[] }>("/experts")
      .then(result => {
        if (active) setRemote(Array.isArray(result.experts) ? result.experts : []);
      })
      .catch(() => {
        if (active) setApiAvailable(false);
      })
      .finally(() => {
        if (active) setSyncing(false);
      });
    return () => { active = false; };
  }, []);

  const experts = useMemo(() => {
    const merged = new Map<string, Expert>();
    (directory as Expert[]).forEach(item => merged.set(normalize(item.name), { ...item, source: "directory" }));
    remote.forEach(row => {
      const key = normalize(row.fullName);
      const existing = merged.get(key);
      merged.set(key, {
        id: row._id,
        name: row.fullName,
        title: row.professionalTitle || "Psychologist",
        category: row.expertCategory || "consultant",
        image: row.portraitUrl || existing?.image || "/images/pschylogo.svg",
        specializations: row.specializations,
        source: "admin"
      });
    });
    return [...merged.values()];
  }, [remote]);

  const normalizedSearch = search.trim().toLowerCase();
  const shown = experts.filter(expert =>
    (filter === "all" || expert.category === filter)
    && `${expert.name} ${expert.title} ${(expert.specializations || []).join(" ")}`.toLowerCase().includes(normalizedSearch)
  );
  const counts = Object.fromEntries(order.map(category => [category, experts.filter(expert => expert.category === category).length])) as Record<Category, number>;
  const adminVerified = experts.filter(expert => expert.source === "admin").length;

  function clearFilters() {
    setSearch("");
    setFilter("all");
  }

  return (
    <div className="expert-directory expert-directory--magic">
      <section className="expert-directory__hero">
        <BlurFade className="expert-directory__hero-copy">
          <span className="expert-directory__eyebrow"><ShieldCheck weight="fill" /> University-approved care network</span>
          <TextReveal as="h1" text="Meet the people behind your support." delay={0.04} />
          <p>Qualified mental health professionals supporting GBU students with care, dignity, and confidentiality.</p>
          <div className="expert-directory__hero-actions">
            <a href="#expert-directory-list">Explore the directory <ArrowRight weight="bold" /></a>
            <Link to="/quick-connect">Find support</Link>
          </div>
        </BlurFade>

        <BlurFade className="expert-directory__trust-panel" delay={0.1}>
          <ShineBorder duration={14} />
          <div className="expert-directory__trust-mark"><ShieldCheck weight="duotone" /></div>
          <div>
            <small>Published with care</small>
            <h2>Credentials come before visibility.</h2>
            <p>Administrator-added professionals appear only after verification and activation.</p>
          </div>
          <dl>
            <div><dt><NumberTicker value={experts.length} /></dt><dd>Professionals</dd></div>
            <div><dt><NumberTicker value={order.length} /></dt><dd>Care levels</dd></div>
            <div><dt><NumberTicker value={adminVerified} /></dt><dd>Live additions</dd></div>
          </dl>
        </BlurFade>
      </section>

      <section className="expert-directory__controls" aria-label="Expert directory controls">
        <label className="expert-search">
          <MagnifyingGlass weight="bold" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, role, or specialization" aria-label="Search experts" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear expert search"><X /></button>}
        </label>
        <div className="expert-filter" role="group" aria-label="Filter psychologist category">
          <button className={filter === "all" ? "active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <b>{experts.length}</b></button>
          {order.map(category => (
            <button key={category} className={filter === category ? "active" : ""} aria-pressed={filter === category} onClick={() => setFilter(category)}>
              {labels[category]} <b>{counts[category]}</b>
            </button>
          ))}
        </div>
        <span className="expert-directory__result-count" aria-live="polite">{syncing ? "Syncing directory" : `${shown.length} ${shown.length === 1 ? "expert" : "experts"} shown`}</span>
      </section>

      {!apiAvailable && (
        <div className="expert-directory__notice" role="status">
          <ShieldCheck />
          <span><strong>University directory is available.</strong> Live administrator additions will return when the service reconnects.</span>
        </div>
      )}

      <main id="expert-directory-list">
        {order.map((category, groupIndex) => {
          const rows = shown.filter(expert => expert.category === category);
          if (!rows.length) return null;
          const { Icon, description } = groupDetails[category];
          return (
            <BlurFade className={`expert-group expert-group--${category}`} delay={groupIndex * 0.05} key={category}>
              <header>
                <span><Icon weight="duotone" /></span>
                <div><h2>{labels[category]} Psychologists</h2><p>{description}</p></div>
                <b>{rows.length}</b>
              </header>
              <div className="expert-cards">
                {rows.map((expert, index) => (
                  <BlurFade delay={Math.min(index, 7) * 0.035} key={expert.id || expert.name}>
                    <SpotlightCard className="expert-card">
                      <div className="expert-photo">
                        <img src={expert.image} alt={`Portrait of ${expert.name}`} loading="lazy" decoding="async" onError={event => { event.currentTarget.src = "/images/pschylogo.svg"; }} />
                        {expert.source === "admin" && <span title="Verified and active"><ShieldCheck weight="fill" /></span>}
                      </div>
                      <div className="expert-card__identity">
                        <small>{labels[expert.category]} psychologist</small>
                        <h3>{expert.name}</h3>
                        <p>{expert.title}</p>
                      </div>
                      {expert.specializations?.length ? (
                        <div className="expert-card__specializations" aria-label={`${expert.name} specializations`}>
                          {expert.specializations.slice(0, 3).map(value => <span key={value}>{value}</span>)}
                        </div>
                      ) : <p className="expert-card__guidance"><Sparkle /> Available through the Bodhi-Mitra care network</p>}
                      <footer><CheckCircle weight="fill" /> Published university profile</footer>
                    </SpotlightCard>
                  </BlurFade>
                ))}
              </div>
            </BlurFade>
          );
        })}

        {!shown.length && (
          <div className="expert-directory__empty">
            <UserCircle weight="duotone" />
            <h2>No experts match this search</h2>
            <p>Try a different name, role, or category.</p>
            <button type="button" onClick={clearFilters}>Show the full directory</button>
          </div>
        )}
      </main>

      <BlurFade className="expert-directory__trust" delay={0.08}>
        <ShineBorder duration={16} />
        <ShieldCheck weight="duotone" />
        <span><strong>Verification is part of the publishing workflow.</strong> Admin-created psychologists appear only while their account is verified and active.</span>
        <Link to="/privacy">View privacy standards <ArrowRight /></Link>
      </BlurFade>
    </div>
  );
}
