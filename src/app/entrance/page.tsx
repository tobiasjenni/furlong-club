import { privateMetadata } from "@/lib/seo";
import { clubNext } from "@/lib/club-gate";
import { EntranceForm } from "./EntranceForm";
import "./entrance.css";

export const metadata = { ...privateMetadata, title: "The Private Entrance · Furlong Club", description: "Welcome to the private entrance of Furlong Club." };
export default async function Entrance({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <div className="club-door">
    <div className="club-door-art" role="img" aria-label="A traditional London club entrance with a green door, warm brass lanterns and a welcoming butler" />
    <div className="club-door-shade" />
    <div className="club-door-brand"><img src="/icon.svg" alt="" width="48" height="48" /><span>FURLONG <small>PRIVATE MEMBERS CLUB</small></span></div>
    <section className="club-door-card" aria-labelledby="entrance-title">
      <p className="club-door-eyebrow">Discretion. Tradition. A warm welcome.</p>
      <h1 id="entrance-title">Some doors open<br />by invitation.</h1>
      <p className="club-door-greeting">“Good evening. Your club password, please.”</p>
      <EntranceForm next={clubNext((await searchParams).next)} />
      <p className="club-door-footnote">Your invitation opens the club. Your personal login keeps your account private.</p>
    </section>
    <p className="club-door-caption">Furlong Club <span>·</span> A private welcome awaits</p>
  </div>;
}
