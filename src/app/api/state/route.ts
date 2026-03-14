import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

export async function GET() {
  const data = await dbGet<Record<string, unknown>>("state", {});

  // If active state has no real assignments, fall back to the first saved scenario.
  // This ensures investors/customers always see the default massing plan even if
  // the active state was accidentally cleared.
  const assignments = (data.assignments as Array<{ developmentType?: string }>) ?? [];
  const hasRealData = assignments.some((a) => a.developmentType && a.developmentType !== "unassigned");

  if (!hasRealData) {
    const scenarios = await dbGet<Array<Record<string, unknown>>>("scenarios", []);
    if (scenarios.length > 0) {
      const defaultScenario = scenarios[0];
      return NextResponse.json({
        assignments:       defaultScenario.assignments       ?? [],
        lotStatuses:       defaultScenario.lotStatuses       ?? [],
        investorSharePct:  defaultScenario.investorSharePct  ?? 20,
        typeAssumptions:   defaultScenario.typeAssumptions,
        investorModel:     defaultScenario.investorModel,
        projectSpecs:      data.projectSpecs,
        phaseRevenueTargets: data.phaseRevenueTargets,
        lotGroups:         data.lotGroups          ?? [],
        investorFeatureFlags: data.investorFeatureFlags,
      });
    }
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  await dbSet("state", body);
  return NextResponse.json({ ok: true });
}
