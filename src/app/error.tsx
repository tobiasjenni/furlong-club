"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const updated = error.name === "UnrecognizedActionError";
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-5xl">{updated ? "This page has been updated" : "Something went wrong"}</h1>
      <p className="muted mt-3">{updated ? "Reload to continue with the latest form. Nothing will be submitted automatically." : "We could not load this page. Please try again."}</p>
      <button onClick={updated ? () => window.location.reload() : reset} className="btn-gold mt-6">{updated ? "Reload page" : "Try again"}</button>
    </div>
  );
}
