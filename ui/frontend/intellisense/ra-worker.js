import init, { initThreadPool, WorldState } from './pkg/wasm_demo.js';

const start = async () => {
  await init();

  // Thread pool initialization with the given number of threads
  // (pass `navigator.hardwareConcurrency` if you want to use all cores).
  await initThreadPool(navigator.hardwareConcurrency)

  const state = new WorldState();

  onmessage = (e) => {
    const { which, args, id } = e.data;
    const result = state[which](...args);

    postMessage({
      id: id,
      result: result,
    });
  };
};

start().then(() => {
  postMessage({
    id: 'ra-worker-ready',
  })
})



