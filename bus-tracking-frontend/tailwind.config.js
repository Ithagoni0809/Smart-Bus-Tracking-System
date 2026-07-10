/** @type {import('tailwindcss').Config} */
export default {
  // Tell Tailwind WHERE to look for class names so unused styles are purged in production
  content: ['./index.html', './src/**/*.{js,jsx}'],

  // darkMode: 'class' means dark mode is toggled by adding the 'dark' class
  // to the <html> element — we control this via our ThemeContext.
  darkMode: 'class',

  theme: {
    extend: {
      // Custom brand colours matching the SRS design palette
      colors: {
        brand: {
          navy:    '#1B3F7A',   // Primary — deep navy (headings, sidebar)
          blue:    '#2E86AB',   // Secondary — teal blue (buttons, links)
          amber:   '#F5A623',   // Accent — amber (CTAs, warnings)
          light:   '#EBF2FA',   // Light background
          midblue: '#D0E4F2',   // Table headers, cards
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Custom animation for the bus marker smooth movement on the map
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: 0 },
          to:   { transform: 'translateX(0)',    opacity: 1 },
        },
        'fade-in': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-slow':      'pulse-slow 2s ease-in-out infinite',
        'slide-in-right':  'slide-in-right 0.3s ease-out',
        'fade-in':         'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
