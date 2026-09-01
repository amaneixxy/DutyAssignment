/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0F1720',
          900: '#151E2B',
          800: '#1E2A3A',
          700: '#2B3A4E',
          600: '#3E5169',
          500: '#57708C',
          400: '#7C93AC',
          300: '#A8BACC',
          200: '#D2DCE6',
          100: '#EAF0F5',
          50: '#F5F8FA'
        },
        brand: {
          50: '#EFF6FF',
          100: '#DCEBFF',
          200: '#B3D3FF',
          300: '#7FB3FF',
          400: '#4A8FFF',
          500: '#2568EB',
          600: '#1B4FC2',
          700: '#173F99',
          800: '#153374',
          900: '#122752'
        },
        amber: {
          500: '#D98A2B'
        },
        coral: {
          500: '#D9603B'
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 32, 0.06), 0 1px 1px rgba(15,23,32,0.04)'
      }
    }
  },
  plugins: []
}
