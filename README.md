# MusicWave - 在线音乐播放器

基于 Node.js + Express 的多源在线音乐播放器，支持网易云音乐、QQ音乐等多数据源搜索和播放。

## 功能特色

- **多源搜索** — 聚合网易云音乐、QQ音乐等多平台搜索结果，智能选择可用播放链接
- **私人 FM** — 智能推荐歌曲，支持红心/不喜欢反馈
- **歌单管理** — 浏览热门歌单、创建和管理自己的歌单、收藏歌曲
- **歌词显示** — 同步滚动歌词，支持全屏歌词模式
- **播放控制** — 播放/暂停、上一首/下一首、随机播放、循环模式、播放速度调节
- **队列管理** — 查看和管理当前播放队列
- **主题切换** — 支持暗色/亮色主题
- **PWA 支持** — 可安装为桌面应用，支持离线访问
- **移动端适配** — 响应式设计，支持移动端触摸操作
- **伪装模式** — 内置百度风格伪装页面，隐藏播放器

## 快速开始

### 本地运行

```bash
# 安装后端依赖
cd backend
npm install

# 启动服务
npm start
```

服务默认运行在 `http://localhost:3000`

### 使用启动脚本

- **Windows**: 双击 `start.bat`
- **Linux/Mac**: `./start.sh`

### 伪装模式

访问 `http://localhost:3000/baidu.html` 进入百度风格伪装页面，播放器以天气组件形式隐藏。

## Docker 部署

```bash
# 构建镜像
docker build -t musicwave .

# 运行容器
docker run -d -p 3000:3000 musicwave
```

支持 Railway 一键部署（`railway.json`）。

## 项目结构

```
music-player/
├── backend/
│   ├── public/              # 前端静态资源
│   │   ├── css/
│   │   │   ├── style.css    # 主样式
│   │   │   └── baidu.css    # 百度伪装页样式
│   │   ├── js/
│   │   │   ├── app.js       # 主应用逻辑
│   │   │   ├── player.js    # 播放器核心
│   │   │   ├── netease.js   # 网易云API
│   │   │   ├── baidu.js     # 百度伪装页逻辑
│   │   │   ├── lyrics.js    # 歌词解析与显示
│   │   │   └── icons.js     # SVG图标库
│   │   ├── index.html       # 主页面
│   │   ├── baidu.html       # 百度伪装页
│   │   ├── manifest.json    # PWA清单
│   │   └── sw.js            # Service Worker
│   ├── server.js            # Express服务端
│   ├── netease-api.js       # 网易云API封装
│   ├── music-crawler.js     # 多源音乐爬虫
│   ├── multi-source.js      # 多源聚合
│   ├── playlist-store.js    # 歌单存储
│   └── gequbao-crawler.js   # 备用音乐源爬虫
├── Dockerfile
├── start.bat                # Windows启动脚本
└── start.sh                 # Linux/Mac启动脚本
```

## 技术栈

- **前端**: 原生 HTML/CSS/JavaScript（无框架）
- **后端**: Node.js + Express
- **音乐源**: NeteaseCloudMusicApi、QQ音乐API、多源爬虫
- **部署**: Docker、Railway
- **PWA**: Service Worker + Manifest

## 配置

服务默认监听 3000 端口，可通过 `PORT` 环境变量修改。

```bash
# 修改端口
PORT=8080 npm start
```

## License

MIT
