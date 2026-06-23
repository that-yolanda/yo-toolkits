# CLAUDE.md — yo-toolkits 开发规范

## 项目结构

pnpm workspace monorepo:

- `packages/core` — `@that-yolanda/yo-core`:插件契约、Context、输出、spawn、配置、加载器、registry
- `packages/cli` — `@that-yolanda/yo-toolkits`:bin `yo`,管理命令(add/remove/list/browser/update/version)+ 路由 + 错误兜底
- `packages/plugins/<name>` — `@that-yolanda/plugin-<name>`:工具插件。**简单插件就是单文件 `index.ts` + `package.json`**,不要套 `src/`,也不要堆碎文件;只有需要附带外部脚本(如 Python)时才在目录内拆子文件

## 插件契约

每个插件 `default export` 一个 `Command`:

```ts
import type { Command, Context } from '@that-yolanda/yo-core';

export default {
  name: 'my-cmd',
  version: '1.0.0',
  description: '一句话描述',
  register(ctx: Context) {
    ctx.cli
      .command('my-cmd', '描述')
      .option('-i, --input <file>', '输入')
      .action(async (opts) => {
        ctx.spawn.assertDeps(['ffmpeg']);          // 外部依赖检查
        const r = await ctx.spawn.run('ffmpeg', [...]); // 跨平台调用
        ctx.output.success({ result: r.stdout }, '完成'); // 统一输出
      });
  },
} satisfies Command;
```

## Context API

| 字段 | 用途 |
|---|---|
| `ctx.cli` | 共享 cac 实例,`ctx.cli.command(...)` 注册子命令 |
| `ctx.output.success(data, message?)` | 成功输出(彩色 / JSON 自动切换) |
| `ctx.output.fail(code, message, suggestion?)` | 失败输出并退出(退出码 1),返回 `never` |
| `ctx.output.isJson` | 当前是否 `--json` 模式 |
| `ctx.log.info / ok / warn / error(msg)` | 彩色日志 |
| `ctx.spawn.run(cmd, args, opts?)` | 跨平台外部命令;命令缺失抛 `COMMAND_NOT_FOUND` |
| `ctx.spawn.assertDeps([...])` | 批量检查系统依赖,缺失抛 `DEPENDENCY_MISSING` |
| `ctx.config.get(key, fallback?)` | 读配置(优先 `process.env`,再 `~/.yo/config.json`) |
| `ctx.config.set(key, value)` | 写 `~/.yo/config.json` |
| `ctx.store.dataDir(...segs)` | 插件数据目录 `~/.yo/store/<plugin>/...` |
| `ctx.store.tmpDir(...segs)` | 临时目录 `~/.yo/tmp/...` |
| `ctx.store.ensureDir(dir)` | 确保目录存在(recursive) |
| `ctx.cwd` | 当前工作目录,用于 `path.resolve` 相对路径 |

## 输出规范

- **默认彩色人类可读**,对齐原 bash 工具的 `[INFO]/[OK]/[WARN]/[ERROR]` 风格
- `--json` 切结构化 `{ ok, data, error }`(供 agent / 脚本定位问题)
- **不要**在插件里直接 `console.log` 业务结果,统一走 `ctx.output` / `ctx.log`,否则 `--json` 模式会不一致

## 新增一个命令

1. 在 `packages/plugins/<name>/` 下建 `package.json`:
   - `name`: `@that-yolanda/plugin-<name>`
   - `type`: `module`,`main`: `./index.js`
   - `dependencies`: 含 `"@that-yolanda/yo-core": "workspace:*"`
   - `devDependencies`: `@types/node` / `tsup` / `typescript`
2. 同目录建**单文件 `index.ts`**,`export default { ... } satisfies Command`(见上)
3. 在根 `registry.json` 加一条(外部系统依赖在此声明,而非 package.json):
   ```json
   "my-cmd": {
     "name": "my-cmd", "version": "1.0.0", "description": "...",
     "subdir": "packages/plugins/my-cmd",
     "deps": ["ffmpeg"], "env": ["MY_CMD_KEY"]
   }
   ```
4. `pnpm install` 链接 workspace → `pnpm dev my-cmd --help` 验证
   (dev 模式自动发现 `packages/plugins/*` 下的 workspace 插件)
5. push 到 GitHub 后,`yo add my-cmd` 即可被安装到 `~/.yo/store/my-cmd/`

## 加载机制

- **dev 模式**(当前目录位于 monorepo 内):jiti 加载 `packages/plugins/*/index.ts` 源码
- **prod 模式**:jiti 加载 `~/.yo/store/<name>/index.ts`
- 同名插件 **dev 优先**,便于改源码即时调试

## 分发机制(degit + 源码)

`yo add <name>` 流程:

1. 拉远程 `registry.json`,取条目
2. `tiged` 从 `github.com/that-yolanda/yo-toolkits/<subdir>` 拉源码到 `~/.yo/store/<name>/`
3. 在该目录 `pnpm install --prod` 装依赖(含 `@that-yolanda/yo-core`)
4. `assertDeps(deps)` 检查系统依赖(ffmpeg 等)
5. 登记到 `~/.yo/registry.local.json`

插件以 **TypeScript 源码**分发,运行时由 jiti 转译,**无需预编译 / 发 release**。改完 push 即生效。

## 命名约定

- scope 统一 `@that-yolanda/*`
- 插件命令名用小写连字符(如 `word-count`),与 `name` 字段一致

## 版本号策略

- **patch**(`0.0.X`,默认):bug 修复、小改动、文档 —— 每次修改自动 +1
- **minor**(`0.X.0`):新功能、行为变化、非破坏性增强 —— **需用户确认**
- **major**(`X.0.0`):破坏性 API 变更 —— **需用户确认**

判定优先级:能用 patch 解决的不上 minor。拿不准就按 patch 走,review 时由用户升级。

## 常用脚本

```bash
pnpm install                 # 安装并链接 workspace
pnpm dev <cmd> [opts]        # tsx 直接跑 cli(dev 模式加载 workspace 插件)
pnpm typecheck               # 全仓库 tsc --noEmit
pnpm build                   # tsup 编译 core/cli/各插件
```
