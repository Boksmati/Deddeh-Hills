"use client";

import { useState, useEffect } from "react";
import DhLogo from "@/components/ui/DhLogo";
import AppHeader from "@/components/ui/AppHeader";
import { useTranslations } from "@/i18n/useTranslations";
import { useInvestmentConfig } from "@/hooks/useInvestmentConfig";
import { useRole } from "@/hooks/useRole";

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ── Accordion section ──────────────────────────────────────────────────────
function Section({
  title,
  subtitle,
  accentColor,
  defaultOpen,
  children,
}: {
  title: string;
  subtitle?: string;
  accentColor: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-7 py-5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: accentColor }} />
            <h2 className="text-base font-bold text-dh-dark">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 ml-6">{subtitle}</p>}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-7 pb-7">{children}</div>}
    </div>
  );
}

// ── Definition row ─────────────────────────────────────────────────────────
function DefRow({
  label,
  value,
  highlight,
  note,
  isRTL,
}: {
  label: string;
  value: string | React.ReactNode;
  highlight?: boolean;
  note?: string;
  isRTL?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-50 last:border-0 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
      <dt className="text-sm text-gray-500 flex-shrink-0 w-52">{label}</dt>
      <dd className={`text-sm font-semibold flex-1 ${highlight ? "text-dh-green" : "text-gray-800"}`}>
        {value}
        {note && <span className="block text-xs font-normal text-gray-400 mt-0.5">{note}</span>}
      </dd>
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: color + "18", color }}
    >
      {label}
    </span>
  );
}

// ── Protection item ────────────────────────────────────────────────────────
function ProtectionItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="text-xl flex-shrink-0 w-8 text-center">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function TermSheetPage() {
  const { t, lang, isRTL } = useTranslations();
  const { config, l1Returns, phasedPricing, isLoading } = useInvestmentConfig();
  const role = useRole();
  const [docExists, setDocExists] = useState(false);

  // Check if the PDF/DOCX exists in /docs/
  useEffect(() => {
    fetch("/docs/deddeh_hills_term_sheet.docx", { method: "HEAD" })
      .then((r) => setDocExists(r.ok))
      .catch(() => setDocExists(false));
  }, []);

  const isAr = lang === "ar";

  // Per-villa totals from config
  const constructionCost = config.buaPerVilla * config.constructionCostSqm;
  const softCost = constructionCost * config.softCostPct;
  const l2Cash = constructionCost * config.cashPctOfConstruction + softCost;
  const revenue = config.buaPerVilla * config.sellingPriceSqm;
  const landTransferTotal = config.landPerVilla * (config.phaseLandPrices[0]?.pricePerSqm ?? 275);
  const l1LandPayment = landTransferTotal * config.l1InvestorShare;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen" style={{ background: "#F4F9EF" }}>

      {/* Shared Navigation Header */}
      <AppHeader currentPage="term-sheet" />

      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <div className="bg-dh-dark text-white">
        <div className="max-w-4xl mx-auto px-8 py-10">
          <div className="mb-4">
            <DhLogo variant="light" className="h-12" />
          </div>
          <div className="flex items-start justify-between gap-8">
            <div>
              <h1 className="text-3xl font-serif font-bold text-white mb-2">
                {t("term_sheet_title")}
              </h1>
              <p className="text-gray-300 text-sm max-w-xl leading-relaxed">
                {isAr
                  ? "الإطار القانوني والمالي للاستثمار في مشروع ديدة هيلز — فهم كامل لحقوقك وضماناتك وآليات الخروج."
                  : "The legal and financial framework for investing in Deddeh Hills — a complete guide to your rights, protections, and exit mechanisms."}
              </p>
            </div>
            {docExists && (
              <div className="flex-shrink-0">
                <a
                  href="/docs/deddeh_hills_term_sheet.docx"
                  download
                  className="text-xs px-3 py-2 rounded-xl font-semibold transition-colors"
                  style={{ background: "#78BF42", color: "#fff" }}
                >
                  ↓ {isAr ? t("term_sheet_download_ar") : t("term_sheet_download_en")}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Status badges ─────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-8 py-6">
        <div className="flex flex-wrap gap-3 mb-8">
          <Badge label={isAr ? "المرحلة الأولى — ١٠ فلل" : "Phase 1 — 10 Villas"} color="#2563eb" />
          <Badge label={isAr ? `حجم الصندوق ${fmt$(config.l1FundSize)}` : `L1 Fund: ${fmt$(config.l1FundSize)}`} color="#7c3aed" />
          <Badge label={isAr ? `الجدول الزمني: ${config.l2Timeline} سنوات` : `Timeline: ${config.l2Timeline} Years`} color="#059669" />
          <Badge label={isAr ? "مقيّد بالأصول" : "Asset-Backed"} color="#d97706" />
          <Badge label={isAr ? "تقاسم الأرباح 50/50" : "50/50 Profit Share"} color="#dc2626" />
        </div>

        {isLoading ? (
          <div className="text-gray-400 text-sm text-center py-10">
            {isAr ? "جارٍ التحميل..." : "Loading…"}
          </div>
        ) : (
          <div className="space-y-5">

            {/* ── Section 1: Layer 1 — Land Fund ──────────────────────── */}
            <Section
              title={t("term_sheet_l1_section")}
              subtitle={isAr ? "صندوق ملكية الأرض للمستثمرين الأوائل" : "Land equity fund for early-stage investors"}
              accentColor="#7c3aed"
              defaultOpen
            >
              <dl className="mt-2 divide-y divide-gray-50">
                <DefRow isRTL={isRTL}
                  label={isAr ? "هيكل الصندوق" : "Fund Structure"}
                  value={isAr ? `تملّك ${fmtPct(config.l1InvestorShare)} من قطعة الأرض (${config.landPerVilla} م²)` : `${fmtPct(config.l1InvestorShare)} land ownership stake per ${config.landPerVilla} sqm plot`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "حجم الصندوق الإجمالي" : "Total Fund Size"}
                  value={fmt$(config.l1FundSize)}
                  highlight
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "سعر الدخول" : "Entry Price"}
                  value={`$${config.l1EntryPrice}/sqm`}
                  note={isAr ? `${fmt$(config.l1EntryPrice * config.landPerVilla * config.l1InvestorShare)} لكل قطعة أرض` : `${fmt$(config.l1EntryPrice * config.landPerVilla * config.l1InvestorShare)} per plot`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "سعر الخروج (سقف)" : "Exit Price (cap)"}
                  value={`$${config.l1ExitPriceCap}/sqm`}
                  highlight
                  note={isAr ? `سقف ملزم خلال ${config.l1ExitCapYears} سنوات` : `Hard cap within ${config.l1ExitCapYears} years`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "الجدول الزمني" : "Timeline"}
                  value={isAr ? `${config.l1Timeline} سنتان (إغلاق الصندوق)` : `${config.l1Timeline} years (fund closing)`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "العائد على رأس المال (ROI)" : "Expected ROI"}
                  value={fmtPct(l1Returns.roi)}
                  highlight
                  note={`IRR ≈ ${fmtPct(l1Returns.irr)}`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "الأرض المكتسبة" : "Land Acquired"}
                  value={`${l1Returns.sqmAcquired.toLocaleString()} sqm`}
                  note={isAr ? `قيمة الخروج: ${fmt$(l1Returns.exitValue)}` : `Exit value: ${fmt$(l1Returns.exitValue)}`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "توظيف الأموال" : "Use of Funds"}
                  value={isAr
                    ? `شراء ${fmtPct(config.l1InvestorShare)} من حصص الأرض في كل قطعة. تُسوّى حصة الأرض عند بيع كل فيلا.`
                    : `Acquire ${fmtPct(config.l1InvestorShare)} land stakes across all plots. Land stakes settled at each villa sale.`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "الضمان" : "Security"}
                  value={isAr
                    ? "حصة مسجّلة في أرض كل قطعة — أولوية استرداد عند البيع"
                    : "Registered land stake per plot — priority recovery at sale"}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "حق الرفض الأول (ROFR)" : "Right of First Refusal"}
                  value={isAr
                    ? "يحق لمستثمري الطبقة الأولى الأولوية في شراء مراكز مالية مستقبلية إذا أصدرها المالك"
                    : "L1 investors retain ROFR on any future land stake issuances by the landowner"}
                />
              </dl>

              {/* 4 exit mechanisms */}
              <div className="mt-5">
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                  {t("inv_exit_mechanisms")}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      name: isAr ? "الخروج عبر مبيعات الفلل" : "Villa Sales Exit",
                      trigger: isAr ? "عند بيع كل فيلا" : "At each villa sale",
                      price: `$${config.l1ExitPriceCap}/sqm`,
                      color: "#7c3aed",
                      desc: isAr
                        ? "تُدفع حصة الأرض للطبقة الأولى من عائدات بيع كل فيلا"
                        : "L1 land share paid from villa sale proceeds at exit cap",
                    },
                    {
                      name: isAr ? "التحويل إلى مستثمر الطبقة الثانية" : "L2 Transfer",
                      trigger: isAr ? "بدء مرحلة التطوير" : "On Phase 1 development start",
                      price: `$${config.l1ExitPriceCap}/sqm`,
                      color: "#2563eb",
                      desc: isAr
                        ? "مستثمر الطبقة الثانية يدفع لمستثمر الطبقة الأولى مقابل الأرض ضمن إجمالي تكلفة التطوير"
                        : "L2 investor pays L1 for land as part of the total development cost package",
                    },
                    {
                      name: isAr ? "الاسترداد المُعجَّل" : "Accelerated Buyout",
                      trigger: isAr ? "خلال السنة الأولى" : "Within Year 1",
                      price: isAr ? `${fmt$(config.l1ExitPriceCap * config.landPerVilla * config.l1InvestorShare)} + ١٠%` : `${fmt$(config.l1ExitPriceCap * config.landPerVilla * config.l1InvestorShare)} + 10%`,
                      color: "#059669",
                      desc: isAr
                        ? "خيار الاسترداد المُعجَّل متاح للمالك في السنة الأولى بعلاوة ١٠٪"
                        : "Landowner may redeem L1 stake within Year 1 at 10% premium over exit cap",
                    },
                    {
                      name: isAr ? "بيع لطرف ثالث" : "Third-Party Sale",
                      trigger: isAr ? "بعد ٣ سنوات" : "After Year 3",
                      price: isAr ? "سعر السوق أو سقف الخروج" : "Market or exit cap",
                      color: "#d97706",
                      desc: isAr
                        ? "بعد انتهاء فترة الاحتجاز، يحق لمستثمر الطبقة الأولى نقل حصته لطرف ثالث موافق عليه"
                        : "After lock-up, L1 investors may transfer stake to approved third-party buyer",
                    },
                  ].map((mech) => (
                    <div
                      key={mech.name}
                      className="rounded-xl p-4 border"
                      style={{ borderColor: mech.color + "30", background: mech.color + "06" }}
                    >
                      <div className="text-xs font-bold mb-1" style={{ color: mech.color }}>{mech.name}</div>
                      <div className="text-xs text-gray-500 mb-2">{mech.trigger}</div>
                      <div className="text-sm font-bold text-gray-800 mb-1">{mech.price}</div>
                      <div className="text-xs text-gray-500 leading-relaxed">{mech.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* ── Section 2: Layer 2 — Villa Development ──────────────── */}
            <Section
              title={t("term_sheet_l2_section")}
              subtitle={isAr ? "مشاركة المستثمر في تمويل وتطوير الفلل" : "Investor participation in villa construction financing and development"}
              accentColor="#f97316"
              defaultOpen
            >
              <dl className="mt-2 divide-y divide-gray-50">
                <DefRow isRTL={isRTL}
                  label={isAr ? "نطاق العمل" : "Scope"}
                  value={isAr
                    ? `المرحلة الأولى — ${config.investorFundedVillas} فيلا (${config.minVillasToBuild} فيلا حدّ أدنى)`
                    : `Phase 1 — ${config.investorFundedVillas} villas (${config.minVillasToBuild} villa minimum commitment)`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "مساحة البناء" : "Construction Area"}
                  value={`${config.buaPerVilla} sqm BUA per villa`}
                  note={isAr ? `${config.buaPerVilla * config.villasPerPlot} م² لكل قطعة` : `${config.buaPerVilla * config.villasPerPlot} sqm per plot (${config.villasPerPlot} villas)`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "هيكل تمويل التشييد" : "Construction Funding"}
                  value={isAr
                    ? `${fmtPct(config.cashPctOfConstruction)} نقداً + ${fmtPct(1 - config.cashPctOfConstruction)} تمويل (من التشييد فقط)`
                    : `${fmtPct(config.cashPctOfConstruction)} cash + ${fmtPct(1 - config.cashPctOfConstruction)} financing (on construction only)`}
                  highlight
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "النقد المطلوب لكل فيلا" : "Cash Required / Villa"}
                  value={fmt$(l2Cash)}
                  highlight
                  note={isAr
                    ? `${fmt$(constructionCost * config.cashPctOfConstruction)} تشييد + ${fmt$(softCost)} تكاليف نعمة`
                    : `${fmt$(constructionCost * config.cashPctOfConstruction)} construction + ${fmt$(softCost)} soft costs`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "تكلفة التشييد" : "Construction Cost"}
                  value={`$${config.constructionCostSqm}/sqm`}
                  note={isAr ? `${fmt$(constructionCost)} لكل فيلا` : `${fmt$(constructionCost)} per villa total`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "سعر البيع المُقدَّر" : "Projected Selling Price"}
                  value={`$${config.sellingPriceSqm}/sqm`}
                  note={isAr ? `${fmt$(revenue)} لكل فيلا` : `${fmt$(revenue)} per villa`}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "توزيع الأرباح" : "Profit Share"}
                  value={isAr
                    ? `المستثمر ${fmtPct(config.profitSplitInvestor)} / المالك ${fmtPct(config.profitSplitOwner)} (بعد استرداد رأس المال)`
                    : `Investor ${fmtPct(config.profitSplitInvestor)} / Owner ${fmtPct(config.profitSplitOwner)} (after capital return)`}
                  highlight
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "عائد الأولوية" : "Priority Return"}
                  value={config.priorityEnabled
                    ? isAr
                      ? `${fmtPct(config.priorityReturnPct)} من رأس المال المُستثمَر قبل التوزيع`
                      : `${fmtPct(config.priorityReturnPct)} of invested capital before split`
                    : isAr ? "غير مُفعَّل في هذا الطرح" : "Not activated in this offering"}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "الاستمرار التلقائي" : "Auto-Continuation"}
                  value={isAr
                    ? "لا يوجد — يتطلب موافقة صريحة لكل مرحلة"
                    : "None — explicit re-commitment required for each phase"}
                  note={isAr ? "يمكن للمستثمر الخروج بعد المرحلة الأولى" : "Investor may exit after Phase 1"}
                />
                <DefRow isRTL={isRTL}
                  label={isAr ? "الجدول الزمني" : "Timeline"}
                  value={isAr ? `${config.l2Timeline} سنوات (المرحلة الأولى)` : `${config.l2Timeline} years (Phase 1)`}
                />
              </dl>
            </Section>

            {/* ── Section 3: Phased Land Pricing ──────────────────────── */}
            <Section
              title={t("term_sheet_phased_pricing")}
              subtitle={isAr ? "تصاعد أسعار الأرض يُرسّخ ميزة الدخول المبكر" : "Escalating land prices lock in the early-entry advantage"}
              accentColor="#059669"
              defaultOpen={false}
            >
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {isAr ? "المرحلة" : "Phase"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {isAr ? "سعر الأرض" : "Land Price"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {isAr ? "ربح الفيلا" : "Villa Profit"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {isAr ? "عائد المستثمر" : "Investor ROI"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {phasedPricing.map((row, idx) => (
                      <tr key={row.phase} className={idx === 0 ? "bg-green-50" : "bg-white"}>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {isAr ? `المرحلة ${row.phase}` : `Phase ${row.phase}`}
                          {idx === 0 && (
                            <span className="ml-2 text-xs text-green-700 font-normal">
                              ({isAr ? "أفضل سعر" : "Best price"})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">
                          ${row.landPrice}/sqm
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-dh-green">
                          {fmt$(row.villaProfit)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-dh-green">
                          {fmtPct(row.investorROI)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                {isAr
                  ? "* تعكس أسعار المراحل الأولى ميزة الدخول المبكر. أسعار المرحلتين الثانية والثالثة تقديرية وقابلة للتحديث."
                  : "* Phase 1 price reflects early-entry advantage. Phase 2 and 3 prices are indicative and subject to revision."}
              </p>
            </Section>

            {/* ── Section 4: Investor Protections ─────────────────────── */}
            <Section
              title={t("term_sheet_protections")}
              subtitle={isAr ? "الضمانات التعاقدية لحماية مصالح المستثمر" : "Contractual safeguards protecting investor interests"}
              accentColor="#dc2626"
              defaultOpen
            >
              <div className="mt-2 divide-y divide-gray-50">
                <ProtectionItem
                  icon="🔒"
                  title={isAr ? "أولوية استرداد رأس المال" : "Capital Recovery Priority"}
                  desc={isAr
                    ? "يُسترَدّ النقد المُستثمَر (تكاليف التشييد + التكاليف الناعمة) من عائدات البيع قبل توزيع أي أرباح."
                    : "Invested cash (construction + soft costs) is recovered from villa sale proceeds before any profit distribution."}
                />
                <ProtectionItem
                  icon="📋"
                  title={isAr ? "عدم الاستمرار التلقائي" : "No Forced Continuation"}
                  desc={isAr
                    ? "لا يُلزَم المستثمر بالمشاركة في أي مرحلة لاحقة. الخروج النظيف بعد المرحلة الأولى حق مكفول."
                    : "Investor is not obligated to participate in subsequent phases. Clean exit after Phase 1 is a guaranteed right."}
                />
                <ProtectionItem
                  icon="📐"
                  title={isAr ? "مرساة السعر الثابتة" : "Fixed Price Anchors"}
                  desc={isAr
                    ? `تكلفة التشييد مثبّتة عند $${config.constructionCostSqm}/م² و سعر خروج الطبقة الأولى مُسقَّف عند $${config.l1ExitPriceCap}/م². لا تغيير من طرف واحد.`
                    : `Construction cost fixed at $${config.constructionCostSqm}/sqm and L1 exit capped at $${config.l1ExitPriceCap}/sqm. No unilateral modification.`}
                />
                <ProtectionItem
                  icon="🏛️"
                  title={isAr ? "تسجيل حصة الأرض" : "Registered Land Stake (L1)"}
                  desc={isAr
                    ? "تُسجَّل حصة مستثمر الطبقة الأولى في السجلات العقارية الرسمية في لبنان لضمان وجود رهن على الأصل."
                    : "L1 investor's land stake is registered in Lebanon's official land registry, creating a secured lien on the asset."}
                />
                <ProtectionItem
                  icon="📊"
                  title={isAr ? "الشفافية المالية" : "Financial Transparency"}
                  desc={isAr
                    ? "يحق للمستثمر الاطلاع على تقارير مالية ربعية شاملة أرقام البناء الفعلية وعائدات البيع وحالة التوزيع."
                    : "Investor receives quarterly financial reports including actual construction figures, sale proceeds, and distribution status."}
                />
                <ProtectionItem
                  icon="⚖️"
                  title={isAr ? "حل النزاعات" : "Dispute Resolution"}
                  desc={isAr
                    ? "تخضع النزاعات لآلية تحكيم ثنائي، وعند الفشل تُحال إلى التحكيم التجاري الدولي وفق قواعد LCIA."
                    : "Disputes subject to bilateral mediation; failing that, referred to international commercial arbitration under LCIA rules."}
                />
                <ProtectionItem
                  icon="🔑"
                  title={isAr ? "حق الرفض الأول" : "Right of First Refusal"}
                  desc={isAr
                    ? "يحق لمستثمري الطبقة الأولى الأولوية في شراء أي حصص إضافية أو مراكز مالية مستقبلية."
                    : "L1 investors retain ROFR on any additional land stakes or future capital positions offered by the landowner."}
                />
                <ProtectionItem
                  icon="💰"
                  title={isAr ? "جدول صرف واضح" : "Clear Disbursement Schedule"}
                  desc={isAr
                    ? "تُوزَّع عائدات كل فيلا مباشرة عند إتمام البيع — لا احتجاز للأموال ولا تعقيدات بنيوية."
                    : "Each villa's proceeds are distributed directly upon sale completion — no fund pooling or structural complexity."}
                />
              </div>
            </Section>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-7 py-5">
              <p className="text-xs text-gray-400 leading-relaxed">
                {isAr
                  ? "هذه النشرة للأغراض المعلوماتية فقط وليست عرضاً عاماً للاكتتاب. الأرقام تقديرية مستندة إلى افتراضات السوق الحالية وقابلة للتحديث. يُنصح الراغبون في الاستثمار باستشارة مستشارهم القانوني والمالي قبل اتخاذ أي قرار."
                  : "This term sheet is for informational purposes only and does not constitute a public offering. Figures are indicative based on current market assumptions and subject to revision. Prospective investors are advised to consult their legal and financial advisors before making any investment decision."}
              </p>
              <p className="text-xs text-gray-300 mt-2">
                {isAr ? "ديدة هيلز — كورة، لبنان · ٢٠٢٥" : "Deddeh Hills — Koura, Lebanon · 2025"}
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
