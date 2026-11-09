export const getAssetUrl = (path: string | null | undefined) => {
    if (!path) return null;

    // If it's already a full URL, return it
    if (path.startsWith('http')) return path;

    // Remove leading slash if exists to avoid doubles
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;

    // Get base URL from Vite or fall back to current origin
    // Note: import.meta.env.BASE_URL is usually './' or '/' or '/repo/'
    const baseUrl = import.meta.env.BASE_URL || './';

    // Handle relative base paths
    if (baseUrl === './' || baseUrl === '') {
        return `/${cleanPath}`;
    }

    // Ensure base URL ends with a slash and no leading slash on path
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${normalizedBase}${cleanPath}`;
};

export const getFrameUrl = (path: string | null | undefined) => {    if (!path) return '';
    if (path.startsWith('http')) return path;

    // Remove leading slash
    let cleanPath = path.startsWith('/') ? path.substring(1) : path;

    // Auto-prefix with frame/ if it's just a filename and not already prefixed
    if (!cleanPath.startsWith('frame/') && !cleanPath.includes('/')) {
        cleanPath = `frame/${cleanPath}`;
    }

    return getAssetUrl(cleanPath) || '';
};

/**
 * صور كيك روابط S3 موقّعة تنتهي صلاحيتها بعد دقائق. استخدام رابط منتهي يعرض
 * أيقونة الصورة المكسورة بدل صورة العضو، فلازم تُستبدل برابط جديد من كيك.
 */
export const isExpiredSignedUrl = (url: string | null | undefined): boolean => {
    if (!url || !url.includes('X-Amz-Date=')) return false;
    const stamp = /[?&]X-Amz-Date=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(url);
    if (!stamp) return false;
    const seconds = Number(/[?&]X-Amz-Expires=(\d+)/.exec(url)?.[1] || 600);
    const issued = Date.UTC(+stamp[1], +stamp[2] - 1, +stamp[3], +stamp[4], +stamp[5], +stamp[6]);
    return Date.now() > issued + seconds * 1000;
};

