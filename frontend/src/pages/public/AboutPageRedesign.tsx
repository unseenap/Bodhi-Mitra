import {
  ArrowRight,
  Brain,
  ChatCircleText,
  Compass,
  HandHeart,
  Heart,
  LockKey,
  Medal,
  Quotes,
  ShieldCheck,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { BlurFade, ShineBorder } from "../../components/magicui/ProfileMagic";
import { ShinyText } from "../../components/reactbits/ShinyText";
import { SpotlightCard } from "../../components/reactbits/SpotlightCard";
import { TextReveal } from "../../components/reactbits/TextReveal";

type Leader = {
  name: string;
  title: string;
  affiliation: string;
  image: string;
  imageAlt: string;
  message: string[];
};

const viceChancellor: Leader = {
  name: "Prof. Rana Pratap Singh",
  title: "From the Desk of the Vice Chancellor",
  affiliation: "Vice Chancellor, Gautam Buddha University",
  image: "/images/leadership/vc.png",
  imageAlt: "Prof. Rana Pratap Singh, Vice Chancellor of Gautam Buddha University",
  message: [
    "The Department of Psychology and Mental Health, under the School of Humanities and Social Sciences, has consistently been at the forefront of mental health education and service delivery. It is with pride that I introduce \"Bodhi Mitra,\" an innovative digital platform designed to ensure continuous and comprehensive mental health support for our students at the campus.",
    "\"Bodhi Mitra\" embodies the essence of a mind-mate in your journey toward mental wellness. The platform provides round-the-clock access to licensed clinical psychologists, counselling psychologists, and trained professionals who are committed to addressing psychological needs ranging from stress, anxiety, and adjustment difficulties to crisis intervention and therapeutic care.",
    "Through one-to-one consultations, psychological assessments, crisis management, and ongoing therapeutic support, \"Bodhi Mitra\" offers a safe, confidential, and compassionate environment. Our aim is not only to provide immediate support but also to foster resilience and promote a culture of self-awareness, empathy, and mental health literacy within the university community.",
    "I am confident that this initiative will strengthen our collective efforts in building a nurturing environment where every student feels seen, supported, and empowered. I extend my heartfelt appreciation to the Department of Psychology and Mental Health and the team \"Bodhi Mitra\" for this commendable step toward promoting holistic wellbeing and inclusivity on our campus.",
    "I wish the entire team great success in their continued mission of care, compassion, and excellence.",
  ],
};

const dean: Leader = {
  name: "Dr. Madhav Govind",
  title: "Dean, School of Humanities and Social Sciences",
  affiliation: "Gautam Buddha University",
  image: "/images/leadership/dean.jpg",
  imageAlt: "Dr. Madhav Govind, Dean of the School of Humanities and Social Sciences",
  message: [
    "It gives me immense pride and joy to share the launch of \"Bodhi Mitra\", an innovative digital initiative of the Department of Psychology and Mental Health under the School of Humanities and Social Sciences, Gautam Buddha University. Conceived with a deep sense of compassion and academic responsibility, \"Bodhi Mitra\" symbolizes our collective commitment to nurturing mental wellbeing, emotional resilience, and holistic development among our students.",
    "The changing times have highlighted the indispensability of mental health support in every sphere of life, particularly for young minds who are balancing academic demands and personal growth. In this context, \"Bodhi Mitra\" stands as a reliable digital platform offering seamless access to psychological care and guidance. With the help of licensed clinical psychologists, counselling professionals, and trained experts, the platform provides round-the-clock psychosocial and therapeutic support to students, both on campus and remotely.",
    "Beyond clinical assistance, \"Bodhi Mitra\" focuses on promoting mental health through sensitisation programmes, workshops, and ongoing awareness initiatives that enhance emotional literacy and destigmatize mental health concerns. The platform's integrative approach, combining scientific understanding with empathy, reflects the ethos of the School of Humanities and Social Sciences, where human values and intellectual growth go hand in hand.",
    "I extend my heartfelt congratulations to the dedicated faculty, clinicians, and trainees of the Department of Psychology and Mental Health for conceptualizing and implementing this much-needed initiative. I am confident that \"Bodhi Mitra\" will serve as a beacon of hope, care, and transformation, ensuring that no student feels alone in their journey toward wellbeing.",
    "I sincerely wish the team great success in carrying forward this noble mission of mental health empowerment and compassionate support to GBU family.",
  ],
};

const hod: Leader = {
  name: "Dr. Anand Pratap Singh",
  title: "Head, Department of Psychology and Mental Health",
  affiliation: "Gautam Buddha University",
  image: "/images/leadership/hod.svg",
  imageAlt: "Dr. Anand Pratap Singh, Head of the Department of Psychology and Mental Health",
  message: [
    "Across the globe, there has been a steady and concerning rise in psychological and emotional difficulties, with university students representing a particularly vulnerable population. The transitional demands of higher education: academic pressure, identity formation, interpersonal challenges, financial stressors, and uncertainty about the future intersect with developmental and psychosocial vulnerabilities. These pressures have been further intensified in recent years by rapid social change, digital immersion, and the lingering psychosocial impact of global disruptions. As a result, concerns such as stress, anxiety, low mood, social withdrawal, sleep disturbances, and emotional dysregulation are increasingly reported among students, often remaining unrecognised until they significantly impair wellbeing and functioning.",
    "Within the university context, mental health is not peripheral to academic life; it is foundational to learning, growth, and meaningful engagement. As both the Head of the Department of Psychology and Mental Health and a practising Clinical Psychologist, I strongly believe that institutions of higher education carry an ethical responsibility to create environments that actively support psychological wellbeing, reduce stigma, and promote timely access to professional care.",
    "It is within this framework that Bodhi Mitra was conceptualised and developed. Bodhi Mitra is envisioned as a comprehensive, ethically grounded digital mental health platform that extends care beyond conventional boundaries of time and space. Its core purpose is to ensure that students and staff of Gautam Buddha University have access to confidential, professional, and responsive mental health support, whether they are navigating everyday stressors or experiencing significant psychological distress.",
    "Bodhi Mitra integrates individual psychological support, crisis response, and preventive mental health initiatives within a single platform. By combining one-to-one professional care with mental health promotion, awareness, and capacity-building activities, it seeks not only to respond to distress but also to strengthen resilience, self-awareness, and help-seeking behaviours within the university community.",
    "The vision of Bodhi Mitra is to foster a campus culture where mental health is acknowledged, protected, and prioritised, where seeking support is viewed as a strength rather than a limitation. Through this initiative, Gautam Buddha University reaffirms its commitment to safeguarding the psychological well-being of its students and staff, recognising that a mentally healthy academic community is essential for personal development, academic excellence, and collective growth.",
  ],
};

const storyCards = [
  {
    icon: Brain,
    title: "About Bodhi-Mitra",
    body: "A student-first mental health initiative created at Gautam Buddha University for private, timely, and compassionate support.",
    className: "about-story-card--brand",
  },
  {
    icon: ChatCircleText,
    title: "Our Story",
    body: "Bodhi-Mitra closes the gap between a student who needs support and a qualified professional who is ready to listen.",
    className: "about-story-card--story",
  },
  {
    icon: Compass,
    title: "Our Name",
    body: "Bodhi means awakening. Mitra means friend. Together, the name represents informed companionship in a student's wellbeing journey.",
    className: "about-story-card--name",
  },
  {
    icon: Medal,
    title: "A GBU Initiative",
    body: "Developed through the Department of Psychology and Mental Health under the School of Humanities and Social Sciences.",
    className: "about-story-card--gbu",
  },
];

const standards = [
  { icon: LockKey, title: "Identity shielding", body: "Psychologists work with a temporary session identity instead of a student's personal profile." },
  { icon: ShieldCheck, title: "Verified professionals", body: "Professional accounts activate only after administrator-led qualification checks." },
  { icon: UsersThree, title: "Role-based access", body: "Students, psychologists, and administrators receive only the access required for their role." },
  { icon: Heart, title: "Crisis fallback", body: "Urgent pathways keep campus and national crisis numbers visible when immediate help is required." },
];

function LeaderMessage({ leader, featured = false }: { leader: Leader; featured?: boolean }) {
  return (
    <BlurFade className={`leadership-message-reveal${featured ? " leadership-message-reveal--featured" : ""}`}>
      <article className="leadership-message">
        <ShineBorder duration={20} />
        <header className="leadership-message__identity">
          <div className="leadership-message__portrait-wrap">
            <img className="leadership-message__portrait" src={leader.image} alt={leader.imageAlt} />
          </div>
          <div>
            <Quotes weight="duotone" aria-hidden="true" />
            <p>{leader.title}</p>
            <TextReveal as="h2" text={leader.name} delay={0.03} />
            <span>{leader.affiliation}</span>
          </div>
        </header>
        <div className="leadership-message__body">
          {leader.message.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </article>
    </BlurFade>
  );
}

export function AboutPageRedesign() {
  return (
    <main className="about-rebuild">
      <section className="about-rebuild__hero">
        <div className="about-rebuild__hero-media" aria-hidden="true">
          <img src="/images/GBUBG2.png" alt="" />
        </div>
        <BlurFade className="about-rebuild__hero-copy">
          <ShinyText text="About Bodhi-Mitra" speed={7} />
          <TextReveal as="h1" text="Built by GBU, for GBU students." delay={0.04} />
          <p>A safer path to timely, private, and compassionate psychological support.</p>
          <div className="about-rebuild__hero-actions">
            <Link to="/experts">Meet our experts <ArrowRight weight="bold" /></Link>
            <Link to="/contact">Contact the team</Link>
          </div>
        </BlurFade>
      </section>

      <section className="about-rebuild__leadership" aria-label="University leadership messages">
        <BlurFade className="about-leadership-intro">
          <Quotes weight="duotone" aria-hidden="true" />
          <div>
            <ShinyText text="Messages of commitment" speed={8} />
            <TextReveal as="h2" text="Leadership behind the mission" delay={0.04} />
            <p>Three university perspectives, united by one commitment to student wellbeing.</p>
          </div>
        </BlurFade>

        <div className="leadership-layout leadership-layout--vc">
          <LeaderMessage leader={viceChancellor} featured />
          <aside className="leadership-layout__context" aria-label="About Bodhi-Mitra">
            {storyCards.map(({ icon: Icon, title, body, className }, index) => (
              <BlurFade key={title} className="about-story-card-reveal" delay={index * 0.05}>
                <SpotlightCard className={`about-story-card ${className}`}>
                  {index === 0 && <ShineBorder duration={18} />}
                  <Icon weight="duotone" aria-hidden="true" />
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                  {index === 0 && <img src="/images/pschylogo.svg" alt="Bodhi-Mitra logo" />}
                </SpotlightCard>
              </BlurFade>
            ))}
          </aside>
        </div>

        <section className="leadership-layout leadership-layout--pair" aria-label="Messages from the Dean and Head of Department">
          <LeaderMessage leader={dean} />
          <LeaderMessage leader={hod} />
        </section>
      </section>

      <section className="about-rebuild__standards">
        <BlurFade className="about-standards-heading">
          <Sparkle weight="duotone" aria-hidden="true" />
          <TextReveal as="h2" text="Safety is part of the architecture" delay={0.04} />
          <p>Privacy and accountability are designed into every role and support pathway.</p>
        </BlurFade>
        <div className="about-standards-grid">
          {standards.map(({ icon: Icon, title, body }, index) => (
            <BlurFade key={title} className={`about-standard-wrap about-standard--${index + 1}`} delay={index * 0.05}>
              <SpotlightCard className="about-standard">
                <Icon weight="duotone" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </SpotlightCard>
            </BlurFade>
          ))}
        </div>
      </section>

      <BlurFade className="about-governance-reveal">
        <section className="about-rebuild__governance">
          <ShineBorder duration={18} />
          <img src="/images/logo.svg" alt="Gautam Buddha University emblem" />
          <div>
            <HandHeart weight="duotone" aria-hidden="true" />
            <TextReveal as="h2" text="University-governed support" delay={0.04} />
            <p>Psychologists join the panel only after an administrator confirms their qualifications and professional details.</p>
          </div>
          <Link to="/contact">Contact the team <ArrowRight weight="bold" /></Link>
        </section>
      </BlurFade>
    </main>
  );
}
