/** Design tokens: colours are CSS variables (light/dark in global.css), plus spacing, radius and type scale. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // "class", not "media": colours switch through the CSS variables in global.css (@media prefers-color-scheme),
  // never through `dark:` classes, so this setting changes nothing visible. With "media", NativeWind 4's web
  // runtime throws "Cannot manually set color scheme" in the dev server, where the CSS loads after the JS.
  // The native runtime ignores this setting.
  darkMode: "class",
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
        // "Catalog" language (src/ui/catalog.tsx; on trial on /targets).
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        dim: "rgb(var(--color-dim) / <alpha-value>)",
        rule: "rgb(var(--color-rule) / <alpha-value>)",
        "rule-strong": "rgb(var(--color-rule-strong) / <alpha-value>)",
        band: "rgb(var(--color-band) / <alpha-value>)",
        link: "rgb(var(--color-link) / <alpha-value>)",
        mark: "rgb(var(--color-mark) / <alpha-value>)",
        alert: "rgb(var(--color-alert) / <alpha-value>)",
      },
      borderRadius: { card: "14px", control: "10px" },
      spacing: { tap: "44px", gutter: "16px" },
      fontSize: {
        micro: ["11px", "14px"],
        caption: ["13px", "18px"],
        body: ["16px", "22px"],
        title: ["20px", "26px"],
        display: ["28px", "34px"],
      },
    },
  },
  plugins: [],
};
