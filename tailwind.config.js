// `context/` and `lib/` are scanned too: they are part of the same component tree in
// practice, and a class added there that Tailwind never sees renders as nothing — with no
// error, just a silently unstyled element.
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './context/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
