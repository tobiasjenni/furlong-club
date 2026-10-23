import { brand } from "@/lib/config";
import { HostPortrait } from "./HostPortrait";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="container-page grid items-start gap-8 py-8 md:grid-cols-2 md:py-12 lg:items-center lg:gap-12">
      <div className="hidden md:sticky md:top-24 md:block">
        <HostPortrait className="mx-auto w-full max-w-sm shadow-2xl" />
        <p className="muted mt-4 text-center text-xs">{brand.host.name} · Your Furlong Club trader</p>
      </div>
      <div className="card mx-auto w-full max-w-md">
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        <p className="muted mb-6 mt-2 text-sm leading-relaxed">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
