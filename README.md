# yo-toolkits

> 个人 CLI 工具集合 —— 插件式架构。`yo` 是统一入口,具体工具以插件形式按需安装。

## 特性

- **插件式**:核心只管路由与管理(`add / remove / list / browser / update / version`),工具独立成插件
- **按需安装**:`yo add gif` 从 GitHub 拉取源码,之后 `yo gif ...` 直接用
- **依赖隔离**:每个插件独立 npm 依赖,不污染全局
- **双模式输出**:默认机器可读 JSON,`-f text` 切彩色人类可读
- **TypeScript + ESM + pnpm workspace**,源码分发、改完 push 即生效

## 安装

```bash
npm i -g @that-yolanda/yo-toolkits
```

要求:Node ≥ 18。

## 快速开始

```bash
yo add gif              # 从 GitHub 安装 gif 插件
yo gif -i video.mp4     # 直接使用
yo list                 # 查看已安装插件
yo browser              # 浏览所有可用插件
```

## 命令

### 管理命令

| 命令 | 说明 |
|---|---|
| `yo add <name>` | 从 GitHub 安装一个插件 |
| `yo remove <name>` | 删除已安装插件(别名 `rm`) |
| `yo list` | 列出本地已安装插件(别名 `ls`) |
| `yo browser` | 浏览 GitHub 上所有可用插件 |
| `yo update [name]` | 升级插件(省略 name 升级全部) |
| `yo version` | 显示 yo 版本 |
| `yo --help` / `yo <cmd> --help` | 帮助 |

### 内置插件

- **gif** —— 视频转 GIF 动图(`yo gif -i video.mp4 -q m`)
- **word-count** —— 中英文字数统计(`yo word-count -t "你好 world"`)

> tts / stt / wiki / content-audio / live-translate / zed-to-ghostty 后续分批迁移。

## 全局选项

`-f, --format <json|text>` —— 输出格式,**默认 `json`**。

- `json`(默认):机器可读,供 agent / 脚本消费
- `text`:彩色人类可读

```bash
yo word-count -t "你好 world"            # 默认 json
yo -f text word-count -t "你好 world"    # 彩色输出
```

**成功(JSON)**:

```json
{
  "ok": true,
  "data": { "chinese": 2, "english": 1, "total": 3 },
  "error": null
}
```

**失败(JSON)**:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "DEPENDENCY_MISSING",
    "message": "缺少外部依赖: ffmpeg",
    "suggestion": "请先安装: brew install ffmpeg"
  }
}
```

## 数据目录

所有数据(配置 / 插件 / 已装记录 / 临时)统一归口到单一根目录,便于查找与备份:

| macOS / Linux | Windows |
|---|---|
| `~/.local/share/yo/` | `%LOCALAPPDATA%\yo\` |

根目录下:

- `config.json` — yo 配置
- `store/<name>/` — 已安装插件
- `registry.local.json` — 已装记录
- `tmp/` — 临时文件

macOS / Linux 支持 `XDG_DATA_HOME` 环境变量覆盖根目录。该根与 yolanda-skills 的 `YO_CONFIG_HOME` 默认值一致(配置共享同一目录)。

## 开发

```bash
pnpm install
pnpm dev list                     # dev 模式自动加载 workspace 插件
pnpm dev word-count -t "你好 world"
pnpm typecheck
```

开发规范、如何新增插件、字段唯一来源等约定见 [CLAUDE.md](./CLAUDE.md)。
