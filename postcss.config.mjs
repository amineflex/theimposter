/**
 * Tailwind CSS v4 : le plugin PostCSS vit dans son propre paquet, et le
 * préfixage vendeur est géré nativement (plus besoin d'autoprefixer).
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
