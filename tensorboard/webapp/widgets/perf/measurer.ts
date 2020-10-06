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
      console.time(`anim_${times}`);
      waitAnimationFrame(times - 1).then(resolve, resolve);
      console.timeEnd(`anim_${times}`);
    });
  });
}

export async function mark() {
  await waitAnimationFrame(5);
  container.innerText = `${performance.now()}`;
}
