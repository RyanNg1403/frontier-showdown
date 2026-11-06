/**
 * Registers the build's service worker once the page has loaded, so it never competes with the
 * first visit's downloads. Only static builds ship sw.js; `npm start` serves the working tree
 * uncached.
 */
export function registerServiceWorker(url, scope) {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const register = () => {
    navigator.serviceWorker.register(url, { scope }).catch((error) => {
      console.info("[sw] registration failed; the game still works online.", error?.message || error);
    });
  };
  if (document.readyState === "complete") setTimeout(register, 1000);
  else window.addEventListener("load", () => setTimeout(register, 1000), { once: true });
}
