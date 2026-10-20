import { RobMascot } from "./RobMascot";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="container-page grid items-center gap-10 py-10 md:grid-cols-2 md:py-16">
      <div className="hidden md:block">
        <RobMascot className="mx-auto w-full max-w-sm" />
        <p className="muted mt-4 text-center text-xs">Rob is our illustrated mascot, not a real person.</p>
      </div>
      <div className="card mx-auto w-full max-w-md">
        <h1 className="text-3xl">{title}</h1>
        <p className="muted mb-6 mt-1 text-sm">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
