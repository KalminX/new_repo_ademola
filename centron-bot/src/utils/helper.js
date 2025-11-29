export function formatDurationPretty(minutes) {
    if (!minutes) return "-";
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;

    let parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);

    return parts.join(" ") || `${minutes}m`;
}


export function formatDurationPrettyNew(minutes) {
    if (!minutes) return "-";
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;

    const parts = [];
    if (d) parts.push(`${d} day${d !== 1 ? "s" : ""}`);
    if (h) parts.push(`${h} hour${h !== 1 ? "s" : ""}`);
    if (m) parts.push(`${m} minute${m !== 1 ? "s" : ""}`);

    return parts.join(" ") || `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}



export function normalize(seed) {
    return seed
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}