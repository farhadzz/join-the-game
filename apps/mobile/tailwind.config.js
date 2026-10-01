/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        home: { DEFAULT: '#2563eb', dark: '#60a5fa' },
        away: { DEFAULT: '#dc2626', dark: '#f87171' },
      },
    },
  },
  plugins: [],
};
