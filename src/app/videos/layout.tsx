import { privateMetadata } from "@/lib/seo";
import PortalLayout from "@/app/(member)/layout";

export const metadata = privateMetadata;

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <PortalLayout>{children}</PortalLayout>;
}
