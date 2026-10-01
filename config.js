/*
 * Punkto — site configuration.
 * ---------------------------------------------------------------
 * This is the ONLY file you need to edit to run your own copy.
 * Everything is plain JavaScript: keep the quotes and commas intact.
 * After editing, commit and push — GitHub Pages redeploys in ~1 minute.
 * (Optional: run `node tools/generate-pages.mjs` afterwards so the SEO
 * tags in the language pages pick up a changed siteUrl / AdSense ID.)
 */
window.PUNKTO_CONFIG = {
  /* Public address of the site, WITH trailing slash.
     GitHub Pages default: https://<user>.github.io/<repo>/
     With a custom domain:  https://punkto.app/  (example)          */
  siteUrl: "https://matfej-t.github.io/punkto/",

  /* Contact e-mail shown on the privacy page (leave "" to hide). */
  contactEmail: "",

  /* UI languages. The first one is the fallback language.
     To add a language: create i18n/<code>.json, add the code here,
     then run `node tools/generate-pages.mjs`.                       */
  languages: ["en", "de", "ru", "es", "fr", "it", "pt", "pl", "uk", "tr", "cs", "nl"],

  /* ------------------------------------------------------------ ADS */
  ads: {
    enabled: true,
    /* Your AdSense publisher ID, e.g. "ca-pub-1234567890123456".
       While empty, no ad code is loaded at all.                     */
    adsenseClient: "",
    /* Ad unit IDs ("data-ad-slot") from AdSense → Ads → By ad unit.  */
    slots: {
      control: "", // responsive banner at the bottom of the control view
      display: ""  // small fixed 320×50 unit in the corner of the TV display
    },
    /* Show dashed "Ad" placeholders even without AdSense, to preview
       the layout. You can also add ?adpreview=1 to the URL instead. */
    showPlaceholders: false
  },

  /* ----------------------------------------------------- STATISTICS */
  /* Optional, cookie-free visitor statistics with GoatCounter (free).
     Sign up at https://www.goatcounter.com, choose a code (e.g. "punkto")
     and put your count URL here: "https://punkto.goatcounter.com/count".
     While empty, no statistics script is loaded at all.              */
  analytics: {
    goatcounter: ""
  },

  /* -------------------------------------------------------- PREMIUM */
  premium: {
    /* Lemon Squeezy checkout link for the "Remove ads forever" product
       (Store → Products → Share → Checkout URL).                    */
    checkoutUrl: "https://YOUR-STORE.lemonsqueezy.com/buy/YOUR-PRODUCT-ID",
    /* Price label shown on the button. Pure text, not charged by us. */
    priceLabel: "€9",
    /* Lemon Squeezy License API. Keep as is. */
    licenseApi: "https://api.lemonsqueezy.com/v1/licenses",
    /* If direct browser calls to Lemon Squeezy are blocked (CORS), deploy
       tools/license-proxy-worker.js to Cloudflare Workers (free) and put
       its URL here, e.g. "https://punkto-license.you.workers.dev".
       See README → "Lemon Squeezy".                                  */
    licenseProxyUrl: "",
    /* Recommended: lock license keys to YOUR product so keys bought for
       other Lemon Squeezy products are rejected. Numbers from the
       Lemon Squeezy dashboard (null = don't check).                   */
    expectedStoreId: null,
    expectedProductId: null,
    /* "activate" counts each browser against the key's activation limit;
       "validate" only checks that the key exists and is active.      */
    mode: "activate",
    /* Re-check a stored license this often (days). Network errors never
       remove a license; only an explicit "disabled/expired" does.    */
    revalidateDays: 30
  }
};
