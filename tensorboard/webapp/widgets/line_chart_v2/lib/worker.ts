/**
 * Returns a Worker instancefor a given resource url.
 *
 * This module exists to conform to internal requirements.
 */
export function getWorker(workerResourcePath: string): Worker {
  return new Worker(workerResourcePath);
}
