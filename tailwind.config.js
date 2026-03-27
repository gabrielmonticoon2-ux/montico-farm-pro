module.exports = {
  content: ["./App.{js,jsx}", "./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary:  { DEFAULT: "#1B4332", light: "#2D6A4F", dark: "#081C15" },
        accent:   { DEFAULT: "#D4A017", light: "#F0BB4F", dark: "#A67C00" },
        surface:  { DEFAULT: "#F8F6F1", card: "#FFFFFF",  dark: "#1A1A1A" },
        danger:   "#C0392B",
        success:  "#27AE60",
        muted:    "#6B7280",
      },
      fontFamily: {
        sans:   ["Inter_400Regular"],
        medium: ["Inter_500Medium"],
        bold:   ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
