import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-5xl">Non-runner</h1>
      <p className="muted mt-3">This page has been withdrawn from the race.</p>
      <Link href="/" className="btn-gold mt-6">Back to the paddock</Link>
    </div>
  );
}
