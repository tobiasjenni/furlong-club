"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-5xl">Something went wrong</h1>
      <p className="muted mt-3">We could not load this page. Please try again.</p>
      <button onClick={reset} className="btn-gold mt-6">Try again</button>
    </div>
  );
}
