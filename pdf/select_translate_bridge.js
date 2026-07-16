(() => {
    "use strict";

    function isExtensionContextValid() {
        try {
            return (
                typeof chrome !== "undefined" &&
                Boolean(chrome.runtime && chrome.runtime.id)
            );
        } catch (error) {
            return false;
        }
    }

    function sendServiceRequest(service, params) {
        if (!isExtensionContextValid()) {
            return Promise.reject(new Error("Extension context invalidated"));
        }

        const message = JSON.stringify({
            type: "service",
            service,
            params,
        });

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve(response);
            });
        });
    }

    function dispatchDisplayEvent(event, detail, retryCount = 0) {
        const channel = window.__edgeTranslateDisplayChannel;
        if (!channel?._eventManager?.emit) {
            if (retryCount < 20) {
                window.setTimeout(() => {
                    dispatchDisplayEvent(event, detail, retryCount + 1);
                }, 50);
            }
            return false;
        }

        channel._eventManager.emit(event, detail, {
            id: chrome.runtime.id,
            url: window.location.href,
        });
        return true;
    }

    function getSelectionPayload() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const text = selection.toString().trim().replace(/\n/g, " ");
        if (!text) {
            return null;
        }

        const range = selection.getRangeAt(selection.rangeCount - 1);
        const rect = range.getBoundingClientRect();

        return {
            text,
            position: [rect.left, rect.top],
        };
    }

    function shouldSkipDuplicate(text) {
        return Boolean(
            window.isDisplayingResult &&
            window.translateResult &&
            window.translateResult.originalText === text
        );
    }

    function requestTranslate() {
        if (!isExtensionContextValid()) {
            return;
        }

        chrome.storage.sync.get(["OtherSettings"], (result) => {
            const settings = result?.OtherSettings;
            if (!settings?.TranslateAfterSelect) {
                return;
            }

            const payload = getSelectionPayload();
            if (!payload || shouldSkipDuplicate(payload.text)) {
                return;
            }

            const timestamp = Date.now();
            const startDetail = {
                ...payload,
                timestamp,
            };

            dispatchDisplayEvent("start_translating", startDetail);

            sendServiceRequest("translate_pdf_selection", {
                text: payload.text,
            })
                .then((result) => {
                    dispatchDisplayEvent("translating_finished", {
                        timestamp,
                        originalText: payload.text,
                        ...result,
                    });
                })
                .catch((error) => {
                    dispatchDisplayEvent("translating_error", {
                        error:
                            error && error.message
                                ? error.message
                                : String(error),
                        timestamp,
                    });
                    console.error("PDF selection translate failed:", error);
                });
        });
    }

    function bindSelectionTranslate() {
        const viewerContainer = document.getElementById("viewerContainer");
        if (!viewerContainer) {
            return;
        }

        document.addEventListener("mouseup", () => {
            window.setTimeout(requestTranslate, 0);
        });

        document.addEventListener("dblclick", () => {
            window.setTimeout(requestTranslate, 0);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindSelectionTranslate, {
            once: true,
        });
    } else {
        bindSelectionTranslate();
    }
})();
