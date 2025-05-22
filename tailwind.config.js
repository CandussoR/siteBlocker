import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./ui/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily : {
        dancing: ["Dancing Script", "cursive"],
      }
    }
  },
  plugins: [daisyui],
}