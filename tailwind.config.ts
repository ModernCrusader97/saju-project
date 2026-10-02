import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        doryeong: {
          navy: "#1E2A4A",
          navyDark: "#141D33",
          navyLight: "#2A3A5E",
          ivory: "#FAF6EC",
          ivoryCard: "#FFFDF8",
          ivoryDark: "#F4EBD8",
          gold: "#C8AA64",
          goldDark: "#A6863C",
          goldLight: "#DFCA94",
          border: "#E0D5BC",
          textDark: "#18140D",
          textMuted: "#6B5D48",
          textSubtle: "#8C7D68",
          roseBg: "#F7E2EB",
          roseText: "#A93E75",
          purpleBg: "#E8D8ED",
          purpleText: "#674875",
          blueBg: "#E1E5EE",
          blueText: "#405070",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Noto Serif KR", "Batang", "serif"],
        sans: ["var(--font-sans)", "Pretendard", "sans-serif"],
      },
      boxShadow: {
        doryeong: "0 12px 30px rgba(30, 42, 74, 0.12)",
        card: "0 8px 24px rgba(40, 30, 15, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
