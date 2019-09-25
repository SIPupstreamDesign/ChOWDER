(() => {
    const originalAddEventListener = window.addEventListener;
    let resizeListeners = []; 
    window.addEventListener = (type, listener, capture) => {
        if (type === "resize") {
            resizeListeners.push(listener);
        }
        originalAddEventListener(type, listener, capture);
    }

    const originalRemoveEventListener = window.removeEventListener;
    window.removeEventListener = (type, listener, capture) => {
        if (type === "resize" && listener == undefined) {
            for (let i = 0; i < resizeListeners.length; ++i) {
                originalRemoveEventListener(type, resizeListeners[i], capture);
            }
            resizeListeners = []; 
        } else {
            originalRemoveEventListener(type, listener, capture);
        }
    }
    
    function injectChOWDER(view, viewerDiv)
    {
        let width = viewerDiv.getBoundingClientRect().right - viewerDiv.getBoundingClientRect().left;
        let height = viewerDiv.getBoundingClientRect().bottom - viewerDiv.getBoundingClientRect().top;
        let fullWidth = width;
        let fullHeight = height;
        window.removeEventListener("resize");
        setTimeout(() => {
            let rect = document.body.rect;
            if (!rect) return;
            document.body.style.pointerEvents = "none"
            viewerDiv.style.left = parseInt(rect.x) + "px";
            viewerDiv.style.top = parseInt(rect.y) + "px";
            viewerDiv.style.width = parseInt(rect.w) + "px";
            viewerDiv.style.height = parseInt(rect.h) + "px";
            viewerDiv.style.position = "relative";
            view.camera.camera3D.setViewOffset(fullWidth, fullHeight, rect.x, rect.y, rect.w, rect.h)
            console.error(rect.x, rect.y, rect.w, rect.h)
            view.mainLoop.gfxEngine.renderer.setSize(rect.w, rect.h);
            view.notifyChange();
        }, 1000);
    };
    window.injectChOWDER = injectChOWDER;
})();