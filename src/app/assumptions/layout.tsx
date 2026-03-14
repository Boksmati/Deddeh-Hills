import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assumptions",
};

export default function AssumptionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
