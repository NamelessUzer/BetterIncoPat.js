// ==UserScript==
// @name         BetterIncopat
// @namespace    http://incopat.com/
// @version      0.85
// @description  去除incoPat检索结果页面、IPC分类查询页面两侧的空白，有效利用宽屏显示器；专利详情查看页，添加有用的复制按钮、跳过文件名选择对话框。
// @author       You
// @include      *incopat.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  function AddCustomStyle() {
    // 注意 @run-at document-start 时，GM_addStyle 也可以生效
    GM_addStyle(".middle,#container{width:100% !important;}");

    // 去掉这里比较容易出错的空格
    if (window.location.href === "https://ipc.incopat.com/index") {
      GM_addStyle(".floor_con, #container{width:100% !important;}");
    }
  }

  function CreateURLfileAndDownload(url, num) {
    const content = `[InternetShortcut]
URL=${url}`;

    // 直接使用GM_download保存文件代替FileSaver.js
    GM_download({
      url: "data:text/plain;charset=utf-8," + encodeURIComponent(content),
      name: `${num}.url`,
      saveAs: false // 不显示保存对话框
    });
  }

  function SkipPdfNameSelectDialog() {
    // 去掉多余空格
    if (!window.location.href.startsWith("https://www.incopat.com/detail/")) {
      return;
    }
    const pdfBtn = document.querySelector("#pdfBtn");
    if (pdfBtn) {
      pdfBtn.addEventListener("click", function () {
        setTimeout(() => {
          // 有时这个元素没渲染好，要先判空
          const pdfDialog = document.querySelector("#xxzlpdfCongener");
          if (pdfDialog) pdfDialog.click();
        }, 20);
      });
    }
  }

  function AddCopyButtons() {
    // 同样去掉多余空格
    if (!window.location.href.startsWith("https://www.incopat.com/detail/")) {
      return;
    }

    // === 处理 currentAn / currentPn / currentPnc 未定义的问题 ===
    // 如果 incopat 的页面本身会注入这几个变量，就尝试从 window 里拿
    // 如果页面本身没有，那就先给个默认值，避免报错
    const pageScope = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (typeof pageScope.currentPn === 'undefined') {
      pageScope.currentPn = "TEST_PN";
    }
    if (typeof pageScope.currentAn === 'undefined') {
      pageScope.currentAn = "TEST_AN";
    }
    if (typeof pageScope.currentAd === 'undefined') {
      pageScope.currentAd = "TEST_AD";
    }
    if (typeof pageScope.currentPnc === 'undefined') {
      // 给一个假对象，至少有 in_array 方法，避免报错
      pageScope.currentPnc = {
        in_array: function () {
          return false;
        }
      };
    }

    const currentPn = pageScope.currentPn;
    const currentAn = pageScope.currentAn;
    const currentAd = pageScope.currentAd;
    const currentPnc = pageScope.currentPnc;

    // shareAddr 里取到 Query=xxx 的值
    const shareAddr = document.querySelector("#shareAddr");
    if (!shareAddr) return;
    const regex = /(?<=Query=)[0-9a-z%]+(?=&|)/i;
    const match = shareAddr.value.match(regex);
    if (!match) return;
    const url = `https://www.incopat.com/detail/initCompareNoAuth?compareQuery=${match[0]}`;

    // 页面头部 title
    const headElement = document.querySelector(".title");
    if (!headElement) return;

    // var num = currentPn; var title = headElement.querySelector("#copyText").innerText;
    const numEl = headElement.querySelector("#copyText");
    if (!numEl) return;
    const num = currentPn;
    const title = numEl.innerText;
    const combinedInfo = `${num}\t${title}\t${url}`;

    // 找到用来插入的锚点（脚本里原本是 titleBtn 或者 pdfBtn ）
    let pdfBtn = document.querySelector("#pdfBtn");
    let titleBtn = headElement.querySelector(".copy");
    // 如果 pdfBtn 有可能不存在，就优先用 titleBtn，当它们都不存在时，就把 headElement 作为容器
    const targetElement = pdfBtn || titleBtn || headElement;

    // ==== 封装一个插入按钮的小函数 ====
    function createButton(text, titleTip, onClick) {
      const btn = document.createElement("a");
      btn.textContent = text;
      if (titleTip) btn.title = titleTip; // 鼠标悬停提示
      btn.addEventListener("click", onClick);
      // 在 targetElement 之前插入
      targetElement.parentNode.insertBefore(btn, targetElement);
      return btn;
    }

    // -- 依次创建想要的按钮 --
    createButton(num, "", () => GM_setClipboard(num)); // 复制申请号
    createButton(
      title.length < 120 ? title : title.slice(0, 120) + "...",
      title,
      () => GM_setClipboard(title)
    ); // 复制标题
    createButton("链接", url, () => GM_setClipboard(url)); // 复制链接
    createButton("号码、标题、链接", combinedInfo, () => GM_setClipboard(combinedInfo));

    // -- “官方检索”按钮
    const openOffsiteBtn = createButton("官方网站", "", () => {});
    // -- “AN.url下载”按钮（部分专利才会插入）
    let anUrlDownloadBtn;

    // 官方链接在不同国家/地区专利号下处理不一样
    let officialURL = "";
    let officialNumber = "";

    if (/^CN\d+(?:[ABCDSUY]\d?)?$/i.test(num)) {
      openOffsiteBtn.textContent = "国家知识产权局";
      officialNumber = num;
      officialURL = `http://epub.cnipa.gov.cn/patent/${officialNumber}`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

    } else if (/^TW([IM]?\d+)/i.test(num)) {
      openOffsiteBtn.textContent = "台湾经济部智慧财产局";
      officialNumber = num.match(/^TW([IM]?\d+)/i)[1];
      officialURL = `https://tiponet.tipo.gov.tw/twpat3/twpatc/twpatkm?!!FRURL${officialNumber}`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

      anUrlDownloadBtn = createButton("AN.url下载", "", () => {
        CreateURLfileAndDownload(officialURL, currentAn);
      });

    } else if (/^EP(\d+)/i.test(num)) {
      openOffsiteBtn.textContent = "欧洲专利局";
      officialNumber = currentAn;
      officialURL = `https://worldwide.espacenet.com/patent/search?q=ap%3D${officialNumber}`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

      anUrlDownloadBtn = createButton("AN.url下载", "", () => {
        CreateURLfileAndDownload(officialURL, currentAn);
      });

    } else if (/^EU(\d{13})S/i.test(num)) {
      openOffsiteBtn.textContent = "欧盟知识产权局";
      // 拆分 currentPn 生成官方查询号
      officialNumber = currentPn.slice(2,-5) + "-" + currentPn.slice(-5, -1);
      officialURL = `https://euipo.europa.eu/eSearch/#details/designs/${officialNumber}`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

      anUrlDownloadBtn = createButton("AN.url下载", "", () => {
        CreateURLfileAndDownload(officialURL, currentPn.slice(0, -1));
      });

    } else if (/^RU(\d+)S/i.test(num)) {
      openOffsiteBtn.textContent = "俄罗斯联邦知识产权局";
      officialNumber = currentPn.slice(2,-1).padStart(8, "0");
      officialURL = `https://www.fips.ru/cdfi/fips.dll?ty=29&docid=${officialNumber}&ki=S`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

      anUrlDownloadBtn = createButton("AN.url下载", "", () => {
        CreateURLfileAndDownload(officialURL, "RU" + officialNumber + "S");
      });

    } else if (/^US(\d+)/i.test(num)) {
      openOffsiteBtn.textContent = "美国专利商标局";
      const m = currentAn.match(/US(\d+)/i);
      officialNumber = m ? m[1] : "000000"; // 解析不出就给个默认
      officialURL = `https://globaldossier.uspto.gov/#/result/application/US/${officialNumber}/123456`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

      anUrlDownloadBtn = createButton("AN.url下载", "", () => {
        CreateURLfileAndDownload(officialURL, currentAn);
      });

    } else if (/WO(?:[A-Z]{2})?(\d+)/i.test(num)) {
      openOffsiteBtn.textContent = "世界知识产权组织";
      const w = num.match(/WO(?:[A-Z]{2})?(\d+)/i);
      officialNumber = w ? w[1] : "";
      officialURL = `https://patentscope2.wipo.int/search/zh/detail.jsf?docId=WO${officialNumber}`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

      anUrlDownloadBtn = createButton("AN.url下载", "", () => {
        CreateURLfileAndDownload(officialURL, currentAn);
      });

    } else if (currentPnc.in_array("KR")) {
      openOffsiteBtn.textContent = "韩国知识产权局";
      officialNumber = currentAn.slice(2);
      // officialURL = `https://doi.org/10.8080/${officialNumber}?urlappend=en`;
      // 韩国专利局官网不再支持直接在网址中添加参数指定英文显示页面
      officialURL = `https://doi.org/10.8080/${officialNumber}`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

      anUrlDownloadBtn = createButton("AN.url下载", "", () => {
        CreateURLfileAndDownload(officialURL, currentAn);
      });

    } else if (currentPnc.in_array("CA")) {
      openOffsiteBtn.textContent = "加拿大知识产权局";
      officialNumber = currentAn.slice(2);
      officialURL = `https://www.ic.gc.ca/opic-cipo/cpd/eng/patent/${officialNumber}/summary.html`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

      anUrlDownloadBtn = createButton("AN.url下载", "", () => {
        CreateURLfileAndDownload(officialURL, currentAn);
      });

    } else if (currentPnc.in_array("AU")) {
      openOffsiteBtn.textContent = "澳大利亚知识产权局";
      officialNumber = currentAn.slice(2);
      officialURL = `http://pericles.ipaustralia.gov.au/ols/auspat/applicationDetails.do?applicationNo=${officialNumber}`;
      openOffsiteBtn.onclick = () => window.open(officialURL);

      anUrlDownloadBtn = createButton("AN.url下载", "", () => {
        CreateURLfileAndDownload(officialURL, currentAn);
      });
    } else if (currentPnc.in_array("JP") && (currentAn.match(/JP[TS]?-?(?<year>(?:19|20)\d{2})(?<sn>\d{6})[U]?/i) || currentAd.match(/^\d{8}$/))) {
      openOffsiteBtn.textContent = "日本特许厅";
      // 处理日本专利官网静态链接生成

      // 解析申请号
      const jpAnMatch = currentAn.match(/JP[TS]?-?(?<year>\d{2,4})(?<sn>\d{6})[U]?/i);
      if (jpAnMatch) {
        const yearInAn = jpAnMatch.groups.year;
        const sn = jpAnMatch.groups.sn;

        // 如果申请号中的年份是4位且以19或20开头，则直接使用，否则从申请日中提取年份
        const year = (yearInAn.length === 4 && (/^(?:19|20)\d{2}/i.test(yearInAn))) ? yearInAn : currentAd.slice(0, 4);

        const officialNumber = `JP-${year}-${sn}`;
        let officialURL = `https://www.j-platpat.inpit.go.jp/c1801/PU/${officialNumber}/10/en`;

        openOffsiteBtn.textContent = "日本特许厅";
        openOffsiteBtn.onclick = () => window.open(officialURL);

        anUrlDownloadBtn = createButton("AN.url下载", "", () => {
          CreateURLfileAndDownload(officialURL, currentAn);
        });
      }
    } else {
      openOffsiteBtn.textContent = currentAn;
      openOffsiteBtn.onclick = () => GM_setClipboard(currentAn);
    }

    // 额外再加一个 “PN.url下载” 按钮
    createButton("PN.url下载", "", () => {
      CreateURLfileAndDownload(url, num);
    });

    // 最后把原页面中的号码/标题/复制按钮等删掉
    // 原脚本是这样写的：
    //   HeadElement.getElementsByTagName("span")[0].remove();
    //   HeadElement.getElementsByTagName("span")[0].remove();
    //   HeadElement.getElementsByClassName("copy")[0].remove();
    // 有时候不一定是两个 span，所以更安全是把所有都删：
    const spans = headElement.getElementsByTagName("span");
    while (spans.length > 0) {
      spans[0].remove();
    }
    const copyEls = headElement.getElementsByClassName("copy");
    while (copyEls.length > 0) {
      copyEls[0].remove();
    }
  }

  function DOM_ContentReady() {
    console.log("==> DOMContentLoaded");
    SkipPdfNameSelectDialog();
    AddCopyButtons();
  }

  function pageFullyLoaded() {
    console.log("==> window onload (所有资源都加载完)");
  }

  function Main() {
    AddCustomStyle();
    // 在 DOMContentLoaded 时再执行后面的按钮插入操作
    document.addEventListener("DOMContentLoaded", DOM_ContentReady);
    // onload 只是做一个示例，具体可不需要
    window.addEventListener("load", pageFullyLoaded);
  }

  Main();

})();
