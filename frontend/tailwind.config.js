/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-background': '#F9F9F9',
        'brand-accent': '#8A9A5B',
        'brand-text': '#333333',
        'brand-primary': '#8A9A5B',
        'brand-secondary': '#A9A9A9',
        'brand-light-accent': '#E9EEDF',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
