module.exports = {
  cacheId: "fission-suite/auth-lobby",
  clientsClaim: true,
  globDirectory: "build/",
  globPatterns: [ "**/*" ],
  inlineWorkboxRuntime: true,
  navigateFallback: "index.html",
  runtimeCaching: [
    { urlPattern: /^https:\/\/cdnjs\./, handler: "StaleWhileRevalidate" }
  ],
  skipWaiting: true,
  sourcemap: false,
  swDest: "build/service-worker.js"
};
