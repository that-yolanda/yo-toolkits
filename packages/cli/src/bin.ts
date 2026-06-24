#!/usr/bin/env node
import { bootstrap } from './bootstrap.js';

// cac.parse 期望完整 process.argv(含 node / script 前两项,内部自行 slice(2)),
// 故此处传完整 process.argv,bootstrap 内部仅做 --json 剥离
void bootstrap(process.argv.slice(2)).catch((err: unknown) => {
  // 最后防线:bootstrap 内部已尽量自处理
  console.error('[ERROR]', err instanceof Error ? err.message : err);
  process.exit(1);
});
