import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#11221f",
        mist: "#f5f0e8",
        tide: "#b7d8cf",
        pine: "#103b35",
        coral: "#f87060",
        gold: "#e2a93b"
      },
      boxShadow: {
        panel: "0 24px 80px rgba(16, 59, 53, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;

