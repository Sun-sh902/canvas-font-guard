const ALL_SITE_ORIGINS = ["http://*/*", "https://*/*"];
const ALL_SITE_MATCHES = [...ALL_SITE_ORIGINS];
const GLOBAL_SCRIPT_ID = "canvas-font-guard-global-v1";

const globalToggle = document.querySelector("#global-toggle");
const globalStatus = document.querySelector("#global-status");
const siteToggle = document.querySelector("#site-toggle");
const siteName = document.querySelector("#site-name");
const siteOrigin = document.querySelector("#site-origin");
const siteStatus = document.querySelector("#site-status");

let currentTab;
let site;
let globalEnabled = false;
let globalPermissionGranted = false;
let siteEnabled = false;
let sitePermissionGranted = false;
let busy = false;
let globalMessage;
let siteMessage;

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
}

function renderState(messages = {}) {
  if (Object.hasOwn(messages, "global")) globalMessage = messages.global;
  if (Object.hasOwn(messages, "site")) siteMessage = messages.site;
  globalToggle.disabled = busy;
  globalToggle.classList.toggle("is-on", globalEnabled);
  globalToggle.textContent = globalEnabled ? "Disable global protection" : "Enable global protection";
  globalStatus.textContent = globalMessage ?? (globalEnabled
    ? "Global protection is on. The protection script runs on all authorized HTTP / HTTPS pages."
    : globalPermissionGranted
      ? "Global protection is off, but the permission is retained; re-enabling it will not prompt again."
      : "Not yet authorized. Enabling this requests HTTP / HTTPS access to all sites from Chrome.");

  if (!site) {
    siteName.textContent = "This page is not supported";
    siteOrigin.textContent = "Only HTTP / HTTPS pages are supported";
    siteToggle.textContent = "Cannot enable";
    siteToggle.disabled = true;
    siteToggle.classList.remove("is-on");
    siteStatus.textContent = "Chrome built-in pages, extension pages, and local files are not supported. The global toggle still works on websites.";
    return;
  }

  siteName.textContent = site.label;
  siteOrigin.textContent = site.key;
  siteToggle.textContent = siteEnabled ? "Disable protection for this site" : "Enable protection for this site";
  siteToggle.classList.toggle("is-on", siteEnabled);
  siteToggle.disabled = busy || globalEnabled;
  siteStatus.textContent = siteMessage ?? (globalEnabled
    ? "Global protection is running and already covers this site. Turn it off to regain per-site control."
    : siteEnabled
      ? "Protection is on for this site. Turning it off keeps the permission, so re-enabling it will not prompt again."
      : sitePermissionGranted
        ? "This site's permission is retained; enabling protection will not prompt again."
        : "Enabling this asks Chrome only for access to this scheme and host.");
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
  renderState({ global: globalEnabled ? "Disabling global protection…" : "Checking global permission…" });

  try {
    if (globalEnabled) {
      await chrome.scripting.unregisterContentScripts({ ids: [GLOBAL_SCRIPT_ID] });
      globalEnabled = false;
      renderState({ global: "Global protection is off. The permission is retained, so re-enabling it will not prompt again." });
    } else {
      // Ask directly from the user's toolbar popup click. Chrome does not
      // prompt again when these optional origins are already granted.
      const granted = await chrome.permissions.request({ origins: ALL_SITE_ORIGINS });
      if (!granted) {
        globalPermissionGranted = false;
        renderState({ global: "Global permission was not granted, so protection was not enabled. You can still use per-site mode below." });
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
      renderState({ global: "Global protection is on. The global permission is retained; after turning it off, re-enabling it will not prompt again." });
    }

    await reloadCurrentPage();
  } catch (error) {
    renderState({ global: `Operation failed: ${error?.message ?? "unknown error"}` });
  } finally {
    setBusy(false);
  }
});

siteToggle.addEventListener("click", async () => {
  if (!site || globalEnabled) return;
  setBusy(true);
  renderState({ site: siteEnabled ? "Disabling and reloading…" : "Checking this site's permission…" });

  try {
    if (siteEnabled) {
      await chrome.scripting.unregisterContentScripts({ ids: [site.scriptId] });
      siteEnabled = false;
      renderState({ site: "Protection is off for this site. The permission is retained, so re-enabling it will not prompt again." });
    } else {
      // Request directly from the toolbar popup gesture. If the site access is
      // already retained, Chrome resolves this without showing a prompt.
      const granted = await chrome.permissions.request({ origins: [site.pattern] });
      if (!granted) {
        sitePermissionGranted = false;
        renderState({ site: "This site's permission was not granted, so protection was not enabled." });
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
      renderState({ site: "Protection is on for this site. The permission is retained, so re-enabling it will not prompt again." });
    }

    await reloadCurrentPage();
  } catch (error) {
    renderState({ site: `Operation failed: ${error?.message ?? "unknown error"}` });
  } finally {
    setBusy(false);
  }
});

readState().catch((error) => {
  globalToggle.textContent = "Unable to read global status";
  globalToggle.disabled = true;
  globalStatus.textContent = error?.message ?? "Unable to read the global permission status.";
  siteName.textContent = "Read failed";
  siteOrigin.textContent = "";
  siteToggle.textContent = "Unable to read status";
  siteToggle.disabled = true;
  siteStatus.textContent = "Unable to read the current site.";
});
