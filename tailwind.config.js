/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        maroon: '#7a1f2d',
        saffron: '#d97706',
        gold: '#fbbf24',
        cream: '#fff7ed',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        serif: ['Noto Serif', 'serif'],
      },
      boxShadow: {
        divine: '0 10px 30px rgba(122, 31, 45, 0.12)',
      },
    },
  },
  plugins: [],
};
