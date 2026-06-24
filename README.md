# yo-toolkits

> 个人 CLI 工具集合 —— 插件式架构，与 yolanda-skills 协同使用。

## 快速开始

```bash
npm i -g @that-yolanda/yo-toolkits
```

Node ≥ 18。

## 功能清单

| 插件 | 功能 | 环境变量 | 关键参数 |
|------|------|----------|----------|
| `gif` | 视频转 GIF 动图 | — | `-i, --input <file>`（输入视频）、`-q, --quality <m\|h>`（画质） |
| `word-count` | 中英文字数统计 | — | `-t, --text <string>`（直接输入）、`-i, --input <file>`（从文件读） |
| `wiki` | 本地知识库管理（搜索/添加/更新知识原子） | `WIKI_DIR` | `search [关键词]`、`add <json>`、`update <id>` |

> 所有命令支持 `-f text` 切换彩色输出（默认 JSON），`-h` 查看帮助。

## 基础命令

| 命令 | 说明 |
|------|------|
| `yo add <name>` | 从 GitHub 安装插件 |
| `yo remove <name>` | 删除已安装插件（别名 `rm`） |
| `yo list` | 列出已安装插件（别名 `ls`） |
| `yo browser` | 浏览所有可用插件 |
| `yo update [name]` | 升级插件（省略 name 升级全部） |
| `yo version` | 显示 yo 版本 |

## 配置说明

配置统一使用 `$YO_CONFIG_HOME/config.env`，与 yolanda-skills 共享同一文件。yo 命令可直接读取该文件，无需额外步骤；如需 skills（agent）侧也能使用，需将 `config.env` source 到 shell rc，详见 yolanda-skills README。

读取优先级：进程环境变量 > `config.env` 文件

| 平台 | YO_CONFIG_HOME 默认值 |
|------|----------------------|
| macOS / Linux | `~/.local/share/yo`（可用 `YO_CONFIG_HOME` 或 `XDG_DATA_HOME` 覆盖） |
| Windows | `%LOCALAPPDATA%\yo` |

## 本地开发

```bash
pnpm install          # 安装并链接 workspace
pnpm dev <cmd> [opts] # dev 模式运行（自动加载 workspace 插件）
pnpm typecheck        # 全仓库类型检查
pnpm build            # 编译 cli + 插件
```

## 项目结构

```
packages/
├── cli/                       @that-yolanda/yo-toolkits  bin: yo
│   └── src/
│       ├── core/              框架运行时（配置/加载/输出/路径/契约）
│       └── commands/          管理命令（add/remove/list/browser/update/version）
└── plugins/                   插件（单文件 index.ts + package.json）
    ├── gif/
    ├── word-count/
    └── wiki/
```

## License

[MIT](LICENSE)
