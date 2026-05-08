/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Epilogue', 'sans-serif'],
        display: ['Fraunces', 'serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        jade:      '#AEB8A0',
        jadeMid:   '#8A9678',
        jadeDark:  '#6B7A5C',
        jadeDeep:  '#4A5640',
        stone:     '#F4F2ED',
        stoneMid:  '#E8E4DC',
        stoneDark: '#D4CEC2',
        moss:      '#3A4030',
        ink:       '#242820',
        surface:   '#ECEAE3',
        surface2:  '#E0DDD4',
        border:    'rgba(74,86,64,0.12)',
        border2:   'rgba(74,86,64,0.2)',
        muted:     '#7A7D6E',
        success:   '#4A7A58',
        danger:    '#8B4A3C',
        amber:     '#8B6A2C',
        bark:      '#6B5240',
      },
      animation: {
        'fade-up':  'fadeUp 0.5s ease forwards',
        'sway':     'sway 8s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { from:{opacity:'0',transform:'translateY(14px)'}, to:{opacity:'1',transform:'translateY(0)'} },
        sway:   { '0%,100%':{transform:'rotate(-0.5deg)'}, '50%':{transform:'rotate(0.5deg)'} },
      },
      boxShadow: {
        card:      '0 2px 16px rgba(36,40,32,0.08), 0 1px 3px rgba(36,40,32,0.06)',
        cardHover: '0 6px 28px rgba(36,40,32,0.14), 0 2px 6px rgba(36,40,32,0.08)',
        pressed:   'inset 0 1px 3px rgba(36,40,32,0.1)',
      },
    },
  },
  plugins: [],
}
