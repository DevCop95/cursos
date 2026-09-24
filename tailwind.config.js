/** Dev101x — Tailwind (compilado con `npm run build:css`, sin CDN en producción) */
export default {
  content: ['./index.html', './js/**/*.js', './*/index.html', './scripts/*.mjs'],
  theme: {
    extend: {
      colors: {
        bg: '#f3f0ea',
        bg2: '#e9e5dd',
        surface: '#fdfcf9',
        ink: '#0c0d0e',
        ink2: '#282b29',
        muted: '#80857e',
        accent: '#005c38',
        accent2: '#003f27',
        line: '#d3cec5',
        // Paleta oscura de la terminal y paneles técnicos
        term: {
          DEFAULT: '#0e1013',
          2: '#161b22',
          3: '#1e2329',
          4: '#111418',
          deep: '#090a0c',
          line: '#30363d'
        }
      },
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace']
      }
    }
  }
};
