import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        coke: {
          red: "#F40009",
          dark: "#1A1A1A",
          gray: "#F4F4F5",
        },
        // Data-encoding palette, deliberately separate from the brand palette
        // above. Coke red is the UI accent (nav, active chips, focus ring);
        // these three carry meaning inside the tables and must not double as
        // brand colours, or "below average" would read as a Coke highlight.
        /**
         * Coca-Cola's brand system is three colours: red, black, white. This
         * palette adds nothing to it — every value below is Coke Red #F40009,
         * a neutral grey, or a near-black. The same red the stills project
         * interpolates its heatmap toward.
         *
         * Because red carries every "more / above / selected" meaning, the
         * opposite direction has to be ACHROMATIC rather than a second hue.
         * Red-vs-grey separates as cleanly as red-vs-teal did and stays on
         * brand; a second hue would not.
         */
        coke: {
          red: "rgb(var(--brand) / <alpha-value>)",       // Coca-Cola Red
          deep: "rgb(var(--brand-deep) / <alpha-value>)", // pressed / secondary red
          black: "#1A1A1A", // Coke black — section grounds
          grey: "#6B6B6B",
        },
        viz: {
          pos: "rgb(var(--brand) / <alpha-value>)", // above the reference, emphasis, selected
          neg: "#4A4A4A", // below the reference — charcoal, never a hue
          seq: "rgb(var(--brand) / <alpha-value>)", // single-direction intensity
          bar: "#9A9A9A", // unemphasised bars, ghost/reference marks
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  // typography drives the `prose` classes the chat uses to render the agent's
  // markdown — it writes tables, and a bare <table> in Tailwind has no borders.
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
