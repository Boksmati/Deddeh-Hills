import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dh: {
          green: "#2D5A27",    // deep forest green — text accents, borders
          hills: "#78BF42",    // brand green — primary CTA, map highlights
          light: "#95CC58",    // light green — accent text on dark backgrounds
          dark: "#1A3810",     // dark forest — hero backgrounds, header
          slate: "#3A4A5C",
          cream: "#F5F0E8",
          bg: "#F4F9EF",       // page background
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        serif: ["Playfair Display", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
