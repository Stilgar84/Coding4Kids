/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#2563eb',
          orange: '#ea580c',
          purple: '#9333ea',
          green: '#16a34a',
          red: '#dc2626'
        }
      }
    },
  },
  plugins: [],
}
