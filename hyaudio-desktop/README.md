# hyaudio · 调音师工具箱（Windows 桌面版源码）

界面与功能已完成，本工程可在云端自动打包出 Windows 安装包（setup.exe），
你电脑上**不需要安装任何开发环境**。

## 一、目录结构

```
├── app/                    界面文件
│   ├── index.html          主界面（6大功能页、主题、壁纸、启动视频全在里面）
│   ├── splash.mp4          HYAudio 启动动画（15s · 含音效）
│   └── wallpaper-nebula.jpg 内置壁纸
├── main.js                 主进程（窗口、防火墙、清理、插件扫描、压缩包自动部署等）
├── preload.js              界面与系统之间的安全桥梁
├── resources/installers/   只放小体积自带工具（见文件夹内 README.txt）
└── .github/workflows/      云端自动打包配置（不用动）
```

## 二、架构说明：setup.exe + 素材目录

机架（Studio One 系列）和插件压缩包体积远超 GitHub 的 100MB 单文件限制，
因此采用**素材目录**模式：

- **setup.exe**（云端打包，约 100MB）：界面 + 系统功能 + 小体积自带工具
  （电音助手 / 插件清理 / AI翻唱，已内置在 resources/installers/）
- **素材目录**（U盘/网盘分发）：机架宿主、插件压缩包、跳线工具
  用户把「工具箱素材」文件夹放到 D 盘根目录（D:\工具箱素材），
  软件自动识别；也可在“设置 → 素材目录”手动指定其他位置。

点“一键安装”时：exe 直接调起安装界面；zip/rar 自动解压并部署到
VST3 插件目录（需要管理员权限，安装包已配置自动申请）。

## 三、云端打包步骤（约 10 分钟出安装包）

1. 注册 / 登录 GitHub（https://github.com）
2. 右上角 **+** → **New repository**，名字随意（如 `hyaudio-toolbox`），
   选 Private 也可以，其他默认，点 **Create repository**
3. 在仓库页点 **uploading an existing file**，
   把本文件夹里的**所有内容**（包括 .github 文件夹）拖进去，点 **Commit changes**
   - 别忘了把 3 个小工具 exe 放进 resources/installers/ 一起传
   - 网页上传单文件不能超过 25MB（大文件不要传，走素材目录）
4. 点仓库上方的 **Actions** → 左侧 **打包 Windows 安装包**
   → 右侧 **Run workflow** → 跑完（约 8–15 分钟）
5. 点进运行记录，最下方 **Artifacts** 下载 `hyaudio调音师工具箱-Setup`

之后每次改代码重新推送，Actions 会自动重新打包。

## 四、本地调试（可选，非必须）

电脑装了 Node.js 20+ 的话，在本目录执行：

```
npm install
npm start        # 直接运行看效果
npm run dist     # 本地打包出安装包（不经云端）
```

## 五、已实现的真实系统功能

- 机架一键安装（从素材目录调起 HY-Audio 系列安装程序）
- 插件压缩包（zip/rar）自动解压 + 部署到系统 VST3/VST2 目录
- 防火墙 开/关、Defender 实时防护 开/关
- C 盘临时文件清理（显示实际释放空间）
- VST / VST3 插件真实扫描
- 一键调起 Windows 声音控制面板
- 开机自启动开关、记住窗口大小位置
- 素材目录自动检测 / 手动选择
