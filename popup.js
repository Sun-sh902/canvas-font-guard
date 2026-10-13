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
  globalToggle.textContent = globalEnabled ? "关闭全站保护" : "开启全站保护";
  globalStatus.textContent = globalMessage ?? (globalEnabled
    ? "全站保护已启用。已授权的 HTTP / HTTPS 网页都会运行保护脚本。"
    : globalPermissionGranted
      ? "全站保护已关闭，但授权已保留；再次开启无需重新确认。"
      : "尚未授权。开启时 Chrome 会请求 HTTP / HTTPS 全站权限。");

  if (!site) {
    siteName.textContent = "此页面不支持";
    siteOrigin.textContent = "仅支持 HTTP / HTTPS 网页";
    siteToggle.textContent = "无法启用";
    siteToggle.disabled = true;
    siteToggle.classList.remove("is-on");
    siteStatus.textContent = "Chrome 内置页面、扩展页和本地文件不在支持范围内。全站开关仍可在网页中使用。";
    return;
  }

  siteName.textContent = site.label;
  siteOrigin.textContent = site.key;
  siteToggle.textContent = siteEnabled ? "关闭此站点保护" : "开启此站点保护";
  siteToggle.classList.toggle("is-on", siteEnabled);
  siteToggle.disabled = busy || globalEnabled;
  siteStatus.textContent = siteMessage ?? (globalEnabled
    ? "全站保护正在运行，此站点已包含其中。关闭全站开关后可恢复单站控制。"
    : siteEnabled
      ? "本站保护已启用。关闭后会保留授权，再次开启无需重新确认。"
      : sitePermissionGranted
        ? "本站授权已保留；开启保护时不会再次询问。"
        : "开启时 Chrome 只会请求此协议和主机的访问权限。");
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
  renderState({ global: globalEnabled ? "正在关闭全站保护…" : "正在检查全站权限…" });

  try {
    if (globalEnabled) {
      await chrome.scripting.unregisterContentScripts({ ids: [GLOBAL_SCRIPT_ID] });
      globalEnabled = false;
      renderState({ global: "全站保护已关闭。授权会保留，再次开启无需重新确认。" });
    } else {
      // Ask directly from the user's toolbar popup click. Chrome does not
      // prompt again when these optional origins are already granted.
      const granted = await chrome.permissions.request({ origins: ALL_SITE_ORIGINS });
      if (!granted) {
        globalPermissionGranted = false;
        renderState({ global: "全站权限未授予，保护没有开启。你仍可使用下方的单站模式。" });
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
      renderState({ global: "全站保护已开启。全站授权会保留，关闭后再次开启无需重新确认。" });
    }

    await reloadCurrentPage();
  } catch (error) {
    renderState({ global: `操作失败：${error?.message ?? "未知错误"}` });
  } finally {
    setBusy(false);
  }
});

siteToggle.addEventListener("click", async () => {
  if (!site || globalEnabled) return;
  setBusy(true);
  renderState({ site: siteEnabled ? "正在关闭并重新加载…" : "正在检查本站权限…" });

  try {
    if (siteEnabled) {
      await chrome.scripting.unregisterContentScripts({ ids: [site.scriptId] });
      siteEnabled = false;
      renderState({ site: "本站保护已关闭。授权会保留，再次开启无需重新确认。" });
    } else {
      // Request directly from the toolbar popup gesture. If the site access is
      // already retained, Chrome resolves this without showing a prompt.
      const granted = await chrome.permissions.request({ origins: [site.pattern] });
      if (!granted) {
        sitePermissionGranted = false;
        renderState({ site: "本站权限未授予，保护没有开启。" });
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
      renderState({ site: "本站保护已开启。授权会保留，再次开启无需重新确认。" });
    }

    await reloadCurrentPage();
  } catch (error) {
    renderState({ site: `操作失败：${error?.message ?? "未知错误"}` });
  } finally {
    setBusy(false);
  }
});

readState().catch((error) => {
  globalToggle.textContent = "无法读取全站状态";
  globalToggle.disabled = true;
  globalStatus.textContent = error?.message ?? "无法读取全站权限状态。";
  siteName.textContent = "读取失败";
  siteOrigin.textContent = "";
  siteToggle.textContent = "无法读取状态";
  siteToggle.disabled = true;
  siteStatus.textContent = "无法读取当前站点。";
});
