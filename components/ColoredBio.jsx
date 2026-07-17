const KEYWORD_COLOR = {
  LEGIT: "text-legit",
  IFFY: "text-situational",
  "SKIP IT": "text-trash",
};

export default function ColoredBio({ text, className }) {
  if (!text) return null;
  const parts = text.split(/(\bLEGIT\b|\bIFFY\b|\bSKIP IT\b)/g);

  return (
    <p className={className}>
      {parts.map((part, i) =>
        KEYWORD_COLOR[part] ? (
          <span key={i} className={`${KEYWORD_COLOR[part]} font-semibold`}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}
