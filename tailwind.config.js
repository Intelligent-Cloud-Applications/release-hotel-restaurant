const flowbite = require("flowbite-react/tailwind");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{jsx,js,tsx,ts}",flowbite.content(),],
  theme: {
    extend: {
      colors: {
        primaryColor: "var(--primary-color)",
        secondaryColor: "var(--secondary-color)",
        lightPrimaryColor: "var(--light-primary-color)",
        lightSecondaryColor: "var(--light-secondary-color)",
      },
      fontFamily: {
        "lora": ["Lora", "serif"],
        "roboto": ["Roboto", "sans-serif"],
        "open-sans": ["Open Sans", "sans-serif"],
        "montserrat": ["Montserrat", "sans-serif"],
      },
      screens: {
        max950: { max: '950px' },
        max980: { max: '980px' },
        max850: { max: '850px' },
        min536: { min: '536px' },
        min800: { min: '800px' },
        min1050: { min: '1050px' },
        max1008: { max: '1008px' },
        max478: { max: '478px' },
        max450: { max: '450px' },
        max406: { max: '406px' },
        max500: { max: '500px ' },
        max600: { max: '600px' },
        min600: { min: '600px' },
        max767: { max: "767px" },
        max900: { max: '900px' },
        max1050: { max: '1050px' },
        max1194: { max: '1194px' },
        max1350: { max: '1350px' },
        max1250: { max: '1250px' },
        max1920: { max: '1920px' },
        max1078: { max: '1078px' },
        max800: { max: '800px' },
        max536: { max: '536px' },
        xs: '1000px'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [
    flowbite.plugin(),
  ],
};
