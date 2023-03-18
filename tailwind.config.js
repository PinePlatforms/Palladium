/** Palladium TailwindCSS Config */
module.exports = {
    content: ["./resources/*.ejs", "./resources/**/*.ejs", "./resources/**/**/*.ejs"],
    theme: {
      extend: {},
    },
    plugins: [
      require('@tailwindcss/forms'),
    ],
  }