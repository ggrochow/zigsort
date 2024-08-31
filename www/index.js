class App {
  // html elements
  fileInputEl;
  canvasEl;
  // canvas context
  context;
  // wasm load status
  ready;

  constructor() {
    this.canvasEl = document.getElementById("canvas");
    if (!this.canvasEl) {
      throw new Error("no canvas");
    }

    this.context = this.canvasEl.getContext("2d");
    if (!this.context) {
      throw new Error("failed to get 2d canvas context");
    }

    this.fileInputEl = document.getElementById("file_input");
    if (!this.fileInputEl) {
      throw new Error("failed to get file input");
    }

    this.fileInputEl.addEventListener("change", this.onFileChange);
    if (this.fileInputEl.files[0]) {
      this.processRawImg(fileInputEl.files[0]);
    }

    this.ready = false;
    this.handler = new WasmHandler();
    instantiateWasmModule(this.handler)
      .then(() => {
        console.log("ready");
        this.ready = true;
      })
      .catch((e) => {
        console.error(e);
      });
  }

  process() {
    if (!this.ready) {
      console.log("wasm loading");
      return;
    }
    console.time("process");

    console.time("prewasm");
    const imageData = this.context.getImageData(
      0,
      0,
      this.canvasEl.width,
      this.canvasEl.height,
    );
    console.log(imageData);
    const arr = imageData.data;
    const byteLen = arr.byteLength;
    console.timeEnd("prewasm");

    console.time("alloc");
    const pointer =
      this.handler.mod.instance.exports.alloc_input_image(byteLen);
    console.timeEnd("alloc");

    console.time("arr");
    new Uint8ClampedArray(this.handler.memory.buffer).set(arr, pointer);
    console.time("arrEnd");

    console.time("wasm");
    const res = this.handler.mod.instance.exports.process_img(
      pointer,
      byteLen,
      imageData.height,
      imageData.width,
    );
    console.timeEnd("wasm");

    console.log("wasm res", res);
    console.time("putImg");
    const resBuf = new Uint8ClampedArray(
      this.handler.memory.buffer,
      pointer,
      byteLen,
    );
    const newImageData = new ImageData(
      resBuf,
      imageData.width,
      imageData.height,
    );
    this.context.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    this.context.putImageData(newImageData, 0, 0);
    console.timeEnd("putImg");

    console.time("dealloc");
    this.handler.mod.instance.exports.deallocate_input_image(pointer, byteLen);
    console.timeEnd("dealloc");

    console.timeEnd("process");
  }

  onFileChange = () => {
    const file = this.fileInputEl.files[0];

    if (file) {
      this.processRawImg(file);
    }
  };

  processRawImg = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        this.canvasEl.width = img.width;
        this.canvasEl.height = img.height;
        console.log("image found", "W", img.width, "H", img.height);
        this.context.drawImage(img, 0, 0);

        this.process();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };
}

class WasmHandler {
  constructor() {
    this.memory = null;
    this.mod = null;
    this.ctx = null;
  }

  log_wasm(s, len) {
    const buf = new Uint8Array(this.memory.buffer, s, len);
    if (len == 0) {
      return;
    }
    console.log(new TextDecoder("utf8").decode(buf));
  }
}

async function instantiateWasmModule(wasm_handler) {
  const wasmEnv = {
    env: {
      logWasm: wasm_handler.log_wasm.bind(wasm_handler),
    },
  };

  const mod = await WebAssembly.instantiateStreaming(
    fetch("pixelsorter.wasm"),
    wasmEnv,
  );

  wasm_handler.memory = mod.instance.exports.memory;
  wasm_handler.mod = mod;

  return mod;
}

function init() {
  console.log("loading app");
  new App();
}

window.onload = init;

console.log("hello from indexjs");
