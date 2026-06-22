// 类型与契约
export * from './types.js';

// Context 装配
export { createContext } from './context.js';
export type { CreateContextOptions } from './context.js';

// 子系统实现(插件通常只需 Context,这些供 cli / 测试直接用)
export { ConsoleLogger } from './logger.js';
export { ConsoleOutput } from './output.js';
export { ProcessSpawner } from './spawn.js';
export { FileConfig } from './config.js';
export { FileSystemStore } from './store.js';

// 加载器与 registry
export { loadPlugins } from './loader.js';
export {
  fetchRemoteRegistry,
  listLocal,
  getLocal,
  addLocal,
  removeLocal,
  remoteRegistryUrl,
  DEFAULT_REPO,
  DEFAULT_REF,
  LOCAL_DIR,
  LOCAL_REGISTRY_PATH,
} from './registry.js';
export { fetchSubdir } from './fetch.js';
export type { FetchOptions } from './fetch.js';
