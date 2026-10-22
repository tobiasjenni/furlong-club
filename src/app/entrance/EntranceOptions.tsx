"use client";
import { useState } from "react";
import { LoginForm } from "@/app/login/LoginForm";
import { EntranceForm } from "./EntranceForm";

export function EntranceOptions({ initialMode, loginNext, invitationNext, notice }: {
  initialMode: "member" | "invitation"; loginNext: string; invitationNext: string; notice?: string;
}) {
  const [mode, setMode] = useState(initialMode);
  return <div className="club-door-options">
    <div className="club-door-choice" role="group" aria-label="Choose how to enter">
      <button type="button" aria-pressed={mode === "member"} aria-controls="club-door-panel" onClick={() => setMode("member")}>Member sign-in</button>
      <button type="button" aria-pressed={mode === "invitation"} aria-controls="club-door-panel" onClick={() => setMode("invitation")}>I have an invitation</button>
    </div>
    <div id="club-door-panel" className="club-door-panel" key={mode}>
      {mode === "member" ? <>
        <h2 className="club-door-panel-title">Welcome back.</h2>
        <p className="club-door-panel-intro">Your personal login opens the door. No invitation password needed.</p>
        <LoginForm next={loginNext} notice={notice} showSignupLink={false} />
      </> : <>
        <h2 className="club-door-panel-title">Your invitation, please.</h2>
        <p className="club-door-panel-intro">Enter your invitation password to explore the club and create your membership account.</p>
        <EntranceForm next={invitationNext} />
      </>}
    </div>
  </div>;
}
