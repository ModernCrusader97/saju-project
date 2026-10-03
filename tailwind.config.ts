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
          navy: "#173C48",
          navyDark: "#0D2631",
          navyLight: "#285762",
          ivory: "#F4F7F8",
          ivoryCard: "#FFFFFF",
          ivoryDark: "#E7EFF1",
          gold: "#527645",
          goldDark: "#355C3B",
          goldLight: "#CFEA9C",
          border: "#CEDDE1",
          textDark: "#142E38",
          textMuted: "#516873",
          textSubtle: "#617B85",
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
