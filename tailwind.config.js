/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#000000',
          card: '#1C1C1E',
          cardElevated: '#2C2C2E',
          green: '#30D158',
          blue: '#0A84FF',
          orange: '#FF9F0A',
          pink: '#FF375F',
          purple: '#BF5AF2',
          yellow: '#FFD60A',
          subtext: '#8E8E93',
          border: 'rgba(255, 255, 255, 0.1)',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ]
      }
    },
  },
  plugins: [],
}
