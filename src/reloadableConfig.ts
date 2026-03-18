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

  return {
    getData (): T {
      return data;
    },
    reload () {
      try {
        data = options.parser(options.filePath) ?? options.defaultValue;
        console.log(options.successLog(data));
      } catch (e) {
        console.error(options.errorLog, e instanceof Error ? e.message : e);
      }
    }
  };
}
