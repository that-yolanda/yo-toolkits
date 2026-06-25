import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Command, Context, HelpSpec } from "@that-yolanda/yo-toolkits";

// ── sherpa-onnx native binding(sherpa-onnx-node,支持多线程) ──
// 用 createRequire 兜底加载:jiti/tsx 转译 ESM 源码时,直接 import 一个 CJS native 包(.node)
// 可能有互操作坑;createRequire 走 Node 原生 require 机制最稳。
// 这里只声明用到的最小接口,避免依赖 sherpa-onnx 自带类型声明。
//
// 为何用 sherpa-onnx-node 而非 sherpa-onnx:
//   sherpa-onnx(WASM 包)不支持多线程;sherpa-onnx-node(node-addon-api 原生绑定)支持 numThreads,
//   且自带 .dylib,无需 DYLD_LIBRARY_PATH。两者 API 不同(new 构造 vs 工厂函数)。
// 依赖锁定 sherpa-onnx-node@1.12.40:1.13.x 的 binding 加载 silero-vad / qwen3-asr 时
//   session 初始化会失败("Please pass ... or initialize the session outside of this function")。
interface SherpaWave {
  sampleRate: number;
  samples: Float32Array;
}
interface SherpaSegment {
  /** 段起点在整条音频中的样本偏移 */
  start: number;
  samples: Float32Array;
}
interface SherpaStream {
  acceptWaveform(input: { sampleRate: number; samples: Float32Array }): void;
}
interface SherpaResult {
  text: string;
}
interface SherpaRecognizer {
  createStream(): SherpaStream;
  decode(stream: SherpaStream): void;
  getResult(stream: SherpaStream): SherpaResult;
}
interface SherpaVad {
  acceptWaveform(samples: Float32Array): void;
  isEmpty(): boolean;
  front(): SherpaSegment;
  pop(): void;
  flush(): void;
}
interface Sherpa {
  // 构造式 API(new),与旧包的工厂函数 createOfflineRecognizer/createVad 不同
  OfflineRecognizer: new (config: unknown) => SherpaRecognizer;
  Vad: new (config: unknown, bufferSizeInSeconds: number) => SherpaVad;
  readWave(file: string): SherpaWave;
}

function loadSherpa(): Sherpa {
  const localRequire = createRequire(import.meta.url);
  return localRequire("sherpa-onnx-node") as Sherpa;
}

// 推理线程数:qwen3-asr 的 decoder 是 LLM 自回归(本质串行),多线程主要加速 encoder/conv。
// 实测 4 线程约 1.4x 加速,8 线程反而退化(带宽/超核心瓶颈),故上限取 4。
const NUM_THREADS = Math.min(os.cpus().length || 4, 4);

// Qwen3-ASR 模型目录内写死的文件名(与 sherpa-onnx 官方示例一致)
const MODEL_FILES = [
  "conv_frontend.onnx",
  "encoder.int8.onnx",
  "decoder.int8.onnx",
  "tokenizer",
];
// silero-vad 在 16kHz 下的固定窗长
const VAD_WINDOW = 512;

// ── 配置解析:ASR_MODEL 目录 / ASR_VAD 文件 ──
function resolveModelDir(ctx: Context): string {
  const dir = ctx.config.get("ASR_MODEL");
  if (!dir) {
    ctx.output.fail(
      "CONFIG_MISSING",
      "未配置 ASR_MODEL(Qwen3-ASR 模型目录)",
      "设置环境变量 ASR_MODEL,或写进 yo 配置(详见 yo asr -h 的 ENV 段)",
    );
  }
  if (!fs.existsSync(dir)) {
    ctx.output.fail("MODEL_NOT_FOUND", `ASR_MODEL 目录不存在: ${dir}`);
  }
  for (const f of MODEL_FILES) {
    if (!fs.existsSync(path.join(dir, f))) {
      ctx.output.fail(
        "MODEL_NOT_FOUND",
        `模型文件缺失: ${path.join(dir, f)}`,
        "检查 ASR_MODEL 是否指向完整的 Qwen3-ASR 模型目录",
      );
    }
  }
  return dir;
}

function resolveVadPath(ctx: Context): string {
  const p = ctx.config.get("ASR_VAD");
  if (!p) {
    ctx.output.fail(
      "CONFIG_MISSING",
      "未配置 ASR_VAD(silero_vad.onnx 路径)",
      "srt 模式需要 VAD 切段;设置环境变量 ASR_VAD 指向 silero_vad.onnx",
    );
  }
  if (!fs.existsSync(p)) {
    ctx.output.fail("MODEL_NOT_FOUND", `ASR_VAD 文件不存在: ${p}`);
  }
  return p;
}

// ── 识别器构造 ──
function createQwen3Recognizer(
  sherpa: Sherpa,
  modelDir: string,
): SherpaRecognizer {
  const config = {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      qwen3Asr: {
        convFrontend: path.join(modelDir, "conv_frontend.onnx"),
        encoder: path.join(modelDir, "encoder.int8.onnx"),
        decoder: path.join(modelDir, "decoder.int8.onnx"),
        tokenizer: path.join(modelDir, "tokenizer"),
        hotwords: "",
      },
      // Qwen3-ASR 用 tokenizer 目录提供词表,tokens 传空字符串
      tokens: "",
      numThreads: NUM_THREADS,
      provider: "cpu",
      debug: 0,
    },
  };
  return new sherpa.OfflineRecognizer(config);
}

function createVad(sherpa: Sherpa, vadModelPath: string): SherpaVad {
  const config = {
    sileroVad: {
      model: vadModelPath,
      threshold: 0.5,
      minSpeechDuration: 0.25,
      minSilenceDuration: 0.5,
      maxSpeechDuration: 5,
      windowSize: VAD_WINDOW,
    },
    sampleRate: 16000,
    debug: false,
    // VAD 很轻量,单线程足够
    numThreads: 1,
  };
  // bufferSizeInSeconds 作为第二参数(不在 config 内)
  return new sherpa.Vad(config, 60);
}

// ── srt 时间码 HH:MM:SS,mmm ──
function formatSrtTime(sec: number): string {
  const ms = Math.floor(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const pad = (n: number, len = 2): string => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(millis, 3)}`;
}

// ── 纯文本:整段喂入一次识别 ──
function recognizeText(
  sherpa: Sherpa,
  recognizer: SherpaRecognizer,
  wavPath: string,
): string {
  const wave = sherpa.readWave(wavPath);
  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
  recognizer.decode(stream);
  const text = recognizer.getResult(stream).text.trim();
  return text;
}

// ── srt:VAD 按静音切段,逐段识别并打时间戳 ──
function recognizeSrt(
  sherpa: Sherpa,
  recognizer: SherpaRecognizer,
  vad: SherpaVad,
  wavPath: string,
  ctx: Context,
): string {
  const wave = sherpa.readWave(wavPath);
  const blocks: string[] = [];
  let idx = 0;

  const processSegment = (segment: SherpaSegment): void => {
    const startSec = segment.start / wave.sampleRate;
    const endSec = startSec + segment.samples.length / wave.sampleRate;
    const stream = recognizer.createStream();
    stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: segment.samples });
    recognizer.decode(stream);
    const text = recognizer.getResult(stream).text.trim();
    if (text) {
      idx++;
      blocks.push(
        `${idx}\n${formatSrtTime(startSec)} --> ${formatSrtTime(endSec)}\n${text}`,
      );
    }
  };

  // 分窗喂 VAD,每当切出一段就送进 recognizer 识别
  for (let i = 0; i < wave.samples.length; i += VAD_WINDOW) {
    const win = wave.samples.subarray(i, i + VAD_WINDOW);
    vad.acceptWaveform(win);
    while (!vad.isEmpty()) {
      processSegment(vad.front());
      vad.pop();
    }
  }
  // 收尾:flush 触发末尾未关闭的段
  vad.flush();
  while (!vad.isEmpty()) {
    processSegment(vad.front());
    vad.pop();
  }

  if (idx === 0) ctx.log.warn("未识别到有效语音段");
  return blocks.length ? blocks.join("\n\n") + "\n" : "";
}

// ── 帮助 ──
const asrSpec: HelpSpec = {
  description: "音视频转字幕(ffmpeg + sherpa-onnx Qwen3-ASR)",
  usage: "asr -i <file> -o <out> [-t text|srt]",
  options: [
    { flags: "-i, --input <file>", desc: "输入音视频文件(必填)" },
    { flags: "-o, --output <out>", desc: "输出文件,相对 cwd(必填)" },
    { flags: "-t, --type <fmt>", desc: "输出格式: text | srt(默认 text)" },
  ],
  env: [
    {
      name: "ASR_MODEL",
      desc: "Qwen3-ASR 模型目录(含 conv_frontend/encoder/decoder/tokenizer)",
    },
    { name: "ASR_VAD", desc: "silero_vad.onnx 路径(srt 模式必需)" },
  ],
};

const cmd = {
  name: "asr",
  version: "1.1.0",
  description: "音视频转字幕(ffmpeg + sherpa-onnx Qwen3-ASR)",
  deps: ["ffmpeg"],
  env: ["ASR_MODEL", "ASR_VAD"],
  register(ctx: Context) {
    const c = ctx.cli
      .command(cmd.name, cmd.description)
      .option("-i, --input <file>", "输入音视频文件(必填)")
      .option("-o, --output <out>", "输出文件路径(必填)")
      .option("-t, --type <fmt>", "输出格式: text | srt", { default: "text" })
      .action(
        async (options: { input?: string; output?: string; type?: string }) => {
          const input = options.input;
          const output = options.output;
          if (!input) {
            ctx.output.fail(
              "INVALID_ARGS",
              "缺少必填参数: -i <file>",
              "示例: yo asr -i video.mp4 -o out.txt",
            );
          }
          if (!output) {
            ctx.output.fail(
              "INVALID_ARGS",
              "缺少必填参数: -o <out>",
              "示例: yo asr -i video.mp4 -o out.txt",
            );
          }
          const type = options.type ?? "text";
          if (type !== "text" && type !== "srt") {
            ctx.output.fail("INVALID_ARGS", `不支持的格式: ${type}(可选 text/srt)`);
          }

          ctx.spawn.assertDeps(cmd.deps);

          const absInput = path.resolve(ctx.cwd, input);
          if (!fs.existsSync(absInput)) {
            ctx.output.fail("FILE_NOT_FOUND", `输入文件不存在: ${absInput}`);
          }
          const absOutput = path.resolve(ctx.cwd, output);

          // 提前校验配置(模型加载很慢,先确认路径有效再动手)
          const modelDir = resolveModelDir(ctx);
          const vadPath = type === "srt" ? resolveVadPath(ctx) : undefined;

          // ffmpeg 统一转 16kHz 单声道 pcm_s16le wav;视频用 -vn 丢视频流,音频则重编码
          const tmpBase = ctx.store.tmpDir("asr");
          ctx.store.ensureDir(tmpBase);
          const tmpWav = path.join(tmpBase, `audio-${process.pid}.wav`);
          try {
            ctx.log.info(`输入: ${absInput}`);
            ctx.log.info(`输出: ${absOutput} (${type})`);
            ctx.log.info(`推理线程: ${NUM_THREADS}`);
            ctx.log.info("音频预处理(16kHz mono)...");
            await ctx.spawn.run(
              "ffmpeg",
              [
                "-y",
                "-i",
                absInput,
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ac",
                "1",
                "-ar",
                "16000",
                tmpWav,
                "-loglevel",
                "error",
              ],
              { silent: true },
            );
            if (!fs.existsSync(tmpWav)) {
              ctx.output.fail(
                "FFMPEG_FAILED",
                "音频转换失败",
                "检查输入是否为有效音视频文件,及 ffmpeg 是否正常",
              );
            }

            const sherpa = loadSherpa();
            ctx.log.info("加载 Qwen3-ASR 模型(约 980M,首次较慢)...");
            const recognizer = createQwen3Recognizer(sherpa, modelDir);

            let content: string;
            if (type === "srt") {
              const vad = createVad(sherpa, vadPath as string);
              content = recognizeSrt(sherpa, recognizer, vad, tmpWav, ctx);
            } else {
              content = recognizeText(sherpa, recognizer, tmpWav);
            }

            fs.mkdirSync(path.dirname(absOutput), { recursive: true });
            fs.writeFileSync(absOutput, content, "utf8");

            const size = fs.statSync(absOutput).size;
            ctx.output.success(
              { output: absOutput, format: type, sizeBytes: size, threads: NUM_THREADS },
              `已生成 ${absOutput}`,
            );
          } finally {
            // 清理中间 wav,不污染 tmp 目录
            fs.rmSync(tmpWav, { force: true });
          }
        },
      );
    (c as { outputHelp: () => void }).outputHelp = () => {
      process.stdout.write(ctx.renderHelp(asrSpec) + "\n");
    };
  },
} satisfies Command;

export default cmd;
