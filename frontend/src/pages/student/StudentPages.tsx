import { ArrowRight, BookOpen, CalendarCheck, CheckCircle, EnvelopeSimple as Mail, GraduationCap, Heartbeat, Lifebuoy, Pulse as Activity, Phone, ShieldCheck, Sparkle, WarningCircle, Wind, X } from "@phosphor-icons/react"; import { useEffect, useState } from "react"; import { Link, useNavigate } from "react-router-dom"; import { SOCKET_EVENTS, type PendingEmergency, type SessionMatch } from "@bodhi/shared"; import { BlurFade, NumberTicker, ShineBorder } from "../../components/magicui/ProfileMagic"; import { TextReveal } from "../../components/reactbits/TextReveal"; import { SpotlightCard } from "../../components/reactbits/SpotlightCard"; import { Button } from "../../components/ui/Button"; import { useAuth } from "../../context/AuthContext"; import { api } from "../../lib/api"; import { getSocket } from "../../lib/socket";
const moods=[{label:"Anxious",symbol:"😰",tone:"yellow"},{label:"Depressed",symbol:"😔",tone:"blue"},{label:"Overwhelmed",symbol:"😵",tone:"red"},{label:"Angry",symbol:"😠",tone:"orange"},{label:"Confused",symbol:"🤔",tone:"purple"},{label:"Just need to talk",symbol:"💬",tone:"green"}];
export function StudentOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [mood, setMood] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api<any>("/student/history").then(response => setHistory(response.requests)).catch(() => {});
    const socket = getSocket();
    const queued = (_request: PendingEmergency) => {
      setSending(false);
      setWaiting(true);
      setModal(false);
      setToast("Request sent. A psychologist will connect shortly.");
    };
    const matched = (match: SessionMatch) => navigate(`/student/session/${match.sessionId}`, { state: { ...match, mood, urgent } });
    socket.on(SOCKET_EVENTS.EMERGENCY_QUEUED, queued);
    socket.on(SOCKET_EVENTS.SESSION_MATCHED, matched);
    return () => {
      socket.off(SOCKET_EVENTS.EMERGENCY_QUEUED, queued);
      socket.off(SOCKET_EVENTS.SESSION_MATCHED, matched);
    };
  }, [navigate, mood, urgent]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function request() {
    setSending(true);
    getSocket().emit(SOCKET_EVENTS.EMERGENCY_REQUEST, { mode: "chat", mood, urgent }, (result: any) => {
      if (!result.ok) {
        setSending(false);
        setToast(result.message);
      }
    });
  }

  const completed = history.filter(row => ["ended", "matched"].includes(row.status)).length;

  return (
    <section className="student-page student-home">
      {toast && <div className="student-toast" role="status"><CheckCircle />{toast}</div>}

      <BlurFade className="student-welcome">
        <ShineBorder duration={14} />
        <div className="student-welcome__copy">
          <span>YOUR PRIVATE SUPPORT SPACE</span>
          <TextReveal as="h1" text={`Good to see you, ${user?.displayName ?? "GBU Student"}`} delay={0.04} />
          <p>{user?.rollNumber ?? "GBU Student"} · Gautam Buddha University</p>
        </div>
        <div className="student-welcome__meta">
          <b><NumberTicker value={completed} /> sessions completed</b>
          <small><ShieldCheck weight="fill" /> Confidential by design</small>
        </div>
      </BlurFade>

      <div className="student-dashboard-grid">
        <div className="student-dashboard-main">
          {waiting ? (
            <BlurFade className="waiting-card">
              <ShineBorder duration={12} />
              <span className="student-spinner" />
              <div>
                <TextReveal as="h2" text="Finding the right psychologist..." delay={0.04} />
                <p>Your request is protected. Please stay on this page while we connect you.</p>
              </div>
            </BlurFade>
          ) : (
            <BlurFade className="request-card" delay={0.1}>
              <ShineBorder duration={12} />
              <span><Heartbeat weight="duotone" /></span>
              <div className="request-card__copy">
                <small className="request-card__eyebrow">Immediate, confidential support</small>
                <TextReveal as="h2" text="You do not have to carry it alone." delay={0.06} />
                <p>Connect privately with a university-approved psychologist. You decide what to share.</p>
              </div>
              <Button onClick={() => setModal(true)}><ShieldCheck /> Request support</Button>
            </BlurFade>
          )}
        </div>

        <BlurFade className="student-checkin-wrap" delay={0.15}>
          <SpotlightCard className="student-checkin-card">
            <div className="student-checkin-card__icon"><CalendarCheck weight="duotone" /></div>
            <small>WEEKLY WELLBEING CHECK-IN</small>
            <h2>Pause. Notice. Check in.</h2>
            <p>A short private assessment can help you understand how this week has felt.</p>
            <Link to="/student/assessment">Start assessment <ArrowRight /></Link>
          </SpotlightCard>
        </BlurFade>
      </div>

      <BlurFade className="student-toolkit-heading" delay={0.18}>
        <div>
          <span><Sparkle weight="fill" /> SELF-CARE TOOLKIT</span>
          <h2>Small steps for right now</h2>
        </div>
        <Link to="/student/resources">Explore all resources <ArrowRight /></Link>
      </BlurFade>

      <BlurFade className="quick-access" delay={0.22}>
        <Link to="/student/resources"><Wind /><span><strong>Breathing exercise</strong>Reset your breathing rhythm</span><ArrowRight className="quick-access__arrow" /></Link>
        <Link to="/student/resources"><Lifebuoy /><span><strong>Helplines</strong>Reach direct support safely</span><ArrowRight className="quick-access__arrow" /></Link>
        <Link to="/student/resources"><BookOpen /><span><strong>Grounding technique</strong>Return gently to the present</span><ArrowRight className="quick-access__arrow" /></Link>
        <Link to="/student/session"><Activity /><span><strong>Past sessions</strong><NumberTicker value={completed} /> completed</span><ArrowRight className="quick-access__arrow" /></Link>
      </BlurFade>

      {modal && (
        <div className="student-modal-backdrop">
          <div className="student-modal">
            <button className="modal-close" onClick={() => setModal(false)} aria-label="Close"><X /></button>
            <h2>How are you feeling?</h2>
            <p>This helps your psychologist support you better.</p>
            <div className="mood-grid">
              {moods.map(item => <button key={item.label} className={mood === item.label ? `selected ${item.tone}` : ""} onClick={() => setMood(item.label)}><span>{item.symbol}</span>{item.label}</button>)}
            </div>
            <label className="urgency-row">
              <span><strong>Is this urgent?</strong><small>Priority matching</small></span>
              <input type="checkbox" checked={urgent} onChange={event => setUrgent(event.target.checked)} />
              <i />
            </label>
            <Button disabled={!mood || sending} onClick={request}><ShieldCheck />{sending ? "Sending..." : "Connect with psychologist"}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

const phases=[{label:"Breathe in",seconds:4},{label:"Hold",seconds:4},{label:"Breathe out",seconds:6},{label:"Hold",seconds:2}];
export function StudentResources(){const[active,setActive]=useState(false);const[phase,setPhase]=useState(0);const[remaining,setRemaining]=useState(4);const[cycle,setCycle]=useState(0);useEffect(()=>{if(!active)return;setRemaining(phases[phase]!.seconds);const timer=setInterval(()=>setRemaining(value=>{if(value>1)return value-1;setPhase(current=>{const next=(current+1)%phases.length;if(next===0)setCycle(c=>c+1);return next});return phases[(phase+1)%phases.length]!.seconds}),1000);return()=>clearInterval(timer)},[active,phase]);const progress=active?1-remaining/phases[phase]!.seconds:0;const grounding=[[5,"See","Name five things you can see."],[4,"Touch","Notice four things you can feel."],[3,"Hear","Listen for three different sounds."],[2,"Smell","Find two things you can smell."],[1,"Taste","Notice one thing you can taste."]];const lines=[["Vandrevala Foundation","9999666555","General"],["iCall","9152987821","Students"],["Roshni Helpline","04066202000","Crisis"],["Sneha Foundation","04424640050","Crisis"],["Manas Foundation","01123389111","General"],["NIMHANS","08046804680","Govt"]];return <section className="student-page"><div className="simple-heading"><h1>Resources</h1><p>Small tools for grounding, breathing, and reaching direct help.</p></div><div className="resource-layout"><article className="breathing-card"><h2><Wind/> Box breathing exercise</h2>{active?<><div className="breathing-ring" style={{"--progress":`${progress*360}deg`} as any}><span><strong>{phases[phase]!.label}</strong>{remaining}s</span></div><p>Cycle {cycle+1}</p><Button variant="secondary" onClick={()=>setActive(false)}>Stop</Button></>:<><div className="breathing-idle"><Wind/></div><p>4-4-6-2 breathing pattern to reduce anxiety and stress.</p><Button onClick={()=>setActive(true)}>Start exercise</Button></>}</article><article className="grounding-card"><h2>5-4-3-2-1 grounding</h2>{grounding.map(([number,sense,text])=><div key={number}><b>{number}</b><span><strong>{sense}</strong>{text}</span></div>)}</article><article className="affirmation-card"><h2>Positive affirmations</h2>{["I am worthy of care and support.","This feeling is temporary. I will get through this.","I am stronger than I think.","It is okay to ask for help.","I deserve peace and happiness."].map(text=><p key={text}>{text}</p>)}</article><article className="helpline-card"><h2>Emergency helplines</h2>{lines.map(([name,number,tag])=><div key={name}><span><strong>{name}</strong><small className={`tag-${tag.toLowerCase()}`}>{tag}</small></span><a href={`tel:${number}`}><Phone/> Call</a></div>)}</article></div></section>}

export function StudentProfile(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  const [assessment,setAssessment]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{let active=true;Promise.allSettled([api<any>("/student/history"),api<any>("/student/assessment")]).then(([historyResult,assessmentResult])=>{if(!active)return;if(historyResult.status==="fulfilled")setRows(historyResult.value.requests);if(assessmentResult.status==="fulfilled")setAssessment(assessmentResult.value);if(historyResult.status==="rejected"&&assessmentResult.status==="rejected")setError("Your profile details could not be refreshed. Please check your connection and try again.");setLoading(false)});return()=>{active=false}},[]);
  if(loading)return <section className="student-page student-profile-magic"><div className="student-profile-shell profile-magic-state" aria-live="polite"><span/><h2>Preparing your profile</h2><p>Loading your private wellbeing summary.</p></div></section>;
  if(error)return <section className="student-page student-profile-magic"><div className="student-profile-shell profile-magic-state"><WarningCircle/><h2>Profile temporarily unavailable</h2><p>{error}</p></div></section>;
  const completed=rows.filter(row=>row.status==="ended").length,latest=assessment?.latest;
  return <section className="student-page student-profile-magic"><div className="student-profile-shell"><ShineBorder duration={12}/><div className="profile-cover profile-cover--magic"/><BlurFade className="profile-magic-heading"><div className="profile-magic-heading__identity"><div className="profile-avatar profile-avatar--magic"><GraduationCap weight="duotone"/></div><div><h1>{user?.displayName}</h1><p>Student · Gautam Buddha University</p></div></div><span className="profile-verified"><ShieldCheck weight="fill"/> Verified student account</span></BlurFade><BlurFade delay={.06}><div className="profile-info profile-info--magic"><div><Mail/><span><small>Email</small><strong>{user?.email??"Not provided"}</strong></span></div>{user?.mobileNumber&&<div><Phone/><span><small>Phone</small><strong>{user.mobileNumber}</strong></span></div>}<div><GraduationCap/><span><small>Roll number</small><strong>{user?.rollNumber??"Not provided"}</strong></span></div><div><BookOpen/><span><small>Department</small><strong>{user?.department??"Not provided"}</strong></span></div></div></BlurFade><BlurFade delay={.1}><div className="profile-stats profile-stats--magic"><div><strong><NumberTicker value={completed}/></strong><span>Sessions completed</span></div><div><strong>{latest?<><NumberTicker value={latest.score}/><small>/20</small></>:"Not taken"}</strong><span>Latest wellbeing score</span></div></div></BlurFade><BlurFade delay={.14}>{latest?<div className={`profile-assessment profile-assessment--magic profile-assessment--${latest.band}`}><span><Activity/></span><div><small>Latest monthly PWQ</small><strong>{latest.band} support level</strong><p>Completed {new Date(latest.completedAt).toLocaleDateString("en-IN")}. This is a screening result, not a diagnosis.</p></div><Link to="/student/assessment">View result</Link></div>:<div className="profile-assessment profile-assessment--magic"><span><Activity/></span><div><small>Monthly wellbeing check-in</small><strong>No assessment completed yet</strong><p>Take a private three-minute check-in about the past 14 days.</p></div><Link to="/student/assessment">Start assessment</Link></div>}</BlurFade></div></section>
}
