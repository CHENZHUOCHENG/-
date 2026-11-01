/* hyaudio · 调音师工具箱 — Electron 主进程 */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { exec, execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let win = null;
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

/* ---------- 窗口 ---------- */
function createWindow() {
  let bounds = { width: 1280, height: 800 };
  try { Object.assign(bounds, JSON.parse(fs.readFileSync(stateFile(), 'utf8'))); } catch (e) {}

  win = new BrowserWindow({
    ...bounds,
    minWidth: 1100,
    minHeight: 700,
    frame: false,               // 使用界面自带的红绿灯按钮
    show: false,
    backgroundColor: '#0b0b18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', () => {
    try { fs.writeFileSync(stateFile(), JSON.stringify(win.getBounds())); } catch (e) {}
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

/* 外部链接一律交给系统默认浏览器 */
app.on('web-contents-created', (e, contents) => {
  contents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
});

ipcMain.on('win', (e, act) => {
  if (!win) return;
  if (act === 'close') win.close();
  else if (act === 'min') win.minimize();
  else if (act === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
});

/* ---------- 工具：执行系统命令 ---------- */
function run(cmd, args) {
  return new Promise(res => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      res({ ok: !err, msg: err ? String(stderr || err.message).slice(0, 200) : '', out: String(stdout || '') });
    });
  });
}

/* ---------- 防火墙 ---------- */
ipcMain.handle('firewall', (e, on) =>
  run('netsh', ['advfirewall', 'set', 'allprofiles', 'state', on ? 'on' : 'off']));

/* ---------- Defender 实时防护（需管理员；系统“篡改防护”开启时会被拒绝） ---------- */
ipcMain.handle('defender', (e, enable) =>
  run('powershell', ['-NoProfile', '-Command',
    `Set-MpPreference -DisableRealtimeMonitoring $${enable ? 'false' : 'true'}`]));

/* ---------- 声音控制面板 ---------- */
ipcMain.handle('openSound', () => { exec('control mmsys.cpl sounds'); return { ok: true }; });

/* ---------- C 盘清理（临时文件目录） ---------- */
function dirSize(dir) {
  let s = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      s += st.isDirectory() ? dirSize(p) : st.size;
    }
  } catch (e) {}
  return s;
}
ipcMain.handle('cleanTemp', async () => {
  const dirs = [os.tmpdir(), path.join(os.homedir(), 'AppData', 'Local', 'Temp')];
  let freed = 0;
  for (const d of [...new Set(dirs)]) {
    let list; try { list = fs.readdirSync(d); } catch (e) { continue; }
    for (const f of list) {
      const p = path.join(d, f);
      try {
        const st = fs.statSync(p);
        freed += st.isDirectory() ? dirSize(p) : st.size;
        fs.rmSync(p, { recursive: true, force: true });
      } catch (e) { /* 占用中的文件跳过 */ }
    }
  }
  const mb = freed / 1048576;
  return { ok: true, freed: mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.max(1, Math.round(mb)) + ' MB' };
});

/* ---------- 插件扫描（常见 VST 目录） ---------- */
ipcMain.handle('scanPlugins', async () => {
  const roots = [
    'C:\\Program Files\\Common Files\\VST3',
    'C:\\Program Files\\Common Files\\VST2',
    'C:\\Program Files\\VstPlugins',
    'C:\\Program Files\\Steinberg\\VstPlugins',
    'C:\\Program Files (x86)\\Common Files\\VST3',
    'C:\\Program Files (x86)\\VstPlugins'
  ];
  const items = [];
  function walk(dir) {
    let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const it of list) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) {
        if (it.name.toLowerCase().endsWith('.vst3')) items.push([it.name, 'VST3']);
        else walk(p);
      } else if (/\.(vst3|dll)$/i.test(it.name)) {
        items.push([it.name, /\.dll$/i.test(it.name) ? 'VST2' : 'VST3']);
      }
    }
  }
  roots.forEach(walk);
  return { ok: true, items: items.slice(0, 300) };
});

/* ---------- 开机自启 ---------- */
ipcMain.handle('setBoot', (e, on) => {
  app.setLoginItemSettings({ openAtLogin: !!on });
  return { ok: true };
});

/* ---------- 内置安装包 + 素材目录 ---------- */
const cfgFile = () => path.join(app.getPath('userData'), 'config.json');
function getMaterialDir() {
  try {
    const c = JSON.parse(fs.readFileSync(cfgFile(), 'utf8'));
    if (c.materialDir && fs.existsSync(c.materialDir)) return c.materialDir;
  } catch (e) {}
  // 自动检测常见位置
  for (const d of ['D:\\工具箱素材', 'E:\\工具箱素材', 'F:\\工具箱素材']) {
    if (fs.existsSync(d)) return d;
  }
  return null;
}
ipcMain.handle('getMaterialDir', () => ({ ok: true, dir: getMaterialDir() }));
ipcMain.handle('pickMaterialDir', async () => {
  const { dialog } = require('electron');
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: '选择素材目录' });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const dir = r.filePaths[0];
  let c = {}; try { c = JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); } catch (e) {}
  c.materialDir = dir;
  fs.writeFileSync(cfgFile(), JSON.stringify(c));
  return { ok: true, dir };
});

function installersDir() {
  const a = path.join(process.resourcesPath || '', 'installers');
  return fs.existsSync(a) ? a : path.join(__dirname, 'resources', 'installers');
}
function searchRoots() {
  const roots = [installersDir()];
  const m = getMaterialDir();
  if (m) {
    roots.push(m);
    try {
      for (const sub of fs.readdirSync(m, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const subPath = path.join(m, sub.name);
        roots.push(subPath);
        // 再下一层（如 声卡驱动安装\羚羊声卡驱动面板）
        try {
          for (const sub2 of fs.readdirSync(subPath, { withFileTypes: true })) {
            if (sub2.isDirectory()) roots.push(path.join(subPath, sub2.name));
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  return [...new Set(roots)].filter(d => { try { return fs.existsSync(d); } catch (e) { return false; } });
}
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9一-鿿]/g, '');
function findFile(name) {
  const target = norm(name);
  let fuzzy = null;
  for (const root of searchRoots()) {
    let list; try { list = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { continue; }
    for (const it of list) {
      if (!it.isFile()) continue;
      const ext = path.extname(it.name).toLowerCase();
      if (!['.exe', '.msi', '.zip', '.rar'].includes(ext)) continue;
      const base = norm(path.basename(it.name, ext));
      const full = path.join(root, it.name);
      if (base === target) return full;                    // 精确匹配优先
      if ((base.includes(target) || target.includes(base)) && (!fuzzy || it.name.length < path.basename(fuzzy).length)) fuzzy = full;
    }
  }
  return fuzzy;
}

function copyRecursive(src, dest) { fs.cpSync(src, dest, { recursive: true }); }

async function extractArchive(archive, dest) {
  const ext = path.extname(archive).toLowerCase();
  if (ext === '.zip') {
    const AdmZip = require('adm-zip');
    new AdmZip(archive).extractAllTo(dest, true);
    return;
  }
  if (ext === '.rar') {
    const { createExtractorFromFile } = require('node-unrar-js');
    const extractor = await createExtractorFromFile({ filepath: archive, targetPath: dest });
    [...extractor.extract().files];
    return;
  }
  throw new Error('不支持的压缩格式：' + ext);
}

/* 压缩包 → 自动解压并部署插件 / 调起内部安装程序 */
async function deployArchive(p) {
  const tmp = path.join(os.tmpdir(), 'hya-install-' + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  try {
    await extractArchive(p, tmp);
  } catch (err) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    return { ok: false, msg: '解压失败：' + String(err.message || err).slice(0, 120) };
  }
  const found = { exe: [], vst3: [], dll: [] };
  (function walk(d) {
    let list; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const it of list) {
      const fp = path.join(d, it.name);
      if (it.isDirectory()) {
        if (/\.vst3$/i.test(it.name)) found.vst3.push(fp); else walk(fp);
      } else if (/\.(exe|msi)$/i.test(it.name)) found.exe.push(fp);
      else if (/\.vst3$/i.test(it.name)) found.vst3.push(fp);
      else if (/\.dll$/i.test(it.name)) found.dll.push(fp);
    }
  })(tmp);

  let deployed = 0, failed = 0;
  const vst3Dir = 'C:\\Program Files\\Common Files\\VST3';
  const vst2Dir = 'C:\\Program Files\\VstPlugins';
  for (const v of found.vst3) {
    try { fs.mkdirSync(vst3Dir, { recursive: true }); copyRecursive(v, path.join(vst3Dir, path.basename(v))); deployed++; }
    catch (e) { failed++; }
  }
  for (const d of found.dll) {
    try { fs.mkdirSync(vst2Dir, { recursive: true }); fs.copyFileSync(d, path.join(vst2Dir, path.basename(d))); deployed++; }
    catch (e) { failed++; }
  }
  if (deployed) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    return { ok: true, msg: `已自动解压并部署 ${deployed} 个插件` + (failed ? `（${failed} 个失败）` : '') };
  }
  if (found.exe.length) {
    spawn(found.exe[0], [], { cwd: path.dirname(found.exe[0]), detached: true, stdio: 'ignore' }).unref();
    return { ok: true, msg: '已调起压缩包内的安装程序' };
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  return { ok: false, msg: '压缩包内未找到插件文件或安装程序' };
}

/* 统一入口：安装 / 启动（exe 直接调起，压缩包自动部署） */
ipcMain.handle('runInstaller', async (e, name) => {
  try {
    const p = findFile(name);
    if (!p) return { ok: false, msg: '未找到「' + name + '」，请在设置中指定素材目录' };
    const ext = path.extname(p).toLowerCase();
    if (ext === '.exe' || ext === '.msi') {
      spawn(p, [], { cwd: path.dirname(p), detached: true, stdio: 'ignore' }).unref();
      return { ok: true, msg: '已调起安装程序' };
    }
    return await deployArchive(p);
  } catch (err) {
    return { ok: false, msg: String(err.message || err).slice(0, 120) };
  }
});
