const ALL_SITE_ORIGINS = ["http://*/*", "https://*/*"];
const ALL_SITE_MATCHES = [...ALL_SITE_ORIGINS];
const GLOBAL_SCRIPT_ID = "canvas-font-guard-global-v1";
// Last switch states the popup read, so it can open already showing them.
// Chrome's content-script registry stays the source of truth.
const STATE_CACHE_KEY = "canvas-font-guard-popup-state-v1";
const STATE_CACHE_SITE_LIMIT = 200;

const globalToggle = document.querySelector("#global-toggle");
const globalStatus = document.querySelector("#global-status");
const siteToggle = document.querySelector("#site-toggle");
const siteName = document.querySelector("#site-name");
const siteOrigin = document.querySelector("#site-origin");
const siteStatus = document.querySelector("#site-status");
const heroKicker = document.querySelector("#hero-kicker");
const heroTitle = document.querySelector("#hero-title");
const heroCopy = document.querySelector("#hero-copy");

let currentTab;
let site;
let globalEnabled = false;
let globalPermissionGranted = false;
let siteEnabled = false;
let sitePermissionGranted = false;
let busy = false;
let globalMessage;
let siteMessage;

function readStateCache() {
  try {
    return JSON.parse(localStorage.getItem(STATE_CACHE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writeStateCache() {
  try {
    const cache = readStateCache();
    cache.global = { enabled: globalEnabled, granted: globalPermissionGranted };
    cache.sites ??= {};
    if (site) {
      // Re-insert so the most recently viewed sites survive trimming.
      delete cache.sites[site.key];
      cache.sites[site.key] = { enabled: siteEnabled, granted: sitePermissionGranted };
      const keys = Object.keys(cache.sites);
      for (const key of keys.slice(0, keys.length - STATE_CACHE_SITE_LIMIT)) delete cache.sites[key];
    }
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // The cache only speeds up the first paint; the popup works without it.
  }
}

function finishBoot() {
  // Resolve styles for the real state while transitions are still off, then
  // enable them so only the user's own toggles animate.
  void document.body.offsetHeight;
  document.body.classList.remove("is-booting");
}

function siteFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    // Chrome match patterns do not include ports, so this switch applies to
    // every port on the same scheme and hostname.
    const key = `${url.protocol}//${url.hostname}`;
    return {
      key,
      pattern: `${key}/*`,
      label: url.hostname,
      scriptId: `canvas-font-guard-${hash(key)}`
    };
  } catch {
    return null;
  }
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16);
}

async function readState() {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  site = siteFromUrl(currentTab?.url ?? "");
  const cachedSite = site && readStateCache().sites?.[site.key];
  if (cachedSite) {
    siteEnabled = cachedSite.enabled === true;
    sitePermissionGranted = cachedSite.granted === true;
  }
  renderState();

  const [scripts, hasGlobalPermission] = await Promise.all([
    chrome.scripting.getRegisteredContentScripts(),
    chrome.permissions.contains({ origins: ALL_SITE_ORIGINS })
  ]);

  const globalScriptExists = scripts.some((script) => script.id === GLOBAL_SCRIPT_ID);
  globalPermissionGranted = hasGlobalPermission;
  if (globalScriptExists && !globalPermissionGranted) {
    // A user may revoke the all-sites permission in Chrome's extension settings.
    await chrome.scripting.unregisterContentScripts({ ids: [GLOBAL_SCRIPT_ID] });
  }
  globalEnabled = globalScriptExists && globalPermissionGranted;

  sitePermissionGranted = false;
  siteEnabled = false;
  if (site) {
    const [siteScripts, hasSitePermission] = await Promise.all([
      chrome.scripting.getRegisteredContentScripts({ ids: [site.scriptId] }),
      chrome.permissions.contains({ origins: [site.pattern] })
    ]);
    sitePermissionGranted = hasSitePermission;
    if (siteScripts.length > 0 && !sitePermissionGranted) {
      // A user may revoke this site's access in Chrome's extension settings.
      await chrome.scripting.unregisterContentScripts({ ids: [site.scriptId] });
    }
    siteEnabled = siteScripts.length > 0 && sitePermissionGranted;
  }

  renderState();
  writeStateCache();
}

function renderHero() {
  const state = globalEnabled ? "global" : siteEnabled ? "site" : "off";
  document.body.dataset.state = state;
  if (state === "global") {
    heroKicker.textContent = "Guarding everywhere";
    heroTitle.innerHTML = "Every page,<br><em>veiled.</em>";
    heroCopy.textContent = "Known CJK and vendor fonts are masked in Canvas on all HTTP and HTTPS sites.";
  } else if (state === "site") {
    heroKicker.textContent = "Guarding this site";
    heroTitle.innerHTML = "This page,<br><em>veiled.</em>";
    heroCopy.textContent = `Canvas font probes on ${site.label} see only fallback fonts.`;
  } else {
    heroKicker.textContent = "Unguarded";
    heroTitle.innerHTML = "Your fonts are<br><em>legible.</em>";
    heroCopy.textContent = "Canvas can read which typefaces this system carries. Draw the veil below.";
  }
}

function renderState(messages = {}) {
  if (Object.hasOwn(messages, "global")) globalMessage = messages.global;
  if (Object.hasOwn(messages, "site")) siteMessage = messages.site;
  renderHero();
  globalToggle.disabled = busy;
  globalToggle.setAttribute("aria-checked", String(globalEnabled));
  globalStatus.textContent = globalMessage ?? (globalEnabled
    ? "On. Every granted HTTP / HTTPS page runs the guard."
    : globalPermissionGranted
      ? "Off. Access is retained, so switching on won’t ask again."
      : "Not yet granted. Chrome will ask once for access to all HTTP / HTTPS sites.");

  // The active tab hasn't been read yet; keep the loading copy.
  if (site === undefined) return;

  if (!site) {
    siteName.textContent = "Unsupported page";
    siteOrigin.textContent = "HTTP / HTTPS only";
    siteToggle.disabled = true;
    siteToggle.setAttribute("aria-checked", "false");
    siteStatus.textContent = "Chrome pages, extension pages and local files can’t be guarded. The all-sites switch still works on websites.";
    return;
  }

  siteName.textContent = site.label;
  siteOrigin.textContent = site.key;
  siteToggle.setAttribute("aria-checked", String(siteEnabled || globalEnabled));
  siteToggle.disabled = busy || globalEnabled;
  siteStatus.textContent = siteMessage ?? (globalEnabled
    ? "Covered by the all-sites guard. Switch that off to control this site on its own."
    : siteEnabled
      ? "On. Access stays granted if you switch it off."
      : sitePermissionGranted
        ? "Off. Access is retained; switching on won’t ask again."
        : "Chrome will ask for access to this scheme and host only.");
}

function setBusy(value) {
  busy = value;
  renderState();
}

async function reloadCurrentPage() {
  if (typeof currentTab?.id === "number" && site) {
    await chrome.tabs.reload(currentTab.id);
  }
}

globalToggle.addEventListener("click", async () => {
  setBusy(true);
  renderState({ global: globalEnabled ? "Switching off all-sites guard…" : "Checking all-sites access…" });

  try {
    if (globalEnabled) {
      await chrome.scripting.unregisterContentScripts({ ids: [GLOBAL_SCRIPT_ID] });
      globalEnabled = false;
      renderState({ global: "All-sites guard is off. Access is retained for next time." });
    } else {
      // Ask directly from the user's toolbar popup click. Chrome does not
      // prompt again when these optional origins are already granted.
      const granted = await chrome.permissions.request({ origins: ALL_SITE_ORIGINS });
      if (!granted) {
        globalPermissionGranted = false;
        renderState({ global: "Access wasn’t granted, so nothing changed. You can still guard a single site below." });
        return;
      }

      const previous = await chrome.scripting.getRegisteredContentScripts({ ids: [GLOBAL_SCRIPT_ID] });
      if (previous.length > 0) {
        await chrome.scripting.unregisterContentScripts({ ids: [GLOBAL_SCRIPT_ID] });
      }
      await chrome.scripting.registerContentScripts([{
        id: GLOBAL_SCRIPT_ID,
        matches: ALL_SITE_MATCHES,
        js: ["guard.js"],
        runAt: "document_start",
        world: "MAIN",
        allFrames: true,
        persistAcrossSessions: true
      }]);
      globalPermissionGranted = true;
      globalEnabled = true;
      renderState({ global: "All-sites guard is on. Access is retained if you switch it off later." });
    }

    await reloadCurrentPage();
  } catch (error) {
    renderState({ global: `Something went wrong: ${error?.message ?? "unknown error"}` });
  } finally {
    setBusy(false);
    writeStateCache();
  }
});

siteToggle.addEventListener("click", async () => {
  if (!site || globalEnabled) return;
  setBusy(true);
  renderState({ site: siteEnabled ? "Switching off and reloading…" : "Checking site access…" });

  try {
    if (siteEnabled) {
      await chrome.scripting.unregisterContentScripts({ ids: [site.scriptId] });
      siteEnabled = false;
      renderState({ site: "Site guard is off. Access is retained for next time." });
    } else {
      // Request directly from the toolbar popup gesture. If the site access is
      // already retained, Chrome resolves this without showing a prompt.
      const granted = await chrome.permissions.request({ origins: [site.pattern] });
      if (!granted) {
        sitePermissionGranted = false;
        renderState({ site: "Access wasn’t granted, so nothing changed." });
        return;
      }

      const previous = await chrome.scripting.getRegisteredContentScripts({ ids: [site.scriptId] });
      if (previous.length > 0) {
        await chrome.scripting.unregisterContentScripts({ ids: [site.scriptId] });
      }
      await chrome.scripting.registerContentScripts([{
        id: site.scriptId,
        matches: [site.pattern],
        js: ["guard.js"],
        runAt: "document_start",
        world: "MAIN",
        allFrames: true,
        persistAcrossSessions: true
      }]);
      sitePermissionGranted = true;
      siteEnabled = true;
      renderState({ site: "Site guard is on. Access is retained if you switch it off later." });
    }

    await reloadCurrentPage();
  } catch (error) {
    renderState({ site: `Something went wrong: ${error?.message ?? "unknown error"}` });
  } finally {
    setBusy(false);
    writeStateCache();
  }
});

const cachedGlobal = readStateCache().global;
if (cachedGlobal) {
  globalEnabled = cachedGlobal.enabled === true;
  globalPermissionGranted = cachedGlobal.granted === true;
  renderState();
}

readState().catch((error) => {
  document.body.dataset.state = "off";
  heroKicker.textContent = "Unavailable";
  heroTitle.textContent = "Couldn’t read state.";
  heroCopy.textContent = error?.message ?? "Chrome didn’t return the permission state.";
  globalToggle.disabled = true;
  globalStatus.textContent = "Couldn’t read all-sites access.";
  siteName.textContent = "Unavailable";
  siteOrigin.textContent = "";
  siteToggle.disabled = true;
  siteStatus.textContent = "Couldn’t read the current site.";
}).finally(finishBoot);
