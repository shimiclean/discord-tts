import { getConfigLock } from './configLock';

export interface ReloadableConfigOptions<T> {
  filePath: string;
  parser: (filePath: string) => T | null;
  defaultValue: T;
  successLog: (data: T) => string;
  errorLog: string;
}

export interface ReloadableConfig<T> {
  getData(): T;
  reload(): void;
}

export function createReloadableConfig<T> (options: ReloadableConfigOptions<T>): ReloadableConfig<T> {
  let data: T = options.parser(options.filePath) ?? options.defaultValue;
  const lock = getConfigLock(options.filePath);

  return {
    getData (): T {
      return data;
    },
    reload () {
      lock.withReadLockSync(() => {
        try {
          data = options.parser(options.filePath) ?? options.defaultValue;
          console.log(options.successLog(data));
        } catch (e) {
          console.error(options.errorLog, e instanceof Error ? e.message : e);
        }
      });
    }
  };
}
