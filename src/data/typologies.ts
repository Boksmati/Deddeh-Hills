export type TypologyKey = "twin_villa" | "villa_2f" | "villa_3f" | "apartments";

export const TYPOLOGY_KEYS: TypologyKey[] = ["twin_villa", "villa_2f", "villa_3f", "apartments"];

export const TYPOLOGY_META: Record<TypologyKey, { label: string; labelAr: string; color: string }> = {
  twin_villa: { label: "Twin Villa", labelAr: "فيلا مزدوجة", color: "#1E88E5" },
  villa_2f:   { label: "Villa 2F",   labelAr: "فيلا طابقين", color: "#43A047" },
  villa_3f:   { label: "Villa 3F",   labelAr: "فيلا 3 طوابق", color: "#F4511E" },
  apartments: { label: "Apartments", labelAr: "شقق", color: "#FDD835" },
};
