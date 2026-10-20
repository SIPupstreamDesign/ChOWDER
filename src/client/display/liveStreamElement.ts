/** Displayごとのlive-stream DOMコンテナを安定して取得する。 */
export function ensureLiveStreamElement(contentArea: HTMLElement, metadataId: string): HTMLElement {
    const elementId = `content-${metadataId}`;
    const existingElement = document.getElementById(elementId);
    if (existingElement !== null) {
        return existingElement;
    }

    const element = document.createElement('div');
    element.id = elementId;
    element.className = 'content-item';
    contentArea.appendChild(element);
    return element;
}