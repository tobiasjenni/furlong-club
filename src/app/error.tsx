"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-5xl">Stewards&apos; inquiry</h1>
      <p className="muted mt-3">Something went wrong on our side. Please try again.</p>
      <button onClick={reset} className="btn-gold mt-6">Try again</button>
    </div>
  );
}
