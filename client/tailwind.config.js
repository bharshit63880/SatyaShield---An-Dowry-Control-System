/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f8fd',
          100: '#e8eff8',
          200: '#d6e1f1',
          300: '#b8c9e4',
          400: '#8aa8d2',
          500: '#6286bf',
          600: '#496ba4',
          700: '#395284',
          800: '#2d436b',
          900: '#1d2c47',
          950: '#0b1630'
        },
        accent: {
          50: '#effcfb',
          100: '#d8f6f2',
          200: '#acebe4',
          300: '#73ddd4',
          400: '#36c5bc',
          500: '#18aaa2',
          600: '#128783',
          700: '#136b69'
        },
        trust: {
          50: '#eef8ff',
          100: '#dbefff',
          200: '#bfe3ff',
          300: '#95d1ff',
          400: '#63b5fb',
          500: '#3d96ef'
        }
      },
      boxShadow: {
        panel: '0 24px 80px rgba(15, 28, 61, 0.12)',
        float: '0 32px 90px rgba(12, 22, 48, 0.18)'
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Segoe UI"', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif']
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(rgba(29,44,71,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(29,44,71,0.07) 1px, transparent 1px)'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        rise: 'rise 700ms ease-out both',
        shimmer: 'shimmer 2.6s linear infinite'
      }
    }
  },
  plugins: []
};
