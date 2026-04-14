"use client";

import AppHeader from "@/components/ui/AppHeader";
import AppFooter from "@/components/ui/AppFooter";
import { ModelContent } from "@/components/model/ModelContent";

export default function ModelPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F4F9EF" }}>
      <AppHeader currentPage="model" hideNav />
      <ModelContent />
      <AppFooter />
    </div>
  );
}
