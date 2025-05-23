import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./ui/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily : {
        dancing: ["Dancing Script", "cursive"],
      },
      colors: {
        default: "color-mix(in oklab, var(--color-base-content) 10%, transparent)"
      }
    }
  },
  plugins: [daisyui],
}