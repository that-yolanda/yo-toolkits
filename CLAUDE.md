# CLAUDE.md — yo-toolkits 开发规范

> 本文档面向 AI / 贡献者,讲清项目情况与开发约定。面向最终用户的使用说明见 [README.md](./README.md)。

## 项目概况

个人 CLI 工具集合,插件式 monorepo。`yo` 是统一入口(bin),核心只管**路由 + 管理**,具体工具以**插件**形式按需从 GitHub 拉取安装。

技术栈:Node ≥ 18 · TypeScript · ESM · pnpm workspace · cac(CLI 解析) · tsup(构建) · jiti(运行时加载插件 TS) · execa/which(spawn 与依赖检查) · chalk(彩色)。

### 目录结构

```
packages/
├── cli/                          @that-yolanda/yo-toolkits  bin: yo
│   ├── src/
│   │   ├── bin.ts                #!/usr/bin/env node 入口
│   │   ├── bootstrap.ts          装配 cac / Context / 加载插件 / help 分组
│   │   ├── install.ts            add/update 的 pnpm install 封装
│   │   ├── commands/             version / list / browser / add / remove / update
│   │   └── core/                 框架运行时(契约 / Context / 加载器 / registry / fetch)
│   └── package.json              bin:{yo}, 依赖 cac/chalk/execa/jiti/which
└── plugins/                      @that-yolanda/plugin-*
    ├── gif/                      单文件 index.ts + package.json
    └── word-count/
```

> `core` 已合并进 `packages/cli/src/core/`,不再单独成包。框架对外类型从 `@that-yolanda/yo-toolkits` 导入(见 `packages/cli/src/index.ts`)。

## 插件契约

每个插件 `default export` 一个 `Command`。**用 `const cmd = {...}; export default cmd` 写法**,register 内复用 `cmd.name` / `cmd.description` / `cmd.deps`,保证字段只写一次:

```ts
import type { Command, Context, HelpSpec } from '@that-yolanda/yo-toolkits';

const myCmdSpec: HelpSpec = {
  description: '一句话描述',
  usage: 'my-cmd -i <file>',
  options: [{ flags: '-i, --input <file>', desc: '输入' }],
  env: [{ name: 'MY_CMD_KEY', desc: '某服务的访问密钥' }],
};

const cmd = {
  name: 'my-cmd',
  version: '1.0.0',
  description: '一句话描述',
  deps: ['ffmpeg'],            // 外部系统依赖(可选);同时进 registry.json 的 deps
  env: ['MY_CMD_KEY'],         // 所需环境变量(可选);进 registry.json 的 env
  register(ctx: Context) {
    const c = ctx.cli
      .command(cmd.name, cmd.description)   // 复用,不再写第二遍
      .option('-i, --input <file>', '输入')
      .action(async (opts) => {
        ctx.spawn.assertDeps(cmd.deps);     // 复用声明的依赖
        const r = await ctx.spawn.run('ffmpeg', [...]);
        ctx.output.success({ result: r.stdout }, '完成');
      });
    // 覆写 outputHelp,用 ctx.renderHelp 统一渲染(见"帮助规范")
    (c as { outputHelp: () => void }).outputHelp = () =>
      process.stdout.write(ctx.renderHelp(myCmdSpec) + '\n');
  },
} satisfies Command;

export default cmd;
```

### Context API

| 字段 | 用途 |
|---|---|
| `ctx.cli` | 共享 cac 实例,`ctx.cli.command(...)` 注册子命令 |
| `ctx.output.format` | 当前输出格式 `'json' \| 'text'` |
| `ctx.output.success(data, message?)` | 成功输出(按 format 自动切换 json / 彩色) |
| `ctx.output.fail(code, message, suggestion?)` | 失败输出并退出(退出码 1),返回 `never` |
| `ctx.log.info / ok / warn / error(msg)` | 彩色日志(走 stderr,不污染 json stdout) |
| `ctx.spawn.run(cmd, args, opts?)` | 跨平台外部命令;命令缺失抛 `COMMAND_NOT_FOUND` |
| `ctx.spawn.assertDeps([...])` | 批量检查系统依赖,缺失抛 `DEPENDENCY_MISSING`(带安装建议) |
| `ctx.config.get(key, fallback?)` | 读配置(优先 `process.env`,再 XDG config) |
| `ctx.config.set(key, value)` | 写 XDG config |
| `ctx.store.dataDir(...segs)` | 插件数据目录 `<root>/store/<plugin>/...` |
| `ctx.store.tmpDir(...segs)` | 临时目录 `<root>/tmp/...` |
| `ctx.store.ensureDir(dir)` | 确保目录存在(recursive) |
| `ctx.cwd` | 当前工作目录,用于 `path.resolve` 相对路径 |
| `ctx.renderHelp(spec)` | 渲染标准帮助文本(覆写 command.outputHelp 时用) |

### 输出规范

- 默认 `json`(机器可读 `{ ok, data, error }`),`-f text` 切彩色人类可读
- **不要**在插件里 `console.log` 业务结果,统一走 `ctx.output` / `ctx.log`,否则两种 format 会不一致
- 进度信息用 `ctx.log`(走 stderr),避免污染 json 模式的 stdout

### 帮助规范

所有插件覆写 `command.outputHelp = () => ctx.renderHelp(spec)`,统一帮助格式(框架自动追加通用 `-f`/`-h`):

```ts
const spec: HelpSpec = {
  description: '...',              // 必须,help 首行
  usage: 'cmd -i <file>',          // 必须,不含 bin 前缀(自动加 $ yo)
  options?: HelpOption[],          // 可选,业务选项
  commands?: HelpCommand[],        // 可选,有子命令时(如 wiki)
  env?: HelpEnv[],                 // 可选,依赖的环境变量
};
```

> cac 的命令匹配只比对 `args[0]`(单字),多词命令名(如 `wiki search`)无法匹配,且 `.usage()` 会叠加 bin 名 → `yo yo wiki`。所以**不要**用 cac 的 `.usage()` 或多词子命令;有子命令时注册单命令 + `allowUnknownOptions` + action 内手动路由(见 `packages/plugins/wiki`)。业务选项短名**避开 `-f`**(全局 format 占用,会被 bootstrap 拦截)。

> **运行时零框架依赖**:插件只允许 `import type { ... }` 自 `@that-yolanda/yo-toolkits`(类型契约,jiti 擦除),**禁止 `import { 值 }`**。框架运行时能力(`renderHelp` / `output` / `spawn` / ...)一律走 `ctx`。store 里的插件不装框架包(`workspace:*` 在 store 解析不了),值 import 会触发加载 `Cannot find module`。

## 加载与分发机制

> **统一根**:所有 yo 数据(`config.json` / `store` / `registry.local.json` / `tmp`)归口于 `~/.local/share/yo`(Windows `%LOCALAPPDATA%\yo`),与 yolanda-skills 的 `YO_CONFIG_HOME` 默认值一致。下文 `<root>` 即指此目录。macOS/Linux 读 `XDG_DATA_HOME` 覆盖。

### 加载(loader)

- **dev 模式**(当前目录位于 monorepo 内):扫 `packages/plugins/*/index.ts`
- **prod 模式**:读本地 registry,加载 `<root>/store/<name>/index.ts`
- 同名插件 **dev 优先**,便于改源码即时调试
- TS 源码由 jiti 运行时转译,**无需预编译插件**

### 分发(`yo add <name>`)

1. 拉远程 `registry.json`,取条目
2. `git clone --depth 1` 浅克隆仓库,提取 `<subdir>` 到 `<root>/store/<name>/`(借鉴 vercel-labs/skills,零额外依赖,不引入 deprecated 包)
3. 在该目录 `pnpm install --prod` 装依赖(含 `@that-yolanda/yo-toolkits`)
4. `assertDeps(deps)` 检查系统依赖(ffmpeg 等)
5. 登记到本地 registry

插件以 **TypeScript 源码**分发,改完 push 即生效,无需发 release。

## 新增一个插件

1. `packages/plugins/<name>/` 下建**单文件 `index.ts`**,按上面契约写 `const cmd = {...} satisfies Command; export default cmd`
2. 同目录建 `package.json`:
   - `name`: `@that-yolanda/plugin-<name>`、`type`: `module`
   - `dependencies`: 含 `"@that-yolanda/yo-toolkits": "workspace:*"`
   - `version` 不必手写准确,会被 `gen:registry` 从 index.ts 同步
3. `pnpm install` 链接 workspace → `pnpm dev <name> -h` 验证
4. **生成 registry**:`pnpm gen:registry`(从所有插件 index.ts 派生 `registry.json` + 同步各 package.json version)
5. push 到 GitHub 后,`yo add <name>` 即可被安装到 `<root>/store/<name>/`

> `registry.json` 是**派生物**,不要手改。CI 用 `pnpm check:registry` 防漂移。

## 开发约束(重要)

- **避免造轮子**:优先用框架 / Node 原生能力,不引多余依赖。
  - cac 已有 `.usage()` / `.option()` / `.command()`,直接用,不要自己拼帮助文本
  - 优先 `node:fs` / `fetch` / `path`,而非装额外包
  - 引入新依赖前先评估能否用现有能力替代(例:fetch 子目录用 `git clone` 而非已弃用的 tiged)
- **字段唯一来源**:`name` / `version` / `description` / `deps` / `env` 只在 index.ts 的 Command 写一次。`registry.json` 由 `gen:registry` 派生,`package.json.version` 由它同步。
- **输出走 ctx**:业务结果走 `ctx.output`,日志走 `ctx.log`,禁 `console.log` 业务结果。
- **系统依赖声明在 Command.deps**:外部系统依赖(ffmpeg / rg / ollama)写进 `deps`,运行时 `assertDeps(cmd.deps)` 检查;**不要**写进 package.json(那是 npm 依赖)。
- **路径走 ctx**:用 `ctx.store.dataDir/tmpDir`、`ctx.cwd`、`ctx.config`,**禁硬编码** `~/...` 或 `~/.yo/...`(已迁 XDG,硬编码会错)。
- **错误带上下文**:抛 `YoError(code, message, suggestion?)` 或用 `ctx.output.fail(...)`,code 大写下划线(如 `FILE_NOT_FOUND`),给可操作的 suggestion。
- **简单插件单文件**:就是 `index.ts` + `package.json`,不要套 `src/`,不要堆碎文件;只有需要附带外部脚本(如 Python)时才在目录内拆子文件。
- **命名**:scope 统一 `@that-yolanda/*`;插件命令名用小写连字符(如 `word-count`),与 `name` 字段一致。

## 版本号策略

针对 `packages/cli/package.json`(`@that-yolanda/yo-toolkits`,即 `yo` 本体):

- **patch**(`0.0.X`,默认):bug 修复、小改动、文档、内部重构 —— 每次修改后的发布自动 +1
- **minor**(`0.X.0`):新功能、用户可见行为变化、非破坏性增强 —— **需用户确认**
- **major**(`X.0.0`):破坏性 API 变更 —— **需用户确认**

判定优先级:能用 patch 解决的不上 minor。拿不准就按 patch 走,review 时由用户升级。

插件 `Command.version` 独立维护,改插件时更新其 index.ts 的 version,`gen:registry` 会同步进 registry.json 与 package.json。

## 常用脚本

```bash
pnpm install                 # 安装并链接 workspace
pnpm dev <cmd> [opts]        # tsx 直接跑 cli(dev 模式加载 workspace 插件)
pnpm typecheck               # 全仓库 tsc --noEmit
pnpm build                   # tsup 编译 cli + 各插件
pnpm build:cli               # 只编译 cli(改了 core/types 后,插件 typecheck 前需先跑)
pnpm gen:registry            # 从 index.ts 生成 registry.json + 同步 plugin version
pnpm check:registry          # 校验 registry.json 与 index.ts 一致(CI 用)
```
