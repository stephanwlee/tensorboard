import {getWorker} from './worker';

const MAX_WORKER_INSTANCE = 10;

interface WorkerCache {
  index: number;
  workers: Worker[];
}

export interface WorkerLike {
  postMessage: (message: any, transfer: Transferable[]) => void;
  free: () => void;
}

class WorkerAllocator {
  private index: number = 0;
  private readonly workers: Worker[] = [];
  private readonly freeWorker = new Set<Worker>();

  constructor(private readonly workerResourcePath: string) {
    // TODO(tensorboard-team): consider pre-allocating with the IdleCallback.
  }

  getNext(): WorkerLike {
    let worker: Worker;
    if (this.freeWorker.size) {
      worker = this.freeWorker.values().next().value;
      this.freeWorker.delete(worker);
    } else if (this.workers.length >= MAX_WORKER_INSTANCE) {
      worker = this.workers[this.index];
      this.index++;
    } else {
      worker = getWorker(this.workerResourcePath);
      this.workers[this.index++] = worker;
    }

    return {
      postMessage: (mesasge: any, transfer: Transferable[]) => {
        worker.postMessage(mesasge, transfer);
      },
      free: () => {
        this.freeWorker.add(worker);
      },
    };
  }
}
const workerAllocators = new Map<string, WorkerAllocator>();

/**
 *
 * @param workerResourcePath
 */
export function getWorkerInstance(workerResourcePath: string): WorkerLike {
  if (!workerAllocators.has(workerResourcePath)) {
    workerAllocators.set(
      workerResourcePath,
      new WorkerAllocator(workerResourcePath)
    );
  }

  return workerAllocators.get(workerResourcePath)!.getNext();
}
