import type { Config } from 'tailwindcss'

/**
 * Thème Tailwind adossé aux tokens CSS de `globals.css`.
 *
 * Aucune couleur, ombre ou durée n'est écrite en dur dans les composants.
 * Volontairement : aucune ombre floue, aucun gradient, aucun effet de lueur.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      // Le jeu reste dans un cadre central, même sur grand écran.
      screens: { sm: '100%', md: '600px', lg: '640px', xl: '640px', '2xl': '640px' },
    },
    extend: {
      colors: {
        cream: 'hsl(var(--cream))',
        'cream-deep': 'hsl(var(--cream-deep))',
        paper: 'hsl(var(--paper))',
        ink: 'hsl(var(--ink))',
        'ink-soft': 'hsl(var(--ink-soft))',

        // Palette d'accent (aplats)
        red: 'hsl(var(--red))',
        yellow: 'hsl(var(--yellow))',
        blue: 'hsl(var(--blue))',
        green: 'hsl(var(--green))',
        pink: 'hsl(var(--pink))',
        orange: 'hsl(var(--orange))',
        purple: 'hsl(var(--purple))',

        // Tokens sémantiques (primitives shadcn/ui)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      spacing: {
        13: '3.25rem',
        15: '3.75rem',
        17: '4.25rem',
      },
      borderRadius: {
        sm: '0.5rem',
        md: '0.875rem',
        lg: 'var(--radius)',
        blob: 'var(--radius-blob)',
        capsule: 'var(--radius-capsule)',
      },
      borderWidth: {
        3: '3px',
        5: '4px',
      },
      boxShadow: {
        // Ombres dures uniquement.
        toy: 'var(--shadow-sm)',
        'toy-md': 'var(--shadow-md)',
        'toy-lg': 'var(--shadow-lg)',
        'toy-card': 'var(--shadow-card)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        pop: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        tap: '100ms',
        fast: '160ms',
        base: '220ms',
        slow: '300ms',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '65%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        squash: {
          '0%': { transform: 'scaleX(1) scaleY(1)' },
          '35%': { transform: 'scaleX(1.08) scaleY(0.9)' },
          '70%': { transform: 'scaleX(0.97) scaleY(1.04)' },
          '100%': { transform: 'scaleX(1) scaleY(1)' },
        },
        'ring-pop': {
          '0%': { transform: 'scale(0.95)', opacity: '1' },
          '100%': { transform: 'scale(1.16)', opacity: '0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px) rotate(-1.5deg)' },
          '50%': { transform: 'translateX(5px) rotate(1.5deg)' },
          '75%': { transform: 'translateX(-3px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2.5deg)' },
          '50%': { transform: 'rotate(2.5deg)' },
        },
        bob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'confetti-fall': {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)' },
          '100%': { transform: 'translateY(105vh) rotate(420deg)' },
        },
      },
      animation: {
        'pop-in': 'pop-in var(--motion-base) var(--ease-pop) both',
        squash: 'squash var(--motion-base) ease-out',
        'ring-pop': 'ring-pop 1.1s ease-out infinite',
        shake: 'shake 300ms ease-in-out',
        wiggle: 'wiggle 2.2s ease-in-out infinite',
        bob: 'bob 2.4s ease-in-out infinite',
        'confetti-fall': 'confetti-fall 2.4s linear forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
