import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#f5f7fb",
        calm: "#476a6f",
        sand: "#e9dfd0",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(17, 24, 39, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
