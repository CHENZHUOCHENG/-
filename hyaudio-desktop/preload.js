/* 预加载脚本：向界面暴露受限的系统能力 window.hya */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hya', {
  // 窗口控制：close / min / max
  win: (act) => ipcRenderer.send('win', act),
  // 防火墙开关：true=开启 false=关闭
  firewall: (on) => ipcRenderer.invoke('firewall', on),
  // Defender 实时防护：true=开启 false=关闭
  defender: (enable) => ipcRenderer.invoke('defender', enable),
  // 打开 Windows 声音控制面板
  openSound: () => ipcRenderer.invoke('openSound'),
  // 清理系统临时文件 → { ok, freed }
  cleanTemp: () => ipcRenderer.invoke('cleanTemp'),
  // 扫描 VST 插件 → { ok, items:[[名称, 类型]] }
  scanPlugins: () => ipcRenderer.invoke('scanPlugins'),
  // 开机自启
  setBoot: (on) => ipcRenderer.invoke('setBoot', on),
  // 调起内置安装包 / 部署压缩包插件（按界面显示名）→ { ok, msg }
  runInstaller: (name) => ipcRenderer.invoke('runInstaller', name),
  // 素材目录
  getMaterialDir: () => ipcRenderer.invoke('getMaterialDir'),
  pickMaterialDir: () => ipcRenderer.invoke('pickMaterialDir')
});
