import fs from 'node:fs';
import path from 'node:path';
import type { Command, Context } from '@that-yolanda/yo-toolkits';

// ── 枚举与类型 ──
type AtomType = 'principle' | 'method' | 'case' | 'anti-pattern' | 'tool' | 'insight';
type Confidence = 'high' | 'medium' | 'low';
type Status = 'pending' | 'achieved' | 'discorded';

interface Atom {
  id: string;
  knowledge: string;
  original: string;
  url: string;
  date: string;
  tags: string[];
  type: AtomType;
  confidence: Confidence;
  status: Status | null;
  author: string;
}

const TYPES: AtomType[] = ['principle', 'method', 'case', 'anti-pattern', 'tool', 'insight'];
const CONFIDENCES: Confidence[] = ['high', 'medium', 'low'];
const STATUSES: Status[] = ['pending', 'achieved', 'discorded'];

// ── 配置 / 路径 ──
function resolveWikiDir(ctx: Context): string {
  const dir = ctx.config.get('WIKI_DIR');
  if (!dir) {
    ctx.output.fail(
      'CONFIG_MISSING',
      '未配置 WIKI_DIR(知识库根目录)',
      '设置环境变量 WIKI_DIR,或写进 yo 配置;skill 体系下由 $YO_CONFIG_HOME/config.env 提供',
    );
  }
  return dir;
}

function atomsPath(ctx: Context): string {
  return path.join(resolveWikiDir(ctx), '原子库', 'atoms.jsonl');
}

// ── JSONL 读写 ──
function readAtoms(file: string): Atom[] {
  if (!fs.existsSync(file)) return [];
  const atoms: Atom[] = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      atoms.push(JSON.parse(t) as Atom);
    } catch {
      /* 跳过坏行 */
    }
  }
  return atoms;
}

function writeAtoms(file: string, atoms: Atom[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, atoms.map((a) => JSON.stringify(a)).join('\n') + '\n', 'utf8');
}

// ── 选项解析(手动,贴近原 bash)──
interface ParsedArgs {
  opts: Record<string, string>;
  positional: string[];
}

const SHORT_LONG: Record<string, string> = {
  l: 'limit', b: 'begin', e: 'end', t: 'type', s: 'status',
  a: 'author', c: 'confidence', T: 'tags', h: 'help',
};

function parseArgs(argv: string[]): ParsedArgs {
  const opts: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { opts.help = '1'; continue; }
    const eq = a.indexOf('=');
    if (a.startsWith('--') && a.length > 2) {
      const raw = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      const key = SHORT_LONG[raw] ?? raw;
      opts[key] = eq >= 0 ? a.slice(eq + 1) : argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : 'true';
    } else if (a.startsWith('-') && a.length > 1) {
      const raw = eq >= 0 ? a.slice(1, eq) : a.slice(1);
      const key = SHORT_LONG[raw] ?? raw;
      opts[key] = eq >= 0 ? a.slice(eq + 1) : argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : 'true';
    } else {
      positional.push(a);
    }
  }
  return { opts, positional };
}

function splitList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

// ── 日期 / ID ──
function pad2(n: number): string { return String(n).padStart(2, '0'); }
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
/** 扫描当月所有 id 取最大序号 +1(比只看最后一行更鲁棒) */
function nextId(atoms: Atom[]): string {
  const ym = currentYM();
  let max = 0;
  for (const a of atoms) {
    const m = a.id.match(/^(\d{4}-\d{2})-(\d+)$/);
    if (m && m[1] === ym) max = Math.max(max, parseInt(m[2], 10));
  }
  return `${ym}-${String(max + 1).padStart(3, '0')}`;
}

// ── 校验(fail 返回 never,作三元 false 分支)──
function checkType(v: unknown, ctx: Context): AtomType {
  return typeof v === 'string' && (TYPES as string[]).includes(v)
    ? (v as AtomType)
    : ctx.output.fail('INVALID_ARGS', `type 必须为 ${TYPES.join('/')},实际: ${v}`);
}
function checkConfidence(v: unknown, ctx: Context): Confidence {
  return typeof v === 'string' && (CONFIDENCES as string[]).includes(v)
    ? (v as Confidence)
    : ctx.output.fail('INVALID_ARGS', `confidence 必须为 ${CONFIDENCES.join('/')},实际: ${v}`);
}
function checkStatus(v: unknown, ctx: Context): Status | null {
  if (v == null || v === '' || v === 'null') return null;
  return typeof v === 'string' && (STATUSES as string[]).includes(v)
    ? (v as Status)
    : ctx.output.fail('INVALID_ARGS', `status 必须为 null/${STATUSES.join('/')},实际: ${v}`);
}

// ── search ──
function runSearch(ctx: Context, argv: string[]): void {
  const { opts, positional } = parseArgs(argv);
  if (opts.help) { ctx.log.info(SEARCH_HELP); return; }

  const file = atomsPath(ctx);
  let atoms = readAtoms(file);

  // 关键词:每个位置参数内逗号 OR,多个位置参数之间 AND
  if (positional.length > 0) {
    atoms = atoms.filter((a) =>
      positional.every((group) => {
        const kws = splitList(group).map((k) => k.toLowerCase());
        const hay = [a.knowledge, a.original, a.author, a.tags.join(' ')].join(' ').toLowerCase();
        return kws.some((k) => hay.includes(k));
      }),
    );
  }
  if (opts.type) { const w = splitList(opts.type); atoms = atoms.filter((a) => w.includes(a.type)); }
  if (opts.status) { const w = splitList(opts.status); atoms = atoms.filter((a) => w.includes(a.status ?? 'null')); }
  if (opts.confidence) { const w = splitList(opts.confidence); atoms = atoms.filter((a) => w.includes(a.confidence)); }
  if (opts.author) {
    const w = splitList(opts.author).map((s) => s.toLowerCase());
    atoms = atoms.filter((a) => w.some((x) => a.author.toLowerCase().includes(x)));
  }
  if (opts.tags) { const w = splitList(opts.tags); atoms = atoms.filter((a) => w.some((t) => a.tags.includes(t))); }
  if (opts.begin) atoms = atoms.filter((a) => a.date >= opts.begin);
  if (opts.end) atoms = atoms.filter((a) => a.date <= opts.end);

  atoms.sort((x, y) => y.date.localeCompare(x.date) || y.id.localeCompare(x.id));
  const limit = Number.parseInt(opts.limit ?? '20', 10) || 20;
  const results = atoms.slice(0, limit);

  if (ctx.output.format === 'json') {
    ctx.output.success({ total: results.length, results });
    return;
  }
  ctx.log.info(`搜索结果(${results.length} 条)`);
  if (results.length === 0) { ctx.log.warn('无匹配'); return; }
  for (const a of results) {
    console.log('---');
    console.log(`${a.id}  ${a.type}  ${a.confidence}  ${a.status ?? '-'}  ${a.author ? '@' + a.author : ''}`);
    console.log(a.tags.length ? a.tags.map((t) => '#' + t).join(' ') : '-');
    console.log(a.knowledge);
    console.log(a.original ? `[原文] ${a.original.slice(0, 150)}${a.original.length > 150 ? '...' : ''}` : '[原文] -');
    console.log(a.url ? `[链接] ${a.url}` : '[链接] -');
    console.log(a.date);
  }
}

// ── add ──
async function runAdd(ctx: Context, argv: string[]): Promise<void> {
  const { opts, positional } = parseArgs(argv);
  if (opts.help) { ctx.log.info(ADD_HELP); return; }

  let input = positional[0];
  if (!input && !process.stdin.isTTY) input = await readStdin();
  if (!input) ctx.output.fail('INVALID_ARGS', '缺少 JSON 记录', "yo wiki add '<json>' 或通过管道传入");

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(input) as Record<string, unknown>;
  } catch {
    ctx.output.fail('INVALID_JSON', '无效的 JSON 记录');
  }

  const knowledge = String(obj.knowledge ?? '').trim();
  if (!knowledge) ctx.output.fail('INVALID_ARGS', '缺少必填字段: knowledge');
  const type = checkType(obj.type, ctx);
  const confidence = checkConfidence(obj.confidence, ctx);
  const status = checkStatus(obj.status, ctx);

  const file = atomsPath(ctx);
  const atoms = readAtoms(file);
  const atom: Atom = {
    id: nextId(atoms),
    knowledge,
    original: String(obj.original ?? ''),
    url: String(obj.url ?? ''),
    date: String(obj.date ?? today()),
    tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
    type,
    confidence,
    status,
    author: String(obj.author ?? ''),
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(atom) + '\n', 'utf8');

  ctx.output.success({ id: atom.id, record: atom }, `已添加 ${atom.id} — ${knowledge.slice(0, 60)}`);
}

// ── update ──
function runUpdate(ctx: Context, argv: string[]): void {
  const { opts, positional } = parseArgs(argv);
  if (opts.help) { ctx.log.info(UPDATE_HELP); return; }

  const id = positional[0];
  if (!id) ctx.output.fail('INVALID_ARGS', '缺少记录 ID', 'yo wiki update <id> -s achieved');
  if (!opts.status && !opts.type && !opts.confidence && !opts.tags) {
    ctx.output.fail('INVALID_ARGS', '至少指定一个更新字段(-s/-t/-c/-T)');
  }
  if (opts.type) checkType(opts.type, ctx);
  if (opts.confidence) checkConfidence(opts.confidence, ctx);
  if (opts.status && opts.status !== 'null') checkStatus(opts.status, ctx);

  const file = atomsPath(ctx);
  const atoms = readAtoms(file);
  const idx = atoms.findIndex((a) => a.id === id);
  if (idx < 0) ctx.output.fail('NOT_FOUND', `未找到 ID: ${id}`);

  const changes: string[] = [];
  if (opts.status !== undefined) {
    atoms[idx].status = opts.status === 'null' ? null : (opts.status as Status);
    changes.push(`status → ${opts.status}`);
  }
  if (opts.type) { atoms[idx].type = opts.type as AtomType; changes.push(`type → ${opts.type}`); }
  if (opts.confidence) { atoms[idx].confidence = opts.confidence as Confidence; changes.push(`confidence → ${opts.confidence}`); }
  if (opts.tags) { atoms[idx].tags = splitList(opts.tags); changes.push(`tags → ${opts.tags}`); }

  writeAtoms(file, atoms);
  ctx.output.success({ id, changes, record: atoms[idx] }, `已更新 ${id} — ${changes.join(', ')}`);
}

// ── help 文本 ──
const WIKI_HELP = `wiki — 本地知识库管理(搜索/添加/更新知识原子)

用法:
  yo wiki search [关键词...] [选项]   搜索(关键词逗号 OR、多组 AND)
  yo wiki add '<json>'                添加(参数或 stdin)
  yo wiki update <id> [选项]          更新状态/类型/置信度/标签

输出:默认 json(机器可读),-f text 切彩色。
配置:WIKI_DIR(知识库根),数据 $WIKI_DIR/原子库/atoms.jsonl
子命令详细选项:yo wiki search -h | yo wiki add -h | yo wiki update -h`;

const SEARCH_HELP = `wiki search — 搜索知识库

用法: yo wiki search [选项] [关键词...]
关键词:逗号分隔为 OR,多个位置参数为 AND(匹配 knowledge/original/author/tags)

选项:
  -l, --limit <n>       返回数量(默认 20)
  -b, --begin <date>    起始日期 YYYY-MM-DD
  -e, --end <date>      结束日期 YYYY-MM-DD
  -t, --type <list>     类型(逗号): ${TYPES.join('/')}
  -s, --status <list>   状态(逗号): null/${STATUSES.join('/')}
  -a, --author <list>   作者(逗号,模糊)
  -c, --confidence <list> 置信度(逗号): ${CONFIDENCES.join('/')}
  -T, --tags <list>     标签(逗号)

示例:
  yo wiki search 商业模式,定价
  yo wiki search -t principle -c high 逻辑`;

const ADD_HELP = `wiki add — 添加知识原子

用法: yo wiki add '<json>'   (或通过 stdin 传入)
必填: knowledge / type(${TYPES.join('/')}) / confidence(${CONFIDENCES.join('/')})
可选: status(null/${STATUSES.join('/')}) / author / original / url / date / tags[]
id 自动生成(YYYY-MM-NNN,当月自增)

示例:
  yo wiki add '{"knowledge":"...","type":"principle","confidence":"high","tags":["标签"]}'
  echo '{...}' | yo wiki add`;

const UPDATE_HELP = `wiki update — 更新知识原子

用法: yo wiki update <id> [选项]   (至少一个)
选项:
  -s, --status <v>      null/${STATUSES.join('/')}
  -t, --type <v>        ${TYPES.join('/')}
  -c, --confidence <v>  ${CONFIDENCES.join('/')}
  -T, --tags <list>     标签(逗号,覆盖)

示例:
  yo wiki update 2026-06-001 -s achieved
  yo wiki update 2026-06-003 -c high -T 定价,商业模式`;

const cmd = {
  name: 'wiki',
  version: '1.0.0',
  description: '本地知识库管理(搜索/添加/更新知识原子)',
  env: ['WIKI_DIR'],
  register(ctx: Context) {
    // cac 不支持父子命令层级:注册单命令 + allowUnknownOptions,
    // action 内从 process.argv 取原始子 argv,手动路由 search/add/update。
    ctx.cli
      .command('wiki [...rest]', '本地知识库管理(搜索/添加/更新知识原子)')
      .allowUnknownOptions()
      .usage('yo wiki <search|add|update> [...]   (详: yo wiki)')
      .action(() => {
        const idx = process.argv.indexOf('wiki');
        const argv = idx >= 0 ? process.argv.slice(idx + 1) : [];
        const sub = argv[0];
        const subArgv = argv.slice(1);
        switch (sub) {
          case 'search': return runSearch(ctx, subArgv);
          case 'add': return runAdd(ctx, subArgv);
          case 'update': return runUpdate(ctx, subArgv);
          case undefined:
          case '-h':
          case '--help':
            return ctx.log.info(WIKI_HELP);
          default:
            ctx.output.fail('INVALID_ARGS', `未知子命令: ${sub}`, '用法: yo wiki search|add|update');
        }
      });
  },
} satisfies Command;

export default cmd;
