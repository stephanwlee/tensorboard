export function getWorker(workerResourcePath: string): Worker {
  return new Worker(workerResourcePath);
}
