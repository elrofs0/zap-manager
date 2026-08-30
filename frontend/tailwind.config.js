/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#25D366',
          600: '#128C7E',
          700: '#075E54',
          800: '#054d44',
          900: '#042f2e',
        },
      },
    },
  },
  plugins: [],
};
