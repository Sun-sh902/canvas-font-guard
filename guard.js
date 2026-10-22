(() => {
  "use strict";

  const installedKey = "__canvasFontGuardInstalled_v1";
  if (window[installedKey]) return;
  Object.defineProperty(window, installedKey, { value: true, configurable: false });
  const fallbackFamily = "__CanvasFontGuardAbsent_6F2D4A9B__";

  // This is a targeted list, not a claim that every CJK font family is known.
  // Native Chinese family-name aliases are kept verbatim: matching must use the
  // exact names the OS and browser expose, so translating them would break it.
  const protectedFamilies = [
    "Microsoft YaHei UI", "Microsoft YaHei", "Microsoft JhengHei UI", "Microsoft JhengHei",
    "微软雅黑", "微软正黑体", "MicrosoftYaHei", "MicrosoftJhengHei",
    "PingFang SC", "PingFang TC", "PingFang HK", "PingFang", "PingFangSC", "PingFangTC", "苹方",
    "MiSans VF", "MiSans", "Mi Sans", "MiSansVF", "小米兰亭", "小米兰亭 Pro",
    "HarmonyOS Sans SC", "HarmonyOS Sans TC", "HarmonyOS Sans", "HarmonyOSSansSC", "HarmonyOSSans",
    "鸿蒙黑体", "Huawei Sans", "华为鸿蒙字体",
    "SimSun", "NSimSun", "SimHei", "KaiTi", "KaiTi_GB2312", "FangSong", "FangSong_GB2312",
    "宋体", "新宋体", "黑体", "楷体", "仿宋", "等线", "隶书", "幼圆",
    "STHeiti", "STHeiti SC", "STSong", "STSongti", "Songti SC", "Kaiti SC", "Hiragino Sans GB",
    "华文黑体", "华文宋体", "华文楷体", "华文仿宋", "冬青黑体",
    "Source Han Sans SC", "Source Han Serif SC", "Source Han Sans", "Source Han Serif",
    "Noto Sans CJK SC", "Noto Serif CJK SC", "Noto Sans CJK", "Noto Serif CJK",
    "思源黑体", "思源宋体", "文泉驿", "WenQuanYi Zen Hei", "WenQuanYi Micro Hei",
    "DFKai-SB", "MingLiU", "PMingLiU", "标楷体",
    "OPPO Sans", "OPPOSans", "vivo Sans", "vivoSans", "Alibaba PuHuiTi", "阿里巴巴普惠体",
    "Tencent Sans", "腾讯体", "DingTalk JinBuTi", "钉钉进步体"
  ];

  const alternatives = [...protectedFamilies]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const familyToken = new RegExp(`(^|[^A-Za-z0-9_-])(?:${alternatives})(?=$|[^A-Za-z0-9_-])`, "gi");
  const knownName = new RegExp(alternatives, "i");

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function remapFontDescriptor(value) {
    return String(value).replace(familyToken, `$1${fallbackFamily}`);
  }

  function containsProtectedFamily(value) {
    return knownName.test(String(value));
  }

  function patchFontProperty(prototype) {
    if (!prototype) return;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "font");
    if (!descriptor?.get || !descriptor?.set || descriptor.configurable === false) return;
    const requestedFonts = new WeakMap();

    try {
      Object.defineProperty(prototype, "font", {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get() {
          return requestedFonts.has(this)
            ? requestedFonts.get(this)
            : descriptor.get.call(this);
        },
        set(value) {
          const previous = descriptor.get.call(this);
          const remapped = remapFontDescriptor(value);
          descriptor.set.call(this, remapped);
          const current = descriptor.get.call(this);
          const validFont = window.CSS?.supports?.("font", remapped) === true;
          if (current !== previous || remapped === previous || validFont) {
            requestedFonts.set(this, String(value));
          }
        }
      });
    } catch {
      // Leave this context type untouched if Chrome does not allow the wrapper.
    }
  }

  patchFontProperty(window.CanvasRenderingContext2D?.prototype);
  patchFontProperty(window.OffscreenCanvasRenderingContext2D?.prototype);

  // Filter names only when the page already has access to Chrome's local-font
  // enumeration API. The native call retains its normal permission behavior.
  if (typeof window.queryLocalFonts === "function") {
    const nativeQueryLocalFonts = window.queryLocalFonts;
    try {
      Object.defineProperty(window, "queryLocalFonts", {
        configurable: true,
        writable: true,
        value: function queryLocalFonts(...args) {
          return Reflect.apply(nativeQueryLocalFonts, this, args).then((fonts) =>
            fonts.filter((font) => ![
              font.family,
              font.fullName,
              font.postscriptName
            ].some(containsProtectedFamily))
          );
        }
      });
    } catch {
      // The Canvas font descriptor guard remains active if this API is locked.
    }
  }
})();
