/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81',
        },
        brand: {
          DEFAULT: '#5b5bd6', 50: '#f1f1ff', 100: '#e4e4ff', 200: '#ccccff',
          400: '#8181e9', 500: '#5b5bd6', 600: '#4d4dc4', 700: '#3f3fa8', 800: '#34348a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI Variable', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Inter', 'Segoe UI Variable', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
      boxShadow: {
        card: '0 12px 32px -20px rgb(76 78 185 / 0.28)',
        'card-hover': '0 18px 36px -22px rgb(79 70 229 / 0.38)',
        modal: '0 30px 90px -25px rgb(15 23 42 / 0.5)',
      },
    },
  },
  plugins: [],
}
