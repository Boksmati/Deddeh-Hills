export default function DhLogo({
  className,
  variant = "dark",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const textColor = variant === "light" ? "#ffffff" : "#374151";
  const subColor = variant === "light" ? "#d1fae5" : "#6b7280";

  return (
    <svg
      viewBox="0 0 180 56"
      className={className}
      aria-label="Deddeh Hills"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left leaf blade */}
      <path
        d="M26 38 C18 22, 28 4, 38 8 C34 18, 30 28, 26 38Z"
        fill="#2D6A4F"
      />
      {/* Right leaf blade */}
      <path
        d="M50 38 C58 22, 48 4, 38 8 C42 18, 46 28, 50 38Z"
        fill="#52B788"
      />
      {/* DEDDEH */}
      <text
        x="64"
        y="28"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="18"
        fill={textColor}
        letterSpacing="1"
      >
        DEDDEH
      </text>
      {/* HILLS */}
      <text
        x="64"
        y="46"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="14"
        fill="#2D6A4F"
        letterSpacing="3"
      >
        HILLS
      </text>
      {/* Koura tagline */}
      <text
        x="64"
        y="56"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="400"
        fontSize="8"
        fill={subColor}
        letterSpacing="1"
      >
        KOURA · LEBANON
      </text>
    </svg>
  );
}
