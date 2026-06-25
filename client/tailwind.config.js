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
        // Dark theme colors
        dark: {
          50: '#1a1a2e',
          100: '#16213e',
          200: '#0f3460',
          300: '#0d1b2a',
          400: '#0a0f1e',
          500: '#070b14',
          600: '#050810',
          700: '#03050b',
          800: '#020307',
          900: '#010204',
          950: '#000102'
        },
        cyber: {
          50: '#e6fff9',
          100: '#b3ffe9',
          200: '#80ffd8',
          300: '#4dffc8',
          400: '#1affb7',
          500: '#00e5cc',
          600: '#00b8a3',
          700: '#008a7a',
          800: '#005c52',
          900: '#002e29'
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
        },
        neon: {
          green: '#00ff88',
          teal: '#00e5cc',
          purple: '#7c3aed',
          blue: '#3b82f6'
        }
      },
      boxShadow: {
        panel: '0 24px 80px rgba(15, 28, 61, 0.12)',
        float: '0 32px 90px rgba(12, 22, 48, 0.18)',
        cyber: '0 0 20px rgba(0, 229, 204, 0.3), 0 0 60px rgba(0, 229, 204, 0.1)',
        'cyber-sm': '0 0 10px rgba(0, 229, 204, 0.2)',
        'cyber-lg': '0 0 40px rgba(0, 229, 204, 0.4), 0 0 80px rgba(0, 229, 204, 0.15)',
        'dark-card': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255,255,255,0.05)',
        'dark-panel': '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
      },
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', '"Segoe UI"', 'sans-serif'],
        display: ['"Inter"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace']
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(rgba(0,229,204,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,204,0.05) 1px, transparent 1px)',
        'cyber-gradient': 'linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 50%, #071217 100%)',
        'teal-gradient': 'linear-gradient(135deg, #00e5cc 0%, #00b8a3 100%)',
        'dark-surface': 'linear-gradient(180deg, #111827 0%, #0a0f1e 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        pulse_glow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,229,204,0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(0,229,204,0.6), 0 0 50px rgba(0,229,204,0.2)' }
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' }
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        rise: 'rise 800ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2.6s linear infinite',
        pulse_glow: 'pulse_glow 2s ease-in-out infinite',
        scan: 'scan 8s linear infinite',
        blink: 'blink 1s step-end infinite',
        float: 'float 3s ease-in-out infinite',
        fadeIn: 'fadeIn 600ms ease-out both',
        slideIn: 'slideIn 600ms ease-out both',
        countUp: 'countUp 800ms ease-out both'
      }
    }
  },
  plugins: []
};
