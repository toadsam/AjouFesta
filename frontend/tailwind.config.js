/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#0f766e',
        accent: '#f59e0b',
      },
      boxShadow: {
        app: '0 24px 48px -24px rgba(15, 23, 42, 0.45)',
      },
    },
  },
  plugins: [],
};

