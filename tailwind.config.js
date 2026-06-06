/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terracotta: {
          50: '#fdf5f0',
          100: '#fae8dc',
          200: '#f5cfb8',
          300: '#eeaf8a',
          400: '#e5845a',
          500: '#d96438',
          600: '#c44e27',
          700: '#a33c21',
          800: '#863222',
          900: '#6e2d21',
          950: '#3c1410',
        },
        cream: {
          50: '#fefcf8',
          100: '#fdf7ef',
          200: '#faeedd',
          300: '#f5e0c3',
          400: '#edcba0',
          500: '#e3b478',
        },
        bark: {
          700: '#5c2d1e',
          800: '#4a2318',
          900: '#3a1c12',
          950: '#2a1209',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        script: ['"Great Vibes"', 'cursive'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-scale': 'pulseScale 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseScale: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
