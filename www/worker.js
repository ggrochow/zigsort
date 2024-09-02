const state = {
  processing: false,
  ready: false,
  imageData: undefined,
  handler: undefined,
};

class WasmHandler {
  constructor() {
    this.memory = null;
    this.mod = null;
  }

  log_wasm(s, len) {
    const buf = new Uint8Array(this.memory.buffer, s, len);
    if (len == 0) {
      return;
    }
    console.log(new TextDecoder("utf8").decode(buf));
  }
}

class WasmApp {
  constructor(handler) {
    WebAssembly.instantiateStreaming(fetch("pixelsorter.wasm"), {
      log_wasm: handler.log_wasm.bind(handler),
    })
      .then((mod) => {
        handler.mod = mod;
        handler.memory = mod.instance.exports.memory;
        state.ready = true;
        state.handler = handler;

        self.postMessage({
          cmd: "wasm_loaded",
        });
      })
      .catch((e) => {
        console.error(e);
      });
  }
}

const handler = new WasmHandler();
const wasmApp = new WasmApp(handler);

function process(min, max) {
  if (!state.handler) {
    console.error("missing handler cant process");
    return;
  }
  if (!state.imageData) {
    console.error("missing imagedata cant process");
    return;
  }

  const imageData = structuredClone(state.imageData);
  const arr = imageData.data;
  const byteLen = arr.byteLength;

  const pointer = state.handler.mod.instance.exports.alloc_input_image(byteLen);
  new Uint8ClampedArray(state.handler.memory.buffer).set(arr, pointer);

  const res = state.handler.mod.instance.exports.process_img(
    pointer,
    byteLen,
    imageData.height,
    imageData.width,
    min,
    max,
  );
  console.log("process_img res", res);

  const resBuf = structuredClone(
    new Uint8ClampedArray(state.handler.memory.buffer, pointer, byteLen),
  );

  console.log("worker post typedArr buf len", resBuf.buffer.byteLength);
  console.log("worker post typedArr len", resBuf.length);
  self.postMessage(
    {
      cmd: "process_complete",
      body: {
        arr: resBuf.buffer,
        height: imageData.height,
        width: imageData.width,
        pointer, byteLen
      },
    },
    [resBuf.buffer],
  );

  state.handler.mod.instance.exports.deallocate_input_image(pointer, byteLen);
}

// todo better post message payload.
// lets use an actual object instead of random tuples
self.onmessage = (e) => {
  const payload = e.data;
  const messageType = payload?.cmd;
  console.log("worker got message", messageType);

  switch (messageType) {
    case "load_image":
      const { height, width, buf } = payload.body;
      const typedArr = new Uint8ClampedArray(buf);
      state.imageData = new ImageData(typedArr, width, height);

      self.postMessage({
        cmd: "load_image_done",
      });
      break;

    case "process":
      const { min, max } = payload.body;
      process(min, max);
      break;

    default:
      console.log("worker unknown message type - ", messageType);
  }
};
