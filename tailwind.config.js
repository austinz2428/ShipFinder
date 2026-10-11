/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: '#e9eaec',
          card: '#f4f5f7',
          border: '#d0d4dc',
          borderDark: '#b8bcc6',
          text: '#111317',
          muted: '#626773',
          dim: '#8f95a3',
          orange: '#ff4d15',
          orangeSoft: '#fff0eb',
          orangeBorder: '#ffb299',
          alertCrit: '#ff4d15',
          alertWarn: '#e07a14',
          alertInfo: '#6c757d'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
