(() => {
    "use strict";

    const viewerUrl = chrome.runtime.getURL("pdf/viewer.html");

    function isViewerPage(url) {
        return typeof url === "string" && url.startsWith(viewerUrl);
    }

    function isPdfUrl(url) {
        if (typeof url !== "string" || isViewerPage(url)) {
            return false;
        }

        try {
            const parsed = new URL(url);
            if (parsed.protocol === "file:") {
                return /\.pdf$/i.test(parsed.pathname);
            }
            if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                return /\.pdf(?:$|[?#])/i.test(`${parsed.pathname}${parsed.search}`);
            }
        } catch (error) {
            return false;
        }

        return false;
    }

    function redirect(url) {
        window.location.replace(
            `${viewerUrl}?file=${encodeURIComponent(url)}`
        );
    }

    chrome.storage.sync.get(["OtherSettings"], (result) => {
        const usePdfJs = result?.OtherSettings?.UsePDFjs;
        const currentUrl = window.location.href;

        if (usePdfJs && isPdfUrl(currentUrl)) {
            redirect(currentUrl);
        }
    });
})();
