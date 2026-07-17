export const BELTS = [
  { key: "black", color: "#111111", border: true },
  { key: "brown", color: "#5C3317" },
  { key: "purple", color: "#6B21A8" },
  { key: "blue", color: "#2563EB" },
  { key: "white", color: "#F5F5F0", border: true },
];

export function beltColor(key) {
  return BELTS.find((b) => b.key === key)?.color || "#666666";
}
