/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        mat: "var(--color-bg)",
        chalk: "var(--color-text)",
        legit: "var(--color-legit)",
        situational: "var(--color-situational)",
        trash: "var(--color-trash)",
        line: "var(--color-line)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        mono: "var(--font-mono)",
      },
    },
  },
  plugins: [],
};
