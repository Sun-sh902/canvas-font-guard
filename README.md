# Canvas Font Guard

**按站点启用的 Chrome 字体探测缓解扩展。** Canvas Font Guard 会在页面运行前处理 Canvas 2D 中的部分已知中文及厂商字体名，并在适用时过滤 Chrome 本地字体枚举 API 的结果。扩展采用 Chrome Manifest V3，不需要构建步骤。

> 这是一个范围有限的隐私工具。它不能保证隐藏系统中存在中文字体，也不能让浏览器指纹变成匿名或不可识别。请阅读下方的[保护范围与限制](#保护范围与限制)。

## 功能

- **逐站点开关**：默认不对任何网站启用。用户在扩展弹窗中为当前网站开启保护后，Chrome 才会请求对应的站点权限。
- **Canvas 2D 字体名映射**：在 `CanvasRenderingContext2D` 和 `OffscreenCanvasRenderingContext2D` 中，将匹配的已知字体名映射为内部不存在的字体名，使 Canvas 使用页面字体栈的回退字体。
- **本地字体枚举过滤**：当 `queryLocalFonts()` 可用时，对该 API 返回的 `family`、`fullName` 和 `postscriptName` 字段过滤匹配项；原生 API 的安全上下文和用户授权要求仍由 Chrome 决定。
- **页面开始时生效**：注册的脚本以 `document_start`、主世界运行，并覆盖匹配站点的框架；启用或关闭时会重新加载当前标签页。
- **按需权限**：关闭某个站点的保护时，扩展会注销该站点脚本并请求 Chrome 撤销相应主机权限。

## 当前匹配的字体名

匹配规则是有针对性的名单，不代表完整的 CJK 字体目录。大小写不敏感。规则以字体家族名为目标；名称边界、空格和 CSS 字体列表等实际输入形式可能影响命中。

| 类别 | 名单示例及别名 |
| --- | --- |
| 微软 | `Microsoft YaHei UI`、`Microsoft YaHei`、`Microsoft JhengHei UI`、`Microsoft JhengHei`、`MicrosoftYaHei`、`MicrosoftJhengHei`、微软雅黑、微软正黑体 |
| Apple / macOS | `PingFang SC`、`PingFang TC`、`PingFang HK`、`PingFang`、`PingFangSC`、`PingFangTC`、苹方、`STHeiti`、`STHeiti SC`、`STSong`、`Songti SC`、`Kaiti SC`、`Hiragino Sans GB`、华文系列、冬青黑体 |
| 小米 | `MiSans VF`、`MiSans`、`Mi Sans`、`MiSansVF`、小米兰亭、小米兰亭 Pro |
| 华为 | `HarmonyOS Sans SC`、`HarmonyOS Sans TC`、`HarmonyOS Sans`、`HarmonyOSSansSC`、`HarmonyOSSans`、鸿蒙黑体、`Huawei Sans`、华为鸿蒙字体 |
| CJK 通用 / Linux | `Source Han Sans/Serif`、`Noto Sans/Serif CJK`、思源黑体、思源宋体、`WenQuanYi Zen Hei`、`WenQuanYi Micro Hei`、文泉驿 |
| 其他中文及厂商字体 | `SimSun`、`NSimSun`、`SimHei`、`KaiTi`、`FangSong`、等线、隶书、幼圆、`DFKai-SB`、`MingLiU`、`PMingLiU`、`OPPO Sans`、`vivo Sans`、`Alibaba PuHuiTi`、`Tencent Sans`、`DingTalk JinBuTi` 及相应中文别名 |

完整规则以 [`guard.js`](guard.js) 中的 `protectedFamilies` 列表为准。

## 安装

### 从 GitHub 下载

1. 在本仓库页面选择 **Code → Download ZIP**，解压文件。
2. 在 Chrome 地址栏打开 `chrome://extensions`。
3. 打开页面右上方的**开发者模式**。
4. 点击**加载已解压的扩展程序**，选择解压得到的 `chrome-font-guard` 文件夹（即包含 `manifest.json` 的目录）。

Chrome 扩展的未打包开发版本需要开发者模式。此项目没有安装程序，也不会修改或卸载操作系统字体。

### 在 Chrome 中启用一个站点

1. 打开要保护的 `http://` 或 `https://` 网页。
2. 点击 Chrome 工具栏中的 Canvas Font Guard 图标。
3. 点击**开启此站点保护**，并在 Chrome 权限提示中允许该站点访问。
4. 页面自动重新加载后，保护脚本从下一次文档创建时开始运行。

保护仅适用于当前扩展配置的 **scheme + hostname**。Chrome 的主机权限不区分端口，因此同一协议、同一主机下的不同端口共用开关。不同协议（HTTP 和 HTTPS）分别授权。Chrome 内置页面、扩展页面和 `file://` 页面不支持。

要停止保护，在该站点再次打开扩展弹窗并点击**关闭此站点保护**。扩展会注销脚本、请求撤销该主机权限并重新加载页面。也可以在 `chrome://extensions` 的扩展详情页管理已授予的站点访问权限；如果手动撤销权限，扩展会在下次读取状态时清理对应脚本注册。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 用户点击扩展图标后读取当前标签页地址，以确定弹窗显示和操作的站点。 |
| `scripting` | 在用户选择启用的站点注册 `document_start` 脚本。 |
| 可选的 `http://*/*` 和 `https://*/*` 主机权限 | 仅在用户点击站点开关时，为当前协议和主机请求；关闭保护时请求撤销。该可选权限声明本身不会在安装时授权所有网站。 |

扩展不使用 `storage`、cookies、历史记录、书签、下载或网络请求权限。站点启用状态由 Chrome 保存的脚本注册和主机授权表示。

## 工作方式

脚本在页面主世界包装 Canvas 2D 上下文的 `font` 属性。页面设置字体时，扩展把名单中的家族名替换为一个内部占位家族名，再交给浏览器解析。由于该占位名并不存在，浏览器会沿用页面字体声明中其余可用家族进行回退。包装后的读取器保留页面最初设置的字体字符串；实际 Canvas 绘制和测量使用浏览器解析后的字体。

如果页面提供并能调用 `queryLocalFonts()`，扩展会在原生 Promise 返回后过滤匹配的本地字体条目。扩展不授予该 API 所需的额外权限，也不会绕过 Chrome 的字体访问提示。

## 保护范围与限制

- **不会隐藏系统字体本身。** 扩展不卸载、重命名、隔离或替换 macOS、Windows 或 Linux 中的字体。
- **不会移除中文字形。** 如果浏览器需要绘制中文字符，系统 CJK 回退字体仍可能被使用；绘制结果、像素数据或字体度量仍可能暴露环境特征。
- **不是完整的反指纹方案。** DOM/CSS 字体测量、未列入名单的字体、其他 Canvas 路径、WebGL、系统语言、浏览器差异及其他指纹信号不在本扩展的覆盖范围内。
- **页面可能发现扩展的包装。** JavaScript API 行为与原生实现的差异可能被探测；扩展不承诺对抗专门针对它的检测。
- **回退字体会影响页面呈现。** 映射命中后，页面可能使用不同的字形、宽度或排版。字体回退行为由浏览器和页面的字体栈决定。
- **生效时机有限。** 动态注册的脚本从重新加载后的新文档开始运行，不能追溯修改页面加载前已经产生的结果。
- **本地字体过滤有条件。** 只有该 API 存在并可由页面调用时才包装其结果，且其他字体枚举途径不受影响。

## 隐私

扩展在本机运行，不包含遥测、广告、远程代码或向开发者服务器发送数据的功能。启用某站点时，Chrome 会保存相应的主机授权和内容脚本注册；用户可通过扩展弹窗关闭，或在 Chrome 扩展设置中撤销访问权。

## 开发与检查

扩展是原生 Manifest V3 文件，不需要打包器或依赖安装。修改后可在 `chrome://extensions` 点击扩展卡片上的刷新按钮，再重新加载目标网页。

- [`manifest.json`](manifest.json)：扩展元数据、权限和弹窗配置。
- [`popup.html`](popup.html)、[`popup.css`](popup.css)、[`popup.js`](popup.js)：逐站点权限与开关界面。
- [`guard.js`](guard.js)：字体名单与页面上下文保护逻辑。

## 许可证

本项目以 [MIT License](LICENSE) 发布。
