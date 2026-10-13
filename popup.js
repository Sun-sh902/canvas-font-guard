const toggleButton = document.querySelector("#toggle");
const siteName = document.querySelector("#site-name");
const siteOrigin = document.querySelector("#site-origin");
const statusText = document.querySelector("#status");

let currentTab;
let site;
let enabled = false;

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

  if (!site || typeof currentTab?.id !== "number") {
    siteName.textContent = "此页面不支持";
    siteOrigin.textContent = "仅支持 http / https 网页";
    toggleButton.textContent = "无法启用";
    toggleButton.disabled = true;
    statusText.textContent = "Chrome 内置页面、扩展页和本地文件不在支持范围内。";
    return;
  }

  siteName.textContent = site.label;
  siteOrigin.textContent = site.key;

  const [scripts, hasPermission] = await Promise.all([
    chrome.scripting.getRegisteredContentScripts({ ids: [site.scriptId] }),
    chrome.permissions.contains({ origins: [site.pattern] })
  ]);
  if (scripts.length > 0 && !hasPermission) {
    // A user may revoke site access from Chrome's extension settings.
    await chrome.scripting.unregisterContentScripts({ ids: [site.scriptId] });
  }
  enabled = scripts.length > 0 && hasPermission;
  renderState();
}

function renderState(message) {
  toggleButton.disabled = false;
  toggleButton.classList.toggle("is-on", enabled);
  toggleButton.textContent = enabled ? "关闭此站点保护" : "开启此站点保护";
  statusText.textContent = message ?? (enabled
    ? "保护已启用。字体规则会在此站点后续页面加载时生效。"
    : "保护未启用。开启时 Chrome 会询问此站点的访问权限。");
}

toggleButton.addEventListener("click", async () => {
  if (!site || typeof currentTab?.id !== "number") return;

  toggleButton.disabled = true;
  statusText.textContent = enabled ? "正在关闭并重新加载…" : "正在申请站点权限…";

  try {
    if (enabled) {
      await chrome.scripting.unregisterContentScripts({ ids: [site.scriptId] });
      const permissionRemoved = await chrome.permissions.remove({ origins: [site.pattern] });
      enabled = false;
      renderState(permissionRemoved
        ? "已关闭并撤销站点权限。正在重新加载当前页面…"
        : "保护已关闭；Chrome 未移除站点权限，请在扩展设置中检查。正在重新加载…");
    } else {
      // This request is made directly from the toolbar popup button gesture.
      const granted = await chrome.permissions.request({ origins: [site.pattern] });
      if (!granted) {
        renderState("权限未授予，本站保护没有开启。");
        return;
      }

      // Recover cleanly if Chrome retained a stale registration after access
      // was manually revoked in extension settings.
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
      enabled = true;
      renderState("已开启。正在重新加载页面，让脚本从页面脚本运行前生效…");
    }

    await chrome.tabs.reload(currentTab.id);
  } catch (error) {
    statusText.textContent = `操作失败：${error?.message ?? "未知错误"}`;
    toggleButton.disabled = false;
  }
});

readState().catch((error) => {
  siteName.textContent = "读取失败";
  siteOrigin.textContent = "";
  toggleButton.textContent = "无法读取状态";
  toggleButton.disabled = true;
  statusText.textContent = error?.message ?? "无法读取当前站点。";
});
