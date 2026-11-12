// 15. Help → Check for Updates…: newer version → offer to open the download page; same version → up to date;
// offline → a friendly message. GitHub's answer is faked in the test (the main process's fetch is replaced), so the test stays offline.
const { test } = require('@playwright/test');
const h = require('./helpers');

const clickMenu = (app, ...labels) => app.evaluate(({ Menu }, ls) => {
  let items = Menu.getApplicationMenu().items, it;
  for (const l of ls) { it = items.find(i => i.label === l); if (!it) return 'missing ' + l; items = it.submenu ? it.submenu.items : []; }
  it.click(); return 'clicked';
}, labels);
// GitHub's "latest release" answer: a tag name, or a failure
const fakeGitHub = (app, tag) => app.evaluate((electron, t) => {
  global.__asked = [];
  globalThis.fetch = async (url, opts) => {
    global.__asked.push({ url: String(url), ua: opts && opts.headers && opts.headers['User-Agent'] });
    if (!t) throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ tag_name: t, html_url: 'https://github.com/gbylegaspi/corkboard/releases/tag/' + t }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  global.__boxes = []; global.__answer = 0;
  electron.dialog.showMessageBox = async (w, o) => { global.__boxes.push(o || w); return { response: global.__answer }; };
}, tag);
const lastBox = app => app.evaluate(() => global.__boxes[global.__boxes.length - 1] || null);

test('Check for Updates', async () => {
  const ctx = h.newBoard(); await h.launch(ctx);
  try {
    const version = await ctx.app.evaluate(({ app }) => app.getVersion());
    const [maj, min, pat] = version.split('.').map(Number);
    // nothing goes online until she asks
    await fakeGitHub(ctx.app, 'v' + version);
    await ctx.page.waitForTimeout(500);
    h.expect(await ctx.app.evaluate(() => global.__asked.length)).toBe(0);
    // in both places: the app menu and Help
    h.expect(await clickMenu(ctx.app, 'Help', 'Check for Updates…')).toBe('clicked');
    await h.expect.poll(() => lastBox(ctx.app)).not.toBeNull();
    h.expect((await lastBox(ctx.app)).message).toBe('You’re up to date');
    const asked = await ctx.app.evaluate(() => global.__asked);
    h.expect(asked).toEqual([{ url: 'https://api.github.com/repos/gbylegaspi/corkboard/releases/latest', ua: 'Corkboard-desktop' }]);
    // a newer version: Download opens the release page in the browser
    const next = `${maj}.${min}.${pat + 1}`;
    await fakeGitHub(ctx.app, 'v' + next);
    await clickMenu(ctx.app, 'Corkboard', 'Check for Updates…');
    await h.expect.poll(() => lastBox(ctx.app)).not.toBeNull();
    const b = await lastBox(ctx.app);
    h.expect(b.message).toBe(`Corkboard ${next} is available`);
    h.expect(b.buttons).toEqual(['Download…', 'Later']);
    await h.expect.poll(() => ctx.app.evaluate(() => global.__external)).toEqual([`https://github.com/gbylegaspi/corkboard/releases/tag/v${next}`]);
    // "Later" opens nothing
    await fakeGitHub(ctx.app, 'v' + next); await ctx.app.evaluate(() => { global.__answer = 1; global.__external = []; });
    await clickMenu(ctx.app, 'Help', 'Check for Updates…');
    await h.expect.poll(() => lastBox(ctx.app)).not.toBeNull();
    await ctx.page.waitForTimeout(300);
    h.expect(await ctx.app.evaluate(() => global.__external)).toEqual([]);
    // an older release on GitHub (she has a newer build): up to date
    await fakeGitHub(ctx.app, '1.0.0');
    await clickMenu(ctx.app, 'Help', 'Check for Updates…');
    await h.expect.poll(() => lastBox(ctx.app)).not.toBeNull();
    h.expect((await lastBox(ctx.app)).message).toBe('You’re up to date');
    // offline
    await fakeGitHub(ctx.app, null);
    await clickMenu(ctx.app, 'Help', 'Check for Updates…');
    await h.expect.poll(() => lastBox(ctx.app)).not.toBeNull();
    h.expect((await lastBox(ctx.app)).message).toBe('Couldn’t check for updates');
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
