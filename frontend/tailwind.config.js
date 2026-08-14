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
          50: '#f0f4ff',
          100: '#e0e8ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
        fb: {
          blue: '#1877F2',
          hover: '#166fe5',
        },
        ig: {
          pink: '#E1306C',
          purple: '#833AB4',
          orange: '#F56040',
        }
      },
    },
  },
  plugins: [],
}
