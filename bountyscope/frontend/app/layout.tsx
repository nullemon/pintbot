import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BountyScope — Security research workspace",
  description: "Scope-aware asset discovery, security assessment, and finding triage for authorized research.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
