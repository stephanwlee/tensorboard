const container = document.createElement('div');
Object.assign(container.style, {
  position: 'fixed',
  bottom: 0,
  right: 0,
  background: '#555a',
  padding: ' 10px',
});

requestAnimationFrame(() => {
  document.body.appendChild(container);
});

async function waitAnimationFrame(times: number = 1) {
  if (times <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      waitAnimationFrame(times - 1).then(resolve, resolve);
    });
  });
}

let startTime: number = 0;

export async function start() {
  console.time(`start_marker`);
  console.timeEnd(`start_marker`);
  startTime = performance.now();
}

export async function mark(numWaitAnimationFrames = 5) {
  await waitAnimationFrame(numWaitAnimationFrames);
  console.time(`end_marker`);
  console.timeEnd(`end_marker`);
  container.innerText = `${performance.now() - startTime}`;
}
