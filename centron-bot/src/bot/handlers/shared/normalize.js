export function normalize(seed) {
    return seed
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}