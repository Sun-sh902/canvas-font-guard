# Canvas Font Guard

**可全站或按站点启用的 Chrome 字体探测缓解扩展。** Canvas Font Guard 会在页面运行前处理 Canvas 2D 中的部分已知中文及厂商字体名，并在适用时过滤 Chrome 本地字体枚举 API 的结果。扩展采用 Chrome Manifest V3，不需要构建步骤。

> 这是一个范围有限的隐私工具。它不能保证隐藏系统中存在中文字体，也不能让浏览器指纹变成匿名或不可识别。请阅读下方的[保护范围与限制](#保护范围与限制)。

## 功能

- **全站开关**：可一次授权所有 HTTP / HTTPS 网站并持续保护；关闭开关只停用全站脚本，不撤销授权，再次开启不会重复询问。
- **手动站点开关**：也可以只保护当前站点。关闭单站保护时保留该站点授权，再次开启无需重复询问。全站模式开启时，单站开关暂时停用；之前的单站设置会保留。
- **Canvas 2D 字体名映射**：在 `CanvasRenderingContext2D` 和 `OffscreenCanvasRenderingContext2D` 中，将匹配的已知字体名映射为内部不存在的字体名，使 Canvas 使用页面字体栈的回退字体。
- **本地字体枚举过滤**：当 `queryLocalFonts()` 可用时，对该 API 返回的 `family`、`fullName` 和 `postscriptName` 字段过滤匹配项；原生 API 的安全上下文和用户授权要求仍由 Chrome 决定。
- **页面开始时生效**：注册的脚本以 `document_start`、主世界运行，并覆盖匹配站点的框架；启用或关闭时会重新加载当前标签页。
- **按需权限**：安装时不授予网站访问权。用户开启全站模式时，扩展请求 `http://*/*` 和 `https://*/*`；手动模式仅请求当前协议和主机。关闭保护只注销对应脚本，授权会保留，直到用户在 Chrome 扩展设置中撤销。

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

## 如何使用

如果工具栏上看不到 Canvas Font Guard，先点击 Chrome 工具栏的扩展程序（拼图）按钮，将它固定到工具栏，之后就可以直接打开扩展弹窗。

### 保护所有网站

1. 点击 Chrome 工具栏中的 Canvas Font Guard 图标。
2. 点击**开启全站保护**，并在 Chrome 的确认提示中允许访问所有网站。
3. 授权后扩展会注册全站脚本并重新加载当前网页。之后打开的 HTTP / HTTPS 网页会自动应用保护，不需要逐站点击。

全站授权通常只需确认一次。点击**关闭全站保护**会停止全站脚本，但保留授权；之后重新开启无需重复确认。要撤销授权，可在 `chrome://extensions` 中打开 Canvas Font Guard 的详情页管理网站访问权限。

### 只保护当前站点

1. 确保**全站保护**已关闭，然后打开要保护的 `http://` 或 `https://` 网页。
2. 点击工具栏中的 Canvas Font Guard 图标，再点击**开启此站点保护**。
3. 第一次启用该站点时，在 Chrome 权限提示中允许访问。之后关闭再开启无需重复确认。

单站保护适用于当前**协议 + 主机名**。Chrome 的主机匹配规则不区分端口，因此同一协议、同一主机下的不同端口共用开关；HTTP 和 HTTPS 分别授权。Chrome 内置页面、扩展页面和 `file://` 页面不支持手动模式。

### 关闭保护与刷新页面

- 在弹窗点击**关闭全站保护**可停用全站脚本；关闭**此站点保护**可停用当前站点脚本。关闭不会自动撤销已授予的权限，因此再次开启时无需重复授权。
- 全站和单站设置可以共存。全站开启时单站开关会暂时禁用；关闭全站后，之前单独启用的站点仍会按原设置保护。
- 切换开关后，当前支持的网页会自动重新加载；其他已经打开的标签页需要手动刷新，保护状态才会更新。
- 如果要停止所有站点的保护，先关闭全站保护，再逐个关闭仍启用的单站保护；要撤销访问授权，请到 `chrome://extensions` 的扩展详情页管理。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 用户点击扩展图标后读取当前标签页地址，以确定弹窗显示和操作的站点。 |
| `scripting` | 在用户选择启用的站点注册 `document_start` 脚本。 |
| 可选的 `http://*/*` 和 `https://*/*` 主机权限 | 全站模式启用时请求 HTTP / HTTPS 全站访问权；手动模式启用时只请求当前协议和主机。安装时不会自动授权。关闭保护只停用对应脚本并保留授权；用户可在 Chrome 扩展详情页撤销。 |

扩展不使用 `storage`、cookies、历史记录、书签、下载或网络请求权限。保护状态由 Chrome 保存的内容脚本注册表示；已授予的主机权限在保护关闭后保留，避免重复授权提示。

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

扩展在本机运行，不包含遥测、广告、远程代码或向开发者服务器发送数据的功能。启用保护时，Chrome 会保存相应的主机授权和内容脚本注册；关闭全站或单站开关会停止相应保护脚本，但授权仍留在 Chrome 中，用户可在扩展设置中撤销。

## 开发与检查

扩展是原生 Manifest V3 文件，不需要打包器或依赖安装。修改后可在 `chrome://extensions` 点击扩展卡片上的刷新按钮，再重新加载目标网页。

- [`manifest.json`](manifest.json)：扩展元数据、权限和弹窗配置。
- [`popup.html`](popup.html)、[`popup.css`](popup.css)、[`popup.js`](popup.js)：全站和逐站点权限与开关界面。
- [`guard.js`](guard.js)：字体名单与页面上下文保护逻辑。

## 许可证

本项目以 [MIT License](LICENSE) 发布。
