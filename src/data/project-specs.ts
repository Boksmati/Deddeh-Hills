export interface SpecItem {
  label: string;
  labelAr: string;
  value: string;
  valueAr: string;
}

export interface ProjectSpecs {
  structure:  SpecItem[];
  flooring:   SpecItem[];
  kitchen:    SpecItem[];
  bathrooms:  SpecItem[];
  electrical: SpecItem[];
  energy:     SpecItem[];
  outdoor:    SpecItem[];
  amenities:  string[];
  amenitiesAr: string[];
}

export const DEFAULT_PROJECT_SPECS: ProjectSpecs = {
  structure: [
    {
      label:   "Structural System",
      labelAr: "النظام الإنشائي",
      value:   "Reinforced concrete frame",
      valueAr: "هيكل خرساني مسلح",
    },
    {
      label:   "Exterior Cladding",
      labelAr: "الكسوة الخارجية",
      value:   "Natural limestone – Mirosse quarry",
      valueAr: "حجر كلسي طبيعي – مقلع ميروس",
    },
    {
      label:   "Exterior Walls",
      labelAr: "الجدران الخارجية",
      value:   "40 cm double-skin with thermal break",
      valueAr: "جدار مزدوج 40 سم مع عازل حراري",
    },
    {
      label:   "Windows & Glazing",
      labelAr: "النوافذ والزجاج",
      value:   "Double-glazed aluminium with thermal break",
      valueAr: "ألمنيوم مزدوج الزجاج مع كسر حراري",
    },
    {
      label:   "Interior Doors",
      labelAr: "الأبواب الداخلية",
      value:   "Solid-core oak veneer, floor-to-ceiling",
      valueAr: "قلب صلب بقشرة بلوط، من الأرض للسقف",
    },
  ],

  flooring: [
    {
      label:   "Living & Dining",
      labelAr: "المعيشة والطعام",
      value:   "Large-format Italian marble (120 × 60 cm)",
      valueAr: "رخام إيطالي كبير الحجم (120 × 60 سم)",
    },
    {
      label:   "Bedrooms",
      labelAr: "غرف النوم",
      value:   "Engineered oak hardwood",
      valueAr: "خشب بلوط مهندس",
    },
    {
      label:   "Bathrooms",
      labelAr: "الحمامات",
      value:   "Rectified porcelain tile (60 × 60 cm)",
      valueAr: "بلاط خزفي معدّل (60 × 60 سم)",
    },
    {
      label:   "Terraces & Balconies",
      labelAr: "التراسات والشرفات",
      value:   "Anti-slip natural stone",
      valueAr: "حجر طبيعي مقاوم للانزلاق",
    },
    {
      label:   "Stairs",
      labelAr: "الدرج",
      value:   "Marble with steel & glass balustrade",
      valueAr: "رخام مع درابزين فولاذ وزجاج",
    },
  ],

  kitchen: [
    {
      label:   "Cabinetry",
      labelAr: "الخزائن",
      value:   "European lacquered handleless cabinets",
      valueAr: "خزائن أوروبية لاكيه بدون مقابض",
    },
    {
      label:   "Countertop",
      labelAr: "سطح العمل",
      value:   "Calacatta marble (2 cm, waterfall edge)",
      valueAr: "رخام كالاكاتا (2 سم، حافة شلالية)",
    },
    {
      label:   "Appliances",
      labelAr: "الأجهزة",
      value:   "Bosch Serie 8 built-in set (oven, hob, hood, dishwasher)",
      valueAr: "بوش سيري 8 مدمجة (فرن، موقد، شفاط، غسالة أطباق)",
    },
    {
      label:   "Sink & Faucet",
      labelAr: "الحوض والصنبور",
      value:   "Blanco undermount sink, Grohe mixer",
      valueAr: "حوض بلانكو تحت الرخام، خلاط جروهي",
    },
    {
      label:   "Island",
      labelAr: "الجزيرة",
      value:   "Open island with bar seating (where layout allows)",
      valueAr: "جزيرة مفتوحة مع مقاعد بار (حسب المساحة)",
    },
  ],

  bathrooms: [
    {
      label:   "Sanitaryware",
      labelAr: "الأدوات الصحية",
      value:   "Villeroy & Boch wall-hung suite",
      valueAr: "فيليروي وبوخ معلّق على الجدار",
    },
    {
      label:   "Fittings & Mixers",
      labelAr: "التركيبات والخلاطات",
      value:   "Grohe Essence series (brushed nickel)",
      valueAr: "جروهي إيسنس (نيكل مصقول)",
    },
    {
      label:   "Master Shower",
      labelAr: "دش الماستر",
      value:   "Walk-in frameless glass, rain head + hand shower",
      valueAr: "دش مشي زجاج بدون إطار، رأس مطر + يدوي",
    },
    {
      label:   "Master Bathtub",
      labelAr: "حوض الماستر",
      value:   "Freestanding resin soaking tub",
      valueAr: "حوض استرخاء راتينج حر الوضع",
    },
    {
      label:   "Mirrors & Vanity",
      labelAr: "المرايا والتصميم",
      value:   "Backlit LED mirror, floating vanity unit",
      valueAr: "مرآة LED خلفية الإضاءة، وحدة عائمة",
    },
  ],

  electrical: [
    {
      label:   "Switches & Sockets",
      labelAr: "المفاتيح والمقابس",
      value:   "Schneider Electric Odace (white/chrome)",
      valueAr: "شنايدر إلكتريك أوداس (أبيض/كروم)",
    },
    {
      label:   "Smart Home Readiness",
      labelAr: "جاهزية المنزل الذكي",
      value:   "Pre-wired KNX-ready infrastructure",
      valueAr: "بنية تحتية جاهزة لـ KNX",
    },
    {
      label:   "Lighting",
      labelAr: "الإضاءة",
      value:   "LED recessed fixtures throughout + feature pendants",
      valueAr: "إضاءة LED غائرة في كل الأماكن + تدليات مميزة",
    },
    {
      label:   "Internet & TV",
      labelAr: "إنترنت وتلفاز",
      value:   "Fibre optic pre-cabling, HDMI to each room",
      valueAr: "تمديد مسبق للألياف الضوئية، HDMI لكل غرفة",
    },
    {
      label:   "Video Intercom",
      labelAr: "انتركم فيديو",
      value:   "IP video doorbell + app-enabled entry",
      valueAr: "جرس فيديو IP + دخول عبر التطبيق",
    },
  ],

  energy: [
    {
      label:   "Solar PV System",
      labelAr: "نظام الطاقة الشمسية",
      value:   "10 kW rooftop photovoltaic array",
      valueAr: "مصفوفة فوتوفولطية سطحية 10 كيلوواط",
    },
    {
      label:   "Solar Water Heating",
      labelAr: "تسخين المياه بالطاقة الشمسية",
      value:   "300 L solar thermal + electric backup",
      valueAr: "300 لتر شمسي حراري + احتياطي كهربائي",
    },
    {
      label:   "Wall Insulation",
      labelAr: "عزل الجدران",
      value:   "10 cm polyurethane spray foam",
      valueAr: "رغوة بوليورتان 10 سم",
    },
    {
      label:   "Roof Insulation",
      labelAr: "عزل السقف",
      value:   "15 cm XPS board + waterproofing membrane",
      valueAr: "لوح XPS 15 سم + غشاء عازل للماء",
    },
    {
      label:   "Generator Backup",
      labelAr: "مولد احتياطي",
      value:   "Community diesel generator with ATS switchover",
      valueAr: "مولد مجتمعي ديزل مع تبديل تلقائي ATS",
    },
  ],

  outdoor: [
    {
      label:   "Landscaping",
      labelAr: "تنسيق الحدائق",
      value:   "Native stone terracing with Mediterranean planting",
      valueAr: "تجميل حجري محلي مع نباتات متوسطية",
    },
    {
      label:   "Private Pool",
      labelAr: "مسبح خاص",
      value:   "Plunge pool per villa (heated, overflow finish)",
      valueAr: "مسبح صغير لكل فيلا (مدفأ، حافة انسيابية)",
    },
    {
      label:   "Boundary Walls",
      labelAr: "جدران الحدود",
      value:   "Natural stone walls matching exterior cladding",
      valueAr: "جدران حجر طبيعي متطابقة مع الكسوة الخارجية",
    },
    {
      label:   "Driveway",
      labelAr: "ممر السيارات",
      value:   "Cobblestone sett paving, private gate",
      valueAr: "بلاط حجر مكعب، بوابة خاصة",
    },
    {
      label:   "Outdoor Lighting",
      labelAr: "إضاءة خارجية",
      value:   "LED landscape path & accent lighting",
      valueAr: "LED مسارات + إضاءة تمييزية خارجية",
    },
  ],

  amenities: [
    "Gated community with 24/7 security & CCTV",
    "Concierge & property management services",
    "Fibre optic internet throughout the development",
    "Underground parking per unit (OUG)",
    "Panoramic mountain & valley views",
    "Community clubhouse & lounge",
    "Infinity-edge community pool",
    "Children's play area",
    "EV charging stations in parking",
    "Landscaped walking trails",
  ],

  amenitiesAr: [
    "مجمع مسوّر مع أمن وكاميرات مراقبة 24/7",
    "خدمات كونسيرج وإدارة عقارات",
    "إنترنت فائق السرعة بالألياف الضوئية في المشروع",
    "موقف سيارات تحت الأرض لكل وحدة (OUG)",
    "إطلالات بانورامية على الجبال والوادي",
    "نادي مجتمعي وصالة استقبال",
    "مسبح مجتمعي بحافة لانهائية",
    "منطقة ألعاب للأطفال",
    "محطات شحن السيارات الكهربائية",
    "مسارات مشي منسقة",
  ],
};
