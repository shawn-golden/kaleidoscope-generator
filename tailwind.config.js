/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#efeae2",
        panel: "#fbf8f3",
        ink: "#1b1714",
        muted: "#6e675f",
        line: "#e4ddd2",
        accent: "#0f6e56",
        well: "#cfc6b8",
      },
      fontFamily: {
        sans: ["Outfit", "ui-sans-serif", "system-ui"],
        serif: ["Fraunces", "ui-serif", "Georgia"],
      },
      boxShadow: {
        board: "0 18px 50px rgba(40, 28, 16, 0.18)",
      },
    },
  },
  plugins: [],
};
