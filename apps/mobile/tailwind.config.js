/** Design tokens: colours are CSS variables (light/dark in global.css), plus spacing, radius and type scale. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
      },
      borderRadius: { card: "14px", control: "10px" },
      spacing: { tap: "44px", gutter: "16px" },
      fontSize: {
        caption: ["13px", "18px"],
        body: ["16px", "22px"],
        title: ["20px", "26px"],
        display: ["28px", "34px"],
      },
    },
  },
  plugins: [],
};
