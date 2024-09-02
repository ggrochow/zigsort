// TODO: move slow wasm blocking fns to webworker somehow
// this is in progress GL
class App {
  // html elements
  fileInputEl;
  canvasEl;
  minThreshInputEl;
  maxThreshInputEl;
  // canvas context
  context;
  // worker + wasm loaded
  ready = false;
  // is currently in processing
  processing = false;
  // if we tried to que a process while currently processing
  // use to send another call to process when complete so we dont multi-q
  needsProcessing = false;

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

    this.worker = new Worker("./worker.js");
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = (e) => {
      console.error("worker error", e);
    };
    this.worker.onmessageerror = (e) => {
      console.error("message error", e);
    };
  }

  handleWorkerMessage(e) {
    const payload = e.data;
    const messageType = payload?.cmd;
    console.log("index got message", messageType);

    switch (messageType) {
      case "process_complete":
        const { arr, height, width, pointer, byteLen } = payload.body;
        const typedArr = new Uint8ClampedArray(arr, pointer, byteLen);
        const newImageData = new ImageData(typedArr, width, height);
        this.applyImg(newImageData);

        this.processing = false;
        if (this.needsProcessing) {
          this.process();
        }
        break;

      case "wasm_loaded":
        this.ready = true;
        break;

      default:
        console.log("index unknown message type - ", messageType);
    }
  }

  process() {
    if (!this.ready) {
      console.log("wasm not loaded try again soon");
      return;
    }
    if (this.processing) {
      console.log("cant process while already processing");
      this.needsProcessing = true;
      return;
    }
    this.processing = true;

    const min = parseInt(this.minThreshInputEl.value);
    const max = parseInt(this.maxThreshInputEl.value);
    this.worker.postMessage({
      cmd: "process",
      body: {
        min,
        max,
      },
    });
  }

  applyImg(imageData) {
    this.context.putImageData(
      imageData,
      0,
      0,
    );
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

        const imageData = this.context.getImageData(
          0,
          0,
          img.width,
          img.height,
        );

        this.worker.postMessage(
          {
            cmd: "load_image",
            body: {
              buf: imageData.data.buffer,
              width: img.width,
              height: img.height,
            },
          },
          [imageData.data.buffer],
        );
      };

      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };
}

function init() {
  console.log("loading app");
  new App();
}

window.onload = init;

console.log("hello from indexjs");
