// Svelte action: クリック外でハンドラ発火
export function clickOutside(node: HTMLElement, onAway: () => void) {
    const handler = (e: MouseEvent) => {
        if (!node.contains(e.target as Node)) onAway();
    };
    document.addEventListener("mousedown", handler);
    return {
        destroy() {
            document.removeEventListener("mousedown", handler);
        },
    };
}
