import fs from 'node:fs';
import path from 'node:path';
import type { Command, Context, HelpSpec } from '@that-yolanda/yo-toolkits';

interface CountResult {
  source: string;
  encoding?: string;
  chinese: number;
  english: number;
  total: number;
}

/** 统计中文汉字数与英文单词数(英文支持撇号连接,如 don't / it's) */
function countText(text: string): { chinese: number; english: number } {
  // CJK 基本汉字区(U+4E00–U+9FFF);扩展区字符日常文本极少,按需再扩展
  const chinese = (text.match(/[一-鿿]/g) ?? []).length;
  const english = (
    text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? []
  ).length;
  return { chinese, english };
}

/**
 * 解码文件缓冲:处理 UTF-8 BOM,按 UTF-8 解码。
 * 注:GB18030/Big5 需额外依赖(iconv-lite),第一版仅支持 UTF-8。
 */
function decodeBuffer(buf: Buffer): { text: string; encoding: string } {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString('utf8'), encoding: 'UTF-8 (BOM)' };
  }
  const utf8 = buf.toString('utf8');
  if (utf8.includes('�')) {
    return { text: utf8.replace(/�/g, ''), encoding: 'UTF-8 (fallback)' };
  }
  return { text: utf8, encoding: 'UTF-8' };
}

interface Input {
  text: string;
  source: string;
  encoding?: string;
}

/** 从参数解析待统计文本(缺参时 fail 退出) */
function gatherInput(options: { input?: string; text?: string }, ctx: Context): Input {
  if (options.text !== undefined) {
    return { text: options.text, source: options.text, encoding: 'input-string' };
  }
  if (options.input) {
    const absFile = path.resolve(ctx.cwd, options.input);
    if (!fs.existsSync(absFile)) {
      ctx.output.fail('FILE_NOT_FOUND', `文件不存在: ${absFile}`);
    }
    const decoded = decodeBuffer(fs.readFileSync(absFile));
    return { text: decoded.text, source: absFile, encoding: decoded.encoding };
  }
  ctx.output.fail(
    'INVALID_ARGS',
    '请指定 -i <file> 或 -t <text>',
    '示例: yo word-count -t "你好 world"',
  );
}

const wordCountSpec: HelpSpec = {
  description: '中英文字数统计',
  usage: 'word-count -i <path> | -t <string>',
  options: [
    { flags: '-i, --input <path>', desc: '按文件统计' },
    { flags: '-t, --text <string>', desc: '按字符串统计' },
  ],
};

const cmd = {
  name: 'word-count',
  version: '1.0.0',
  description: '中英文字数统计',
  register(ctx: Context) {
    const c = ctx.cli
      .command(cmd.name, cmd.description)
      .option('-i, --input <path>', '按文件统计')
      .option('-t, --text <string>', '按字符串统计')
      .action((options: { input?: string; text?: string }) => {
        const { text, source, encoding } = gatherInput(options, ctx);
        const { chinese, english } = countText(text);
        const result: CountResult = {
          source,
          encoding,
          chinese,
          english,
          total: chinese + english,
        };

        if (ctx.output.format === 'json') {
          ctx.output.success(result);
          return;
        }
        ctx.log.info('统计结果');
        const lines = ['------------------------'];
        lines.push(`来源:${result.source}`);
        if (result.encoding) lines.push(`编码:${result.encoding}`);
        lines.push(`中文汉字数:${result.chinese}`);
        lines.push(`英文单词数:${result.english}`);
        lines.push(`合计字数:${result.total}`);
        process.stdout.write(lines.join('\n') + '\n');
      });
    (c as { outputHelp: () => void }).outputHelp = () => {
      process.stdout.write(ctx.renderHelp(wordCountSpec) + '\n');
    };
  },
} satisfies Command;

export default cmd;
