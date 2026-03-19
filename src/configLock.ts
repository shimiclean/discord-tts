import { RWLock } from './rwLock';

const locks = new Map<string, RWLock>();

export function getConfigLock (filePath: string): RWLock {
  let lock = locks.get(filePath);
  if (!lock) {
    lock = new RWLock();
    locks.set(filePath, lock);
  }
  return lock;
}
