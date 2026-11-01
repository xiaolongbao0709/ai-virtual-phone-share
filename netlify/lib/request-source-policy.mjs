// A targeted source restriction, not authentication. Missing/forged source headers
// cannot identify a site; unrelated self-hosted clients retain existing behavior.
const BLOCKED_HOST = "yetland.cn";

function isBlockedSourceUrl(value) {
    if (!value) return false;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") return false;
        const host = url.hostname.toLowerCase().replace(/\.+$/, "");
        return host === BLOCKED_HOST || host.endsWith(`.${BLOCKED_HOST}`);
    } catch {
        return false;
    }
}

export function isBlockedRequestSource(headers) {
    return isBlockedSourceUrl(headers.get("origin"))
        || isBlockedSourceUrl(headers.get("referer"));
}
