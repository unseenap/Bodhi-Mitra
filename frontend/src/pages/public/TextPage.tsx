import ParticleText from "../../components/reactbits/ParticleText";
import "./text-page.css";

export function TextPage() {
  return <section className="text-page">
    <ParticleText
      text="Bodhi-Mitra"
      particleSize={2}
      density={4}
      color="#ffffff"
      highlightColor="#a78bfa"
      scatter={180}
      gatherDuration={1600}
      stagger={420}
      pointerRepel={42}
      repelRadius={125}
      idleDrift={0.7}
      trigger="hover"
      fontSize="clamp(3.25rem, 12vw, 9rem)"
      fontWeight={800}
      glow
    />
  </section>;
}
