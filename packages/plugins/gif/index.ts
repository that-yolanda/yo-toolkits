import path from 'node:path';
import fs from 'node:fs';
import type { Command, Context } from '@that-yolanda/yo-toolkits';

interface QualityConfig {
  fps: number;
  scale: string; // 附加 scale 滤镜(空表示原始分辨率)
}

const QUALITY: Record<string, QualityConfig> = {
  h: { fps: 24, scale: '' },
  m: {
    fps: 15,
    scale: "scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)':flags=lanczos",
  },
  l: {
    fps: 12,
    scale: "scale='if(gt(iw,ih),-2,480)':'if(gt(iw,ih),480,-2)':flags=lanczos",
  },
};

// 带透明通道的像素格式前缀,需先合成白底
const TRANSPARENT_PREFIXES = ['yuva', 'gbrap', 'rgba', 'argb', 'pal8'];

export default {
  name: 'gif',
  version: '1.0.0',
  description: '视频转 GIF 动图',
  register(ctx: Context) {
    ctx.cli
      .command('gif', '视频转 GIF 动图')
      .option('-i, --input <file>', '输入视频文件路径(必填)')
      .option('-o, --output [file]', '输出 GIF 路径(默认与输入同目录同名)')
      .option('-q, --quality [level]', '清晰度 h/m/l(默认 h)', { default: 'h' })
      .action(
        async (options: { input?: string; output?: string; quality?: string }) => {
          const input = options.input;
          if (!input) {
            ctx.output.fail('INVALID_ARGS', '缺少必填参数: -i <file>', '示例: yo gif -i video.mp4 -q m');
          }

          const absInput = path.resolve(ctx.cwd, input);
          if (!fs.existsSync(absInput)) {
            ctx.output.fail('FILE_NOT_FOUND', `视频文件不存在: ${absInput}`);
          }

          const quality = options.quality ?? 'h';
          if (!(quality in QUALITY)) {
            ctx.output.fail('INVALID_ARGS', `不支持的清晰度: ${quality}(可选 h/m/l)`);
          }
          const cfg = QUALITY[quality];

          ctx.spawn.assertDeps(['ffmpeg', 'ffprobe']);

          const inputDir = path.dirname(absInput);
          const filestem = path.basename(absInput, path.extname(absInput));
          const finalOutput = options.output
            ? path.resolve(ctx.cwd, options.output)
            : path.join(inputDir, `${filestem}.gif`);
          ctx.store.ensureDir(path.dirname(finalOutput));

          const vfBase = cfg.scale ? `fps=${cfg.fps},${cfg.scale}` : `fps=${cfg.fps}`;
          const tmpBase = ctx.store.tmpDir('gif');
          ctx.store.ensureDir(tmpBase);
          const palette = path.join(tmpBase, `palette-${filestem}-${process.pid}.png`);
          let actualInput = absInput;

          ctx.log.info(`输入: ${absInput}`);
          ctx.log.info(`清晰度: ${quality} (fps=${cfg.fps})`);
          ctx.log.info(`输出: ${finalOutput}`);

          // 透明通道检测 → 合成白底
          const pix = await ctx.spawn.run(
            'ffprobe',
            [
              '-v', 'error',
              '-select_streams', 'v:0',
              '-show_entries', 'stream=pix_fmt',
              '-of', 'csv=p=0',
              absInput,
            ],
            { silent: true },
          );
          const pixFmt = pix.stdout.trim();
          if (TRANSPARENT_PREFIXES.some((p) => pixFmt.startsWith(p))) {
            ctx.log.info(`检测到透明通道(${pixFmt}),合成白色背景...`);
            const wh = await ctx.spawn.run(
              'ffprobe',
              [
                '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height',
                '-of', 'csv=p=0',
                absInput,
              ],
              { silent: true },
            );
            const [w, h] = wh.stdout.trim().split('x');
            const flat = path.join(tmpBase, `flat-${filestem}-${process.pid}.mp4`);
            await ctx.spawn.run('ffmpeg', [
              '-f', 'lavfi', '-i', `color=white:s=${w}x${h}:d=999,format=rgb24`,
              '-i', absInput,
              '-filter_complex',
              "[1:v]format=rgba[vid];[0:v][vid]overlay=0:0:format=auto,format=rgb24",
              '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', '-y', flat,
              '-loglevel', 'error',
            ]);
            actualInput = flat;
            ctx.log.ok('透明通道已合成到白色背景');
          }

          // Step 1: 生成调色板
          ctx.log.info('[1/2] 生成调色板...');
          await ctx.spawn.run('ffmpeg', [
            '-i', actualInput,
            '-vf', `${vfBase},palettegen=stats_mode=full`,
            '-y', palette, '-loglevel', 'error',
          ]);
          if (!fs.existsSync(palette)) ctx.output.fail('FFMPEG_FAILED', '调色板生成失败');
          ctx.log.ok('调色板生成完成');

          // Step 2: 生成 GIF
          ctx.log.info('[2/2] 生成 GIF...');
          await ctx.spawn.run('ffmpeg', [
            '-i', actualInput, '-i', palette,
            '-lavfi', `${vfBase}[x];[x][1:v]paletteuse=dither=sierra2_4a`,
            '-y', finalOutput, '-loglevel', 'error',
          ]);
          if (!fs.existsSync(finalOutput)) ctx.output.fail('FFMPEG_FAILED', 'GIF 生成失败');

          fs.rmSync(palette, { force: true });
          const size = fs.statSync(finalOutput).size;
          ctx.output.success(
            { output: finalOutput, fps: cfg.fps, sizeBytes: size },
            `生成 ${finalOutput} (${(size / 1024 / 1024).toFixed(2)} MB)`,
          );
        },
      );
  },
} satisfies Command;
