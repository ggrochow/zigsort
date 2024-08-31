const canvasEl = document.getElementById("canvas");
if (!canvasEl) {
  throw new Error("no canvas");
}
const context = canvasEl.getContext("2d");
if (!context) {
  throw new Error("failed to get 2d canvas context");
}
const fileInputEl = document.getElementById("file_input");
if (!fileInputEl) {
  throw new Error("failed to get file input");
}

function onFileChange() {
  const file = fileInputEl.files[0];

  if (file) {
    processRawImg(file);
  }
}

function processRawImg(file) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      canvasEl.width = img.width;
      canvasEl.height = img.height;
      console.log("image found", "W", img.width, "H", img.height);
      context.drawImage(img, 0, 0);
      // this should start our wasm stuff
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

fileInputEl.addEventListener("change", onFileChange);
if (fileInputEl.files[0]) {
  processRawImg(fileInputEl.files[0]);
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

function getImageData() {
  return context.getImageData(0, 0, canvasEl.width, canvasEl.height);
}

const handler = new WasmHandler();

function init() {
  instantiateWasmModule(handler)
    .then((mod) => {
      const imageData = getImageData();
      const arr = imageData.data;

      const byteLen = arr.byteLength;
      const pointer = mod.instance.exports.alloc_input_image(byteLen);

      new Uint8ClampedArray(handler.memory.buffer).set(arr, pointer);

      const res = mod.instance.exports.count_array(pointer, arr.length);
      console.log("count_array val", res);
      console.log("arr.byteLength", byteLen, "arr.len", arr.length);

      const resBuf = new Uint8ClampedArray(
        handler.memory.buffer,
        pointer,
        byteLen,
      );
      const newImageData = new ImageData(
        resBuf,
        imageData.width,
        imageData.height,
      );

      context.clearRect(0, 0, canvasEl.width, canvasEl.height);
      context.putImageData(newImageData, 0, 0);

      mod.instance.exports.deallocate_input_image(pointer, byteLen);
    })
    .catch((e) => {
      console.error(e);
    });
}

document.onLoad = init();

console.log("hello from indexjs");
