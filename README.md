# Canvas Font Guard

**A Chrome extension that mitigates font probing, either across all sites or per site.** Canvas Font Guard handles a set of known Chinese and vendor font family names in Canvas 2D before page scripts run, and filters the results of Chrome's Local Font Access API where applicable. It uses Chrome Manifest V3 and requires no build step.

> This is a privacy tool with a deliberately narrow scope. It cannot guarantee that Chinese fonts are hidden from a system, and it does not make a browser fingerprint anonymous or unrecognizable. Read [Scope and limitations](#scope-and-limitations) below.

## Features

- **Global toggle**: Grant access to all HTTP / HTTPS sites once and keep protection running. Turning the toggle off only unregisters the global script; it does not revoke the permission, so turning it back on does not prompt again.
- **Per-site toggle**: Protect only the current site. Turning protection off keeps that site's permission, so re-enabling it does not prompt again. While global mode is on, the per-site toggle is temporarily disabled; existing per-site settings are retained.
- **Canvas 2D font-name mapping**: In `CanvasRenderingContext2D` and `OffscreenCanvasRenderingContext2D`, matching known family names are mapped to an internal family name that does not exist, causing Canvas to use a fallback font from the page's font stack.
- **Local font enumeration filtering**: When `queryLocalFonts()` is available, matching entries are removed from the `family`, `fullName`, and `postscriptName` fields returned by the API. Chrome still controls the API's secure-context and user-permission requirements.
- **Active from the start of the page**: Registered scripts run in the main world at `document_start` and cover frames on matching sites. Toggling protection reloads the current tab.
- **On-demand permissions**: No site access is granted at install time. When global mode is enabled, the extension requests `http://*/*` and `https://*/*`; manual mode requests only the current scheme and host. Turning protection off unregisters the corresponding script but keeps the permission until the user revokes it in Chrome's extension settings.

## Font names matched today

The matching rules are a targeted list, not a complete CJK font catalog. Matching is case-insensitive. Rules target font family names; the exact input form—name boundaries, spacing, and the surrounding CSS font list—can affect whether a name matches.

| Category | Example names and aliases |
| --- | --- |
| Microsoft | `Microsoft YaHei UI`, `Microsoft YaHei`, `Microsoft JhengHei UI`, `Microsoft JhengHei`, `MicrosoftYaHei`, `MicrosoftJhengHei`, `微软雅黑` (Microsoft YaHei), `微软正黑体` (Microsoft JhengHei) |
| Apple / macOS | `PingFang SC`, `PingFang TC`, `PingFang HK`, `PingFang`, `PingFangSC`, `PingFangTC`, `苹方` (PingFang), `STHeiti`, `STHeiti SC`, `STSong`, `Songti SC`, `Kaiti SC`, `Hiragino Sans GB`, `华文系列` (ST family), `冬青黑体` (Hiragino Sans GB) |
| Xiaomi | `MiSans VF`, `MiSans`, `Mi Sans`, `MiSansVF`, `小米兰亭` (Mi Lan Ting), `小米兰亭 Pro` (Mi Lan Ting Pro) |
| Huawei | `HarmonyOS Sans SC`, `HarmonyOS Sans TC`, `HarmonyOS Sans`, `HarmonyOSSansSC`, `HarmonyOSSans`, `鸿蒙黑体` (HarmonyOS Sans), `Huawei Sans`, `华为鸿蒙字体` (Huawei HarmonyOS font) |
| Generic CJK / Linux | `Source Han Sans/Serif`, `Noto Sans/Serif CJK`, `思源黑体` (Source Han Sans), `思源宋体` (Source Han Serif), `WenQuanYi Zen Hei`, `WenQuanYi Micro Hei`, `文泉驿` (WenQuanYi) |
| Other Chinese and vendor fonts | `SimSun`, `NSimSun`, `SimHei`, `KaiTi`, `FangSong`, `等线` (DengXian), `隶书` (LiSu), `幼圆` (YouYuan), `DFKai-SB`, `MingLiU`, `PMingLiU`, `OPPO Sans`, `vivo Sans`, `Alibaba PuHuiTi`, `Tencent Sans`, `DingTalk JinBuTi`, and the corresponding Chinese aliases |

The complete rules are defined by the `protectedFamilies` list in [`guard.js`](guard.js).

## Installation

### Download from GitHub

1. On this repository's page, choose **Code → Download ZIP** and extract the archive.
2. Open `chrome://extensions` in Chrome's address bar.
3. Turn on **Developer mode** in the upper-right corner of the page.
4. Click **Load unpacked** and select the extracted folder that contains `manifest.json`.

Chrome requires Developer mode to load an unpacked development build of an extension. This project has no installer and does not modify or uninstall operating-system fonts.

## Usage

If Canvas Font Guard is not visible on the toolbar, click Chrome's Extensions (puzzle-piece) button and pin it to the toolbar; you can then open the popup directly.

### Protect all websites

1. Click the Canvas Font Guard icon in Chrome's toolbar.
2. Click **Enable global protection**, then allow access to all websites in Chrome's confirmation prompt.
3. After permission is granted, the extension registers the global script and reloads the current page. HTTP / HTTPS pages opened afterward are protected automatically, with no need to click through each site.

Global permission normally needs to be confirmed only once. Clicking **Disable global protection** stops the global script but keeps the permission, so re-enabling it does not prompt again. To revoke access, open Canvas Font Guard's details page in `chrome://extensions` and manage its site access.

### Protect only the current site

1. Make sure **global protection** is off, then open the `http://` or `https://` page you want to protect.
2. Click the Canvas Font Guard icon in the toolbar, then click **Enable protection for this site**.
3. The first time you enable this site, allow access in Chrome's permission prompt. Turning protection off and back on later does not prompt again.

Per-site protection applies to the current **scheme + hostname**. Chrome's host matching rules ignore ports, so different ports on the same scheme and host share one toggle; HTTP and HTTPS are authorized separately. Chrome's built-in pages, extension pages, and `file://` pages do not support manual mode.

### Turning protection off and reloading pages

- Clicking **Disable global protection** in the popup stops the global script; turning off **protection for this site** stops the script for the current site. Turning protection off does not automatically revoke granted permissions, so re-enabling it does not require authorization again.
- Global and per-site settings can coexist. While global mode is on, the per-site toggle is temporarily disabled; after global mode is turned off, sites that were previously enabled individually remain protected by their own settings.
- Switching a toggle automatically reloads the current supported page. Other open tabs must be refreshed manually before their protection state updates.
- To stop protecting all sites, turn off global protection first, then turn off each per-site protection that is still enabled. To revoke access, manage the extension's permissions on its details page in `chrome://extensions`.

## Permissions

| Permission | Purpose |
| --- | --- |
| `activeTab` | Reads the current tab's address after the user clicks the extension icon, so the popup can show and act on the right site. |
| `scripting` | Registers the `document_start` script on sites the user chooses to enable. |
| Optional `http://*/*` and `https://*/*` host permissions | Requested for all HTTP / HTTPS sites when global mode is enabled; in manual mode, only the current scheme and host are requested. Nothing is granted automatically at install time. Turning protection off only unregisters the corresponding script and keeps the permission; the user can revoke it on Chrome's extension details page. |

The extension does not use `storage`, cookies, history, bookmarks, downloads, or network-request permissions. Protection state is represented by the content-script registrations Chrome stores. Granted host permissions remain after protection is turned off to avoid repeated authorization prompts.

## How it works

The script wraps the `font` property of Canvas 2D contexts in the page's main world. When the page sets a font, the extension replaces a listed family name with an internal placeholder family name before handing the value to the browser. Because that placeholder does not exist, the browser falls back to the remaining available families in the page's font declaration. The wrapped getter returns the font string the page originally set; actual Canvas drawing and measurement use the font as resolved by the browser.

If the page provides a callable `queryLocalFonts()`, the extension filters matching local font entries after the native promise resolves. It does not grant any additional permission the API requires, and it does not bypass Chrome's font-access prompt.

## Scope and limitations

- **It does not hide system fonts themselves.** The extension does not uninstall, rename, isolate, or replace fonts on macOS, Windows, or Linux.
- **It does not remove Chinese glyphs.** If the browser needs to draw Chinese characters, the system's CJK fallback fonts may still be used; rendered output, pixel data, and font metrics can still reveal environment characteristics.
- **It is not a complete anti-fingerprinting solution.** DOM/CSS font measurement, unlisted font names, other Canvas paths, WebGL, system language, browser differences, and other fingerprinting signals are outside this extension's coverage.
- **Pages may detect the extension's wrappers.** Differences between JavaScript API behavior and native implementations can be probed; the extension makes no promise of resisting detection aimed specifically at it.
- **Fallback fonts can affect page rendering.** When a name is remapped, the page may use different glyphs, widths, or typography. Font fallback behavior is determined by the browser and the page's font stack.
- **The timing of protection is limited.** Dynamically registered scripts start with a new document after a reload and cannot retroactively change results produced before the page loaded.
- **Local font filtering is conditional.** Results are wrapped only when the API exists and the page can call it, and other font-enumeration paths are unaffected.

## Privacy

The extension runs locally and contains no telemetry, advertising, remote code, or functionality that sends data to a developer server. When protection is enabled, Chrome stores the corresponding host permission and content-script registration. Turning off global or per-site protection stops the corresponding protection script, but the permission remains in Chrome until the user revokes it in the extension settings.

## Development and checks

The extension consists of plain Manifest V3 files and needs no bundler or dependency installation. After making changes, click the refresh button on the extension card in `chrome://extensions`, then reload the target page.

- [`manifest.json`](manifest.json): extension metadata, permissions, and popup configuration.
- [`popup.html`](popup.html), [`popup.css`](popup.css), [`popup.js`](popup.js): the global and per-site permission and toggle interface.
- [`guard.js`](guard.js): the font list and page-context protection logic.

## License

This project is released under the [MIT License](LICENSE).
