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
    console.time(`anim_${times}`);
    console.timeEnd(`anim_${times}`);
    requestAnimationFrame(() => {
      waitAnimationFrame(times - 1).then(resolve, resolve);
    });
  });
}

export async function mark(numWaitAnimationFrames = 5) {
  await waitAnimationFrame(numWaitAnimationFrames);
  container.innerText = `${performance.now()}`;
}
