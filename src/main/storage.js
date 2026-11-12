// Board folder access for the renderer. Everything is relative to a "root": a board folder the person picked
// in a native dialog (or reopened from the recent list). The renderer only ever sees an opaque root token plus
// plain name segments; this module rejects anything that could reach outside the root.
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const roots = new Map(); // token -> { real: absolute real path, name }

function fail(name, message) {
  const e = new Error(message || name);
  e.name = name;
  return e;
}

// one path segment: a plain file or folder name, nothing that could climb or jump elsewhere
const BAD_SEG = /[/\\\0]|^\.\.?$|^[a-zA-Z]:|^\s*$/;
function checkSegs(segs) {
  if (!Array.isArray(segs) || segs.length > 8) throw fail('TypeError', 'bad path');
  for (const s of segs)
    if (typeof s !== 'string' || s.length > 255 || BAD_SEG.test(s)) throw fail('TypeError', 'bad name');
  return segs;
}

async function register(dirPath) {
  const real = await fsp.realpath(dirPath);
  const st = await fsp.stat(real);
  if (!st.isDirectory()) throw fail('TypeMismatchError', 'not a folder');
  for (const [tok, r] of roots) if (r.real === real) return { root: tok, name: r.name };
  const tok = crypto.randomBytes(12).toString('hex');
  roots.set(tok, { real, name: path.basename(real) || real });
  return { root: tok, name: roots.get(tok).name };
}
function rootOf(tok) {
  const r = roots.get(tok);
  if (!r) throw fail('NotFoundError', 'unknown folder');
  return r;
}
function rootPath(tok) {
  return rootOf(tok).real;
}

function inside(real, base) {
  return real === base || real.startsWith(base.endsWith(path.sep) ? base : base + path.sep);
}

// absolute path for (root, segs); follows symlinks of whatever already exists and refuses anything outside the root
async function resolve(tok, segs) {
  const base = rootOf(tok).real;
  const target = path.join(base, ...checkSegs(segs));
  if (!inside(target, base)) throw fail('SecurityError', 'outside the board folder');
  let probe = target;
  for (;;) {
    // the nearest part of the path that exists must still be inside the root
    try {
      const real = await fsp.realpath(probe);
      if (!inside(real, base)) throw fail('SecurityError', 'outside the board folder');
      break;
    } catch (e) {
      if (e.name === 'SecurityError') throw e;
      if (probe === base) break;
      probe = path.dirname(probe);
    }
  }
  return target;
}

async function stat(tok, segs) {
  const p = await resolve(tok, segs);
  try {
    const s = await fsp.stat(p);
    return { kind: s.isDirectory() ? 'directory' : 'file', size: s.size, mtime: s.mtimeMs };
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null;
    throw e;
  }
}
async function mkdir(tok, segs) {
  await fsp.mkdir(await resolve(tok, segs), { recursive: true });
}

// rename that copes with Windows briefly locking files (antivirus, indexer)
async function renameRetry(a, b) {
  for (let i = 0; ; i++) {
    try {
      return await fsp.rename(a, b);
    } catch (e) {
      if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      await new Promise(r => setTimeout(r, 40 * (i + 1)));
    }
  }
}
function tmpName(p) {
  return path.join(path.dirname(p), '.' + path.basename(p) + '.' + crypto.randomBytes(4).toString('hex') + '.tmp');
}

// safe write: write a temporary file next to the target, flush it to disk, then rename it over the target
async function atomicWrite(p, buf) {
  const tmp = tmpName(p);
  try {
    const fh = await fsp.open(tmp, 'w');
    try {
      await fh.writeFile(buf);
      await fh.sync();
    } finally {
      await fh.close();
    }
    await renameRetry(tmp, p);
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}
async function write(tok, segs, data) {
  const p = await resolve(tok, segs);
  const buf = Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
  await atomicWrite(p, buf);
}
// copy a file she picked (or dropped) straight from disk, so big videos never pass through renderer memory
async function copyIn(tok, segs, srcPath) {
  if (typeof srcPath !== 'string' || !path.isAbsolute(srcPath)) throw fail('TypeError', 'bad source');
  const st = await fsp.stat(srcPath);
  if (!st.isFile()) throw fail('TypeMismatchError', 'not a file');
  const p = await resolve(tok, segs),
    tmp = tmpName(p);
  try {
    await fsp.copyFile(srcPath, tmp);
    await renameRetry(tmp, p);
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}
async function remove(tok, segs) {
  if (!segs.length) throw fail('InvalidModificationError', 'cannot remove the board folder');
  const p = await resolve(tok, segs);
  try {
    await fsp.rm(p, { recursive: false });
  } catch (e) {
    if (e.code === 'ENOENT') throw fail('NotFoundError', 'not found');
    if (e.code === 'ERR_FS_EISDIR' || e.code === 'EISDIR') await fsp.rmdir(p);
    else throw e;
  }
}
async function sameEntry(t1, s1, t2, s2) {
  try {
    return (await fsp.realpath(await resolve(t1, s1))) === (await fsp.realpath(await resolve(t2, s2)));
  } catch (e) {
    return false;
  }
}

const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mkv: 'video/x-matroska',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain'
};
function mimeOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return (m && MIME[m[1].toLowerCase()]) || '';
}

// cork-file://<root>/<seg>/<seg>  -> the file's bytes, streamed, with Range support (for video)
async function serve(request, allowOrigin) {
  const cors = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Last-Modified, X-Size'
  };
  try {
    const u = new URL(request.url);
    const segs = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const p = await resolve(u.hostname, segs);
    const st = await fsp.stat(p);
    if (!st.isFile()) return new Response(null, { status: 404, headers: cors });
    const type = mimeOf(p) || 'application/octet-stream';
    const head = {
      ...cors,
      'Content-Type': type,
      'Last-Modified': new Date(st.mtimeMs).toUTCString(),
      'X-Size': String(st.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store'
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
    let start = 0,
      end = st.size - 1,
      status = 200;
    if (range && st.size) {
      if (range[1] === '') {
        start = Math.max(0, st.size - (+range[2] || 0));
      } else {
        start = +range[1];
        if (range[2] !== '') end = Math.min(end, +range[2]);
      }
      if (start > end || start >= st.size)
        return new Response(null, { status: 416, headers: { ...head, 'Content-Range': 'bytes */' + st.size } });
      status = 206;
      head['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
    }
    head['Content-Length'] = String(st.size ? end - start + 1 : 0);
    if (request.method === 'HEAD' || !st.size) return new Response(null, { status, headers: head });
    const { Readable } = require('stream');
    return new Response(Readable.toWeb(fs.createReadStream(p, { start, end })), { status, headers: head });
  } catch (e) {
    return new Response(null, { status: e.name === 'SecurityError' ? 403 : 404, headers: cors });
  }
}

module.exports = { register, rootPath, stat, mkdir, write, copyIn, remove, sameEntry, serve, atomicWrite, mimeOf };
