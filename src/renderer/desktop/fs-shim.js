// Corkboard desktop: a stand-in for the browser's File System Access API, backed by the main process (Node fs).
// It offers exactly the surface app.js uses, so the app's own saving and loading code runs unchanged:
//   showDirectoryPicker(), dir.getDirectoryHandle/getFileHandle/removeEntry/isSameEntry/requestPermission/name,
//   file.getFile() -> real File, file.createWritable() -> write()/close().
(function () {
  'use strict';
  var N = window.corkNative;
  if (!N) return;

  function dom(name, msg) {
    try {
      return new DOMException(msg || name, name);
    } catch (e) {
      var x = new Error(msg || name);
      x.name = name;
      return x;
    }
  }
  // turn main-process errors into the DOMException names the real API uses (the app checks e.name in places)
  function wrap(p) {
    return p.catch(function (e) {
      throw dom((e && e.name) || 'InvalidStateError', e && e.message);
    });
  }
  function checkName(n) {
    if (typeof n !== 'string' || !n || /[/\\\0]/.test(n) || n === '.' || n === '..')
      throw new TypeError('Name is not allowed.');
    return n;
  }
  function fileUrl(root, segs) {
    return 'cork-file://' + root + '/' + segs.map(encodeURIComponent).join('/');
  }

  function Handle(kind, root, segs, rootName) {
    this.kind = kind;
    this._root = root;
    this._segs = segs;
    this._rootName = rootName;
  }
  Object.defineProperty(Handle.prototype, 'name', {
    get: function () {
      return this._segs.length ? this._segs[this._segs.length - 1] : this._rootName;
    }
  });
  Handle.prototype.queryPermission = function () {
    return Promise.resolve('granted');
  };
  Handle.prototype.requestPermission = function () {
    return Promise.resolve('granted');
  };
  Handle.prototype.isSameEntry = function (o) {
    if (!o || !(o instanceof Handle) || o.kind !== this.kind) return Promise.resolve(false);
    return wrap(N.sameEntry(this._root, this._segs, o._root, o._segs));
  };

  function DirHandle(root, segs, rootName) {
    Handle.call(this, 'directory', root, segs, rootName);
  }
  DirHandle.prototype = Object.create(Handle.prototype);
  DirHandle.prototype._child = function (n) {
    return this._segs.concat(checkName(n));
  };
  DirHandle.prototype.getDirectoryHandle = async function (name, opts) {
    var segs = this._child(name),
      st = await wrap(N.stat(this._root, segs));
    if (st && st.kind !== 'directory') throw dom('TypeMismatchError', 'A file with that name exists.');
    if (!st) {
      if (!(opts && opts.create)) throw dom('NotFoundError', 'A requested file or directory could not be found.');
      await wrap(N.mkdir(this._root, segs));
    }
    return new DirHandle(this._root, segs, this._rootName);
  };
  DirHandle.prototype.getFileHandle = async function (name, opts) {
    var segs = this._child(name),
      st = await wrap(N.stat(this._root, segs));
    if (st && st.kind !== 'file') throw dom('TypeMismatchError', 'A folder with that name exists.');
    if (!st) {
      if (!(opts && opts.create)) throw dom('NotFoundError', 'A requested file or directory could not be found.');
      await wrap(N.write(this._root, segs, new ArrayBuffer(0)));
    }
    return new FileHandle(this._root, segs, this._rootName);
  };
  DirHandle.prototype.removeEntry = function (name) {
    return wrap(N.remove(this._root, this._child(name)));
  };

  function FileHandle(root, segs, rootName) {
    Handle.call(this, 'file', root, segs, rootName);
  }
  FileHandle.prototype = Object.create(Handle.prototype);
  // a real File, read by Chromium's network stack from cork-file:// (large files are kept on disk, not in memory)
  FileHandle.prototype.getFile = async function () {
    var r;
    try {
      r = await fetch(fileUrl(this._root, this._segs), { cache: 'no-store' });
    } catch (e) {
      throw dom('NotReadableError', 'The file could not be read.');
    }
    if (r.status === 404) throw dom('NotFoundError', 'A requested file or directory could not be found.');
    if (!r.ok) throw dom(r.status === 403 ? 'SecurityError' : 'NotReadableError', 'The file could not be read.');
    var lm = Date.parse(r.headers.get('Last-Modified') || '') || Date.now(),
      type = r.headers.get('Content-Type') || '';
    if (type === 'application/octet-stream') type = '';
    var b = await r.blob();
    return new File([b], this.name, { type: type, lastModified: lm });
  };
  FileHandle.prototype.createWritable = async function () {
    return new Writable(this);
  };

  // collects what the app writes and commits it in one safe (temp file + rename) write on close()
  function Writable(fh) {
    this._fh = fh;
    this._parts = [];
    this._closed = false;
  }
  Writable.prototype.write = async function (d) {
    if (this._closed) throw dom('InvalidStateError', 'The stream is closed.');
    if (
      d &&
      typeof d === 'object' &&
      !(d instanceof Blob) &&
      !(d instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(d) &&
      'type' in d
    ) {
      if (d.type !== 'write' || d.position != null) throw dom('NotSupportedError', 'Only plain writes are supported.');
      d = d.data;
    }
    this._parts.push(d);
  };
  Writable.prototype.close = async function () {
    if (this._closed) return;
    this._closed = true;
    var fh = this._fh,
      parts = this._parts;
    // one whole file she picked or dropped: copy it on disk (fast, no memory spike for big videos)
    if (parts.length === 1 && parts[0] instanceof File && (await wrap(N.copyIn(fh._root, fh._segs, parts[0])))) return;
    var buf = await new Blob(
      parts.map(function (p) {
        return typeof p === 'string' || p instanceof Blob || p instanceof ArrayBuffer || ArrayBuffer.isView(p)
          ? p
          : String(p);
      })
    ).arrayBuffer();
    await wrap(N.write(fh._root, fh._segs, buf));
  };
  Writable.prototype.abort = async function () {
    this._closed = true;
    this._parts = [];
  };

  // the native folder dialog; Cancel rejects with AbortError like the real picker
  window.showDirectoryPicker = async function (opts) {
    var startIn = opts && opts.startIn instanceof DirHandle ? opts.startIn._root : null;
    var r = await wrap(N.pickFolder({ startIn: startIn }));
    if (!r) throw dom('AbortError', 'The user aborted a request.');
    return new DirHandle(r.root, [], r.name);
  };

  window.__corkShim = {
    handleFor: function (r) {
      return new DirHandle(r.root, [], r.name);
    },
    rootOf: function (h) {
      return h instanceof Handle ? h._root : null;
    },
    // a URL that streams a file in this folder straight from disk (with seeking), for video cards
    urlFor: function (dirHandle, name) {
      return fileUrl(dirHandle._root, dirHandle._segs.concat(checkName(name)));
    }
  };
})();
