import { privateMetadata } from "@/lib/seo";
import { ClubEntrance } from "./ClubEntrance";

export const metadata = { ...privateMetadata, title: { absolute: "The Private Entrance · Furlong Club" }, description: "Welcome to the private entrance of Furlong Club." };
export default async function Entrance({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next, mode } = await searchParams;
  return <ClubEntrance next={next} mode={mode === "invitation" ? "invitation" : "member"} />;
}
