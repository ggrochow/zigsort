class App {
  // html elements
  fileInputEl;
  canvasEl;
  minThreshInputEl;
  maxThreshInputEl;
  // wasmHandler
  handler;
  // canvas context
  context;
  // wasm loaded
  ready = false;
  // stashed original uploaded image data
  originalImageData;

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
      this.processRawImg(this.fileInputEl.files[0]);
    }

    this.minThreshInputEl = document.getElementById("min_thresh");
    if (!this.minThreshInputEl) {
      throw new Error("failed to get min input");
    }

    this.maxThreshInputEl = document.getElementById("max_thresh");
    if (!this.maxThreshInputEl) {
      throw new Error("failed to get max input");
    }

    this.processBtnEl = document.getElementById("process");
    if (!this.maxThreshInputEl) {
      throw new Error("failed to get max input");
    }

    this.processBtnEl.onclick = () => {
      this.process();
    };

    const handler = new WasmHandler();
    instantiateWasmModule(handler)
      .then(() => {
        this.handler = handler;
        this.ready = true;
      })
      .catch((e) => {
        console.error(e);
      });
  }

  process() {
    if (!this.ready) {
      console.log("wasm not loaded try again soon");
      return;
    }
    if (!this.originalImageData) {
      console.error("No image data to process");
      return;
    }

    const min = parseInt(this.minThreshInputEl.value);
    const max = parseInt(this.maxThreshInputEl.value);

    console.log("MINMAX", min, max);

    const imageData = this.originalImageData;
    const arr = imageData.data;
    const byteLen = arr.byteLength;
    const pointer =
      this.handler.mod.instance.exports.alloc_input_image(byteLen);
    new Uint8ClampedArray(this.handler.memory.buffer).set(arr, pointer);
      
    const res = this.handler.mod.instance.exports.process_img(
      pointer,
      byteLen,
      imageData.height,
      imageData.width,
      min,
      max,
    );
    console.log("gotres", res);

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
    this.applyImg(newImageData);

    this.handler.mod.instance.exports.deallocate_input_image(pointer, byteLen);
  }

  applyImg(imageData) {
    this.context.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    this.context.putImageData(imageData, 0, 0);
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
        this.context.drawImage(img, 0, 0);
        this.originalImageData = this.context.getImageData(0, 0, img.width, img.height);
      };

      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };
}

async function instantiateWasmModule(wasm_handler) {
  const wasmEnv = {
    env: {
      log_wasm: wasm_handler.log_wasm.bind(wasm_handler),
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

function init() {
  console.log("loading app");
  new App();
}

window.onload = init;

console.log("hello from indexjs");
