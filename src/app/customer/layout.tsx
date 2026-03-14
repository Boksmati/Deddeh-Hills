import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Properties",
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
