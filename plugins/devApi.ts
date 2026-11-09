import type { Plugin, ViteDevServer } from 'vite';

/**
 * مشغّل مسارات /api المحلية. دوال Vercel Serverless ما تشتغل تحت `vite dev`،
 * فهنا نفس الملفات تُحمَّل وتُنفَّذ كـ middleware، بنفس شكل req/res.
 * لا تؤثر على البناء ولا على الإنتاج إطلاقاً.
 */
const BLOCK = /(^|[/_])_lib([/.]|$)/;

function makeRes(raw: any, done: () => void) {
    const headers: Record<string, string> = {};
    const res: any = {
        statusCode: 200,
        getHeader: (k: string) => headers[String(k).toLowerCase()],
        setHeader(k: string, v: any) {
            headers[String(k).toLowerCase()] = v;
            try { raw.setHeader(k, v); } catch { /* البث بدأ */ }
            return res;
        },
        setStatusBarCode(c: number) { res.statusCode = c; return res; },
        status(c: number) { res.statusCode = c; return res; },
        json(obj: any) {
            if (!raw.headersSent) raw.writeHead(res.statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
            raw.end(JSON.stringify(obj)); done();
            return res;
        },
        end(chunk?: any) {
            if (!raw.headersSent) raw.writeHead(res.statusCode, headers);
            raw.end(chunk); done();
            return res;
        },
    };
    return res;
}

function readBody(raw: any): Promise<any> {
    return new Promise(resolve => {
        if (raw.method === 'GET' || raw.method === 'HEAD') return resolve(undefined);
        let data = '';
        raw.on('data', (c: any) => { data += c; if (data.length > 1e6) { resolve({}); raw.destroy(); } });
        raw.on('end', () => {
            if (!data) return resolve(undefined);
            try {
                const ct = String(raw.headers['content-type'] || '');
                if (ct.includes('application/x-www-form-urlencoded')) {
                    resolve(Object.fromEntries(new URLSearchParams(data)));
                } else resolve(JSON.parse(data));
            } catch { resolve({}); }
        });
        raw.on('error', () => resolve({}));
    });
}

export default function devApi(): Plugin {
    let server: ViteDevServer | null = null;
    return {
        name: 'icg1-dev-api',
        apply: 'serve',
        configureServer(s) {
            server = s;
            s.middlewares.use(async (raw: any, out: any, next: () => void) => {
                const url = raw.url || '';
                if (!url.startsWith('/api/') || BLOCK.test(url)) return next();

                const path = url.split('?')[0].replace(/\/$/, '');
                const query = Object.fromEntries(new URL(url, 'http://local').searchParams);
                let mod: any;
                try {
                    mod = await s.ssrLoadModule(`${path}.ts`);
                } catch (e: any) {
                    console.error('[dev-api] load failed', path, e?.message || e);
                    out.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    out.end(JSON.stringify({ error: `مسار غير موجود: ${path}`, detail: String(e?.message || e) }));
                    return;
                }
                const handler = mod?.default;
                if (typeof handler !== 'function') {
                    out.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    out.end(JSON.stringify({ error: `${path} بلا معالج` }));
                    return;
                }
                const req: any = {
                    method: raw.method,
                    url,
                    headers: raw.headers,
                    socket: raw.socket,
                    query,
                    body: await readBody(raw),
                };
                let settled = false;
                const res = makeRes(out, () => { settled = true; });
                try {
                    await handler(req, res);
                } catch (e: any) {
                    console.error('[dev-api]', path, e);
                    if (!out.headersSent) out.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    if (!out.writableEnded) out.end(JSON.stringify({ error: String(e?.message || e) }));
                }
                if (!settled && !out.writableEnded) out.end();
            });
        },
    };
}
