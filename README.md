# yo-toolkits

> 个人 CLI 工具集合 — 插件式 monorepo。`yo` 是统一入口,具体工具以插件形式按需安装。

## 特性

- **插件式**:核心只管路由与管理(`add / remove / list / browser / update`),工具独立成插件
- **按需安装**:`yo add gif` 从 GitHub 拉取,之后 `yo gif ...` 直接用
- **依赖隔离**:每个插件独立 npm 依赖,不污染全局
- **双模式输出**:默认彩色人类可读,`--json` 输出 `{ok,data,error}` 供 agent / 脚本消费
- **TypeScript + ESM + pnpm workspace**

## 安装

> 第一版尚未发布到 npm。本地开发:

```bash
pnpm install
pnpm dev -- --help
```

后续发布到 npm 后:

```bash
npm i -g @that-yolanda/yo-toolkits
yo add gif            # 安装插件
yo gif -i video.mp4   # 直接使用
```

## 命令

### 管理命令

| 命令 | 说明 |
|---|---|
| `yo add <name>` | 从 GitHub 安装插件 |
| `yo remove <name>` | 删除已安装插件 |
| `yo list` | 列出本地已安装插件 |
| `yo browser` | 浏览 GitHub 上可用插件 |
| `yo update [name]` | 升级插件(省略 name 升级全部) |
| `yo version` | 显示版本 |
| `yo --help` | 帮助 |

### 内置插件(第一版)

- **gif** — 视频转 GIF(`yo gif -i video.mp4 -q m`)
- **word-count** — 中英文字数统计(`yo word-count -t "你好 world"`)

> tts / stt / wiki / content-audio / live-translate / zed-to-ghostty 后续分批迁移。

## 全局选项

`--json` — 切换为机器可读 JSON 输出,例如 `yo --json word-count -t "你好"`。

成功:

```json
{ "ok": true, "data": { "chinese": 1, "english": 1, "total": 2 }, "error": null }
```

失败:

```json
{
  "ok": false, "data": null,
  "error": { "code": "DEPENDENCY_MISSING", "message": "缺少外部依赖: ffmpeg", "suggestion": "请先安装: brew install ffmpeg" }
}
```

## 目录结构

```
packages/
├── core/     @that-yolanda/yo-core      框架运行时(契约 / Context / 加载器 / registry)
├── cli/      @that-yolanda/yo-toolkits  bin: yo(管理命令 + 路由)
└── plugins/  @that-yolanda/plugin-*     各工具插件(简单插件单文件 index.ts)
```

## 开发

```bash
pnpm install
pnpm dev list                     # dev 模式自动加载 workspace 插件
pnpm dev word-count -t "你好 world"
pnpm typecheck
```

开发规范与「如何新增一个命令」见 [CLAUDE.md](./CLAUDE.md)。

数据目录:`~/.yo/`(`store/` 已装插件、`config.json`、`tmp/`)。
