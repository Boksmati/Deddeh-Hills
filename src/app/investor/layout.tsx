import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investor Portal",
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
