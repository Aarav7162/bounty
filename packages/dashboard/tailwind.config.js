/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#090d16",
          800: "#0f172a",
          700: "#1e293b",
          600: "#334155"
        },
        cyan: {
          400: "#38bdf8",
          500: "#0ea5e9"
        },
        gold: {
          400: "#fbbf24",
          500: "#f59e0b"
        }
      }
    },
  },
  plugins: [],
}

