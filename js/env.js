// Environment constants shared by all modules.

// Every HTML page declares where the site root is relative to itself:
// "./" for /index.html, "../" for language pages such as /de/index.html.
export const ROOT_URL = new URL(document.documentElement.dataset.root || './', location.href);

export const APP_VERSION = '1.0.0';

export const params = new URLSearchParams(location.search);
