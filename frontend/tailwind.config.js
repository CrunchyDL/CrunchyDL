/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f1115",
        foreground: "#ffffff",
        primary: "#fca311", // Crunchyroll-ish orange
        secondary: "#1a1d23",
        accent: "#3a3f4b",
      },
    },
  },
  plugins: [],
}
