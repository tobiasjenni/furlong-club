import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-5xl">Page not found</h1>
      <p className="muted mt-3">The page may have moved or the link may be incorrect.</p>
      <Link href="/" className="btn-gold mt-6">Back to home</Link>
    </div>
  );
}
