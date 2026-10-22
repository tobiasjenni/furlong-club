import { EntranceOptions } from "./EntranceOptions";
import { clubNext } from "@/lib/club-gate";
import { safeNext } from "@/lib/request";
import "./entrance.css";

export function ClubEntrance({ next, mode = "member", notice }: { next?: string; mode?: "member" | "invitation"; notice?: string }) {
  return <div className="club-door">
    <div className="club-door-art" role="img" aria-label="A traditional London club entrance with a green door, warm brass lanterns and a welcoming butler" />
    <div className="club-door-shade" />
    <div className="club-door-brand"><img src="/icon.svg" alt="" width="48" height="48" /><span>FURLONG <small>PRIVATE MEMBERS CLUB</small></span></div>
    <section className="club-door-card" aria-labelledby="entrance-title">
      <p className="club-door-eyebrow">Discretion. Tradition. A warm welcome.</p>
      <h1 id="entrance-title">Your club awaits.</h1>
      <p className="club-door-greeting">“Good evening. A member, or joining us by invitation?”</p>
      <EntranceOptions initialMode={mode} loginNext={safeNext(next)} invitationNext={clubNext(next)} notice={notice} />
      <p className="club-door-footnote">An invitation welcomes you to the club. Your personal login keeps your account private.</p>
    </section>
    <p className="club-door-caption">Furlong Club <span>·</span> A private welcome awaits</p>
  </div>;
}
