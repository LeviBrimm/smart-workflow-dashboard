/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#5c3d2e',
        ink: '#1f1c1a',
        sand: '#f5f1eb',
        cocoa: '#7a4f36',
      },
    },
  },
  plugins: [],
};
