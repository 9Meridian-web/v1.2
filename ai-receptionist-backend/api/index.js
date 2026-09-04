// Vercel Function entry point. The app is compiled before deployment and
// exported without calling listen(), because Vercel owns the HTTP server.
module.exports = require("../dist/app").default;
