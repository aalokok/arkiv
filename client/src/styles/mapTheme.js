// Recolors the Mapbox style's land layers with the design-system primary color
// (--color-primary in tokens.css), so the globe follows the brand without editing
// the style in Mapbox Studio. Call it on every 'style.load'.

const LAND_LAYERS = [
    ['land', 'background-color'],
    ['land-structure-polygon', 'fill-color'],
    ['land-structure-line', 'line-color'],
    ['national-park', 'fill-color'],
    ['bridge-case-simple', 'line-color'],
];

const GLACIER_GRAY = 'rgb(237, 237, 237)';

// Reads a design token from tokens.css (var() references resolve to their final value)
export function getToken(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export const getBrandPrimary = () => getToken('--color-primary', '#D6FFB2');

const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

// The style's land is mauve (143,158,251) on gray water (231,231,233).
const STYLE_LAND = [143, 158, 251];
const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Static Mapbox images can't be restyled, so recolor the land pixels in a canvas.
 * "Blueness" (b - r) picks out land; edge pixels blend so coastlines stay smooth.
 * Resolves to a data URL, or the original URL if anything fails.
 */
export function recolorMapImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const px = data.data;
                const primary = hexToRgb(getBrandPrimary());
                const landLuma = luma(STYLE_LAND);
                const maxBlueness = STYLE_LAND[2] - STYLE_LAND[0];

                for (let i = 0; i < px.length; i += 4) {
                    const r = px[i], g = px[i + 1], b = px[i + 2];
                    const amount = Math.min(1, Math.max(0, (b - r) / maxBlueness));
                    if (amount === 0) continue;
                    const shade = luma([r, g, b]) / landLuma; // keeps darker label text darker
                    for (let c = 0; c < 3; c++) {
                        const target = Math.min(255, primary[c] * shade);
                        px[i + c] = px[i + c] + (target - px[i + c]) * amount;
                    }
                }
                ctx.putImageData(data, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                resolve(url);
            }
        };
        img.onerror = () => resolve(url);
        img.src = url;
    });
}

export function applyBrandToMap(map) {
    const primary = getBrandPrimary();

    LAND_LAYERS.forEach(([layer, property]) => {
        if (map.getLayer(layer)) map.setPaintProperty(layer, property, primary);
    });

    // landuse keeps glaciers gray and paints everything else in the brand color
    if (map.getLayer('landuse')) {
        map.setPaintProperty('landuse', 'fill-color', ['match', ['get', 'class'], 'glacier', GLACIER_GRAY, primary]);
    }
}
