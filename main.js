class LandingPage {
  constructor(onStart) {
    this.landing = document.getElementById("landing");
    this.startButton = this.landing.querySelector(".start-drawing");

    this.startButton.addEventListener("click", () => {
      this.landing.classList.add("hidden");
      if (onStart) {
        onStart();
      }
    });
  }
}

class DrawingBoard {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.isDrawing = false;
    this.currentTool = "pencil";
    this.color = "#000000";
    this.brushSize = 2;
    this.startX = 0;
    this.startY = 0;
    this.history = [];
    this.redoStack = [];
    this.maxStates = 50;
    this.isDarkMode = false;

    this.recentColors = JSON.parse(localStorage.getItem("recentColors")) || [
      "#000000",
      "#ffffff",
      "#ff0000",
      "#00ff00",
      "#0000ff",
    ];

    this.backgroundColor = "#ffffff";

    this.landing = new LandingPage(() => {
      this.initializeCanvas();
      this.setupEventListeners();
      this.initializeColorPicker();
      this.initializeBrushSizeControl();
      this.saveState();
    });

    // this.initializeCanvas();
    // this.setupEventListeners();
    // this.initializeColorPicker();
    // this.initializeBrushSizeControl();
    // this.saveState();
  }

  initializeCanvas() {
    this.resizeCanvas();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initializeBrushSizeControl() {
    const control = document.querySelector(".brush-size-control");

    control.innerHTML = `
      <div class="card" style="width: 12rem">
        <label for="brushSize">Brush Size: <span id="brushSizeValue">2</span>px</label>
        <input type="range" id="brushSize" class="form-range" min="1" max="50" value="2" />
      </div>
      `;

    this.brushSizeValue = document.getElementById("brushSizeValue");
    this.brushSizeSlider = document.getElementById("brushSize");

    this.setupBrushSizeControlEvents();
  }

  initializeColorPicker() {
    const picker = document.querySelector(".color-picker");
    picker.innerHTML = `
      <div class="card" style="width: 12rem;">
        <div class="current-color">
          <input type="color" id="mainColorPicker" value="#000000" class="form-control form-control-color">
          <input type="text" id="hexColorInput" value="#000000" class="form-control" placeholder="#000000">
        </div>
        <div class="color-sliders">
          <div class="slider-group">
            <label class="form-label">
              R: 
              <span id="redValue">0</span>
            </label>
            <input type="range" id="redSlider" class="form-range" min="0" max="255" value="0">
          </div>
          <div class="slider-group">
            <label class="form-label">
              G:
              <span id="greenValue">0</span>
            </label>
            <input type="range" id="greenSlider" class="form-range" min="0" max="255" value="0">
          </div>
          <div class="slider-group">
            <label class="form-label">
              B:
              <span id="blueValue">0</span>
            </label>
            <input type="range" id="blueSlider" class="form-range" min="0" max="255" value="0">
          </div>
        </div>
        <div class="recent-colors"></div>
      </div>
    `;

    this.mainPicker = document.getElementById("mainColorPicker");
    this.hexInput = document.getElementById("hexColorInput");
    this.redSlider = document.getElementById("redSlider");
    this.greenSlider = document.getElementById("greenSlider");
    this.blueSlider = document.getElementById("blueSlider");

    window.addEventListener("resize", () => this.positionColorPicker());
    this.setupColorPickerEvents();
    this.updateRecentColors();
  }

  setupColorPickerEvents() {
    this.mainPicker.addEventListener("input", (e) => this.updateFromMainPicker(e.target.value));
    this.hexInput.addEventListener("input", (e) => this.updateFromHexInput(e.target.value));

    this.mainPicker.addEventListener("change", (e) => this.addToRecentColors(e.target.value));

    [this.redSlider, this.greenSlider, this.blueSlider].forEach((slider) => {
      slider.addEventListener("input", () => this.updateFromSliders());
      slider.addEventListener("change", () => this.addToRecentColors(this.color));
    });
  }

  setupBrushSizeControlEvents() {
    this.brushSizeSlider.addEventListener("input", (e) => {
      this.brushSize = parseInt(e.target.value);
      this.brushSizeValue.textContent = this.brushSize;
    });
  }

  updateFromMainPicker(color) {
    this.color = color;
    this.hexInput.value = color;
    this.updateSliders(color);
  }

  updateFromHexInput(hex) {
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      this.color = hex;
      this.mainPicker.value = hex;
      this.updateSliders(hex);
    }
  }

  updateFromSliders() {
    const color = `#${this.componentToHex(this.redSlider.value)}${this.componentToHex(
      this.greenSlider.value
    )}${this.componentToHex(this.blueSlider.value)}`;
    this.color = color;
    this.mainPicker.value = color;
    this.hexInput.value = color;
    this.updateSliderLabels();
  }

  updateSliders(hex) {
    const rgb = this.hexToRgb(hex);
    this.redSlider.value = rgb.r;
    this.greenSlider.value = rgb.g;
    this.blueSlider.value = rgb.b;
    this.updateSliderLabels();
  }

  updateSliderLabels() {
    document.getElementById("redValue").textContent = this.redSlider.value;
    document.getElementById("greenValue").textContent = this.greenSlider.value;
    document.getElementById("blueValue").textContent = this.blueSlider.value;
  }

  componentToHex(c) {
    const hex = parseInt(c).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  addToRecentColors(color) {
    const index = this.recentColors.indexOf(color);
    if (index !== -1) {
      this.recentColors.splice(index, 1);
    }
    this.recentColors.unshift(color);
    this.recentColors = this.recentColors.slice(0, 4);
    localStorage.setItem("recentColors", JSON.stringify(this.recentColors));
    this.updateRecentColors();
  }

  updateRecentColors() {
    const container = document.querySelector(".recent-colors");
    container.innerHTML = this.recentColors
      .map(
        (color) => `
        <button class="color-swatch btn" 
                style="background-color: ${color}"
                data-color="${color}"
                title="${color}">
        </button>
      `
      )
      .join("");

    container.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        const color = swatch.dataset.color;
        this.updateFromMainPicker(color);
        this.mainPicker.value = color;
      });
    });
  }

  positionColorPicker() {
    const picker = document.querySelector(".color-picker");
    const button = document.querySelector('[data-tool="palette"]');

    if (button && picker.classList.contains("visible")) {
      const buttonRect = button.getBoundingClientRect();
      picker.style.position = "absolute";
      picker.style.left = `${buttonRect.left - 76}px`;
      picker.style.top = `${buttonRect.bottom + window.scrollY + 15}px`;
    }
  }

  positionBrushSizeControl() {
    const control = document.querySelector(".brush-size-control");
    const button = document.querySelector('[data-tool="brush-size"]');

    if (button && control.classList.contains("visible")) {
      const buttonRect = button.getBoundingClientRect();
      control.style.position = "absolute";
      control.style.left = `${buttonRect.left - 76}px`;
      control.style.top = `${buttonRect.bottom + window.scrollY + 15}px`;
    }
  }

  toggleColorPicker() {
    const picker = document.querySelector(".color-picker");
    picker.classList.toggle("visible");
    document.querySelector(".brush-size-control").classList.remove("visible");
    this.positionColorPicker();
  }

  toggleBrushSizeControl() {
    const control = document.querySelector(".brush-size-control");
    control.classList.toggle("visible");
    document.querySelector(".color-picker").classList.remove("visible");
    this.positionBrushSizeControl();
  }

  handleButtonClick(button) {
    const tool = button.dataset.tool;

    switch (tool) {
      case "undo":
        this.undo();
        return;
      case "redo":
        this.redo();
        return;
      case "clear":
        this.clearCanvas();
        return;
      case "palette":
        console.log("palette");
        this.toggleColorPicker();
        return;
      case "brush-size":
        console.log("brush");
        this.toggleBrushSizeControl();
        return;
      case "download":
        this.downloadCanvas();
        return;
      default:
        this.currentTool = tool;
        document.querySelectorAll(".btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.tool === tool);
          btn.firstElementChild.classList.toggle("white-outline", btn.dataset.tool === tool);
        });
    }
  }

  saveState() {
    const state = document.createElement("canvas");
    state.width = this.canvas.width;
    state.height = this.canvas.height;
    state.getContext("2d").drawImage(this.canvas, 0, 0);

    this.history.push(state);
    if (this.history.length > this.maxStates) {
      this.history.shift();
    }

    this.redoStack = [];
  }

  setupEventListeners() {
    window.addEventListener("resize", () => this.resizeCanvas());
    this.canvas.addEventListener("mousedown", this.startDrawing.bind(this));
    this.canvas.addEventListener("mousemove", this.draw.bind(this));
    this.canvas.addEventListener("mouseup", this.stopDrawing.bind(this));
    this.canvas.addEventListener("mouseout", this.stopDrawing.bind(this));

    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", () => this.handleButtonClick(btn));
    });
  }

  startDrawing(event) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;
    if (this.currentTool === "pencil") {
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
    }
  }

  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.saveState();
    }
  }

  draw(event) {
    if (!this.isDrawing) return;

    const rect = this.canvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.brushSize;

    if (this.currentTool === "pencil") {
      this.ctx.lineTo(currentX, currentY);
      this.ctx.stroke();
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (this.history.length > 0) {
        this.ctx.drawImage(this.history[this.history.length - 1], 0, 0);
      }

      this.ctx.beginPath();
      switch (this.currentTool) {
        case "line":
          this.drawLine(this.startX, this.startY, currentX, currentY);
          break;
        case "rectangle":
          this.drawRectangle(this.startX, this.startY, currentX, currentY);
          break;
        case "circle":
          this.drawCircle(this.startX, this.startY, currentX, currentY);
          break;
        case "triangle":
          this.drawTriangle(this.startX, this.startY, currentX, currentY);
          break;
        case "diamond":
          this.drawDiamond(this.startX, this.startY, currentX, currentY);
          break;
        case "star":
          this.drawStar(this.startX, this.startY, currentX, currentY);
          break;
      }
      this.ctx.stroke();
    }
  }

  undo() {
    if (this.history.length > 1) {
      this.redoStack.push(this.history.pop());
      const lastState = this.history[this.history.length - 1];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(lastState, 0, 0);
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      const state = this.redoStack.pop();
      this.history.push(state);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(state, 0, 0);
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.saveState();
  }

  drawLine(startX, startY, endX, endY) {
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
  }

  drawRectangle(startX, startY, endX, endY) {
    const width = endX - startX;
    const height = endY - startY;
    this.ctx.rect(startX, startY, width, height);
  }

  drawCircle(startX, startY, endX, endY) {
    const rad = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    this.ctx.arc(startX, startY, rad, 0, Math.PI * 2);
  }

  drawTriangle(startX, startY, endX, endY) {
    this.ctx.moveTo(startX + (endX - startX) / 2, startY);
    this.ctx.lineTo(startX, endY);
    this.ctx.lineTo(endX, endY);
    this.ctx.closePath();
  }

  drawDiamond(startX, startY, endX, endY) {
    const centerX = (startX + endX) / 2;
    const centerY = (startY + endY) / 2;

    this.ctx.moveTo(centerX, startY);
    this.ctx.lineTo(endX, centerY);
    this.ctx.lineTo(centerX, endY);
    this.ctx.lineTo(startX, centerY);
    this.ctx.closePath();
  }

  drawStar(startX, startY, endX, endY) {
    const centerX = (startX + endX) / 2;
    const centerY = (startY + endY) / 2;
    const rad = Math.min(Math.abs(endX - startX), Math.abs(endY - startY)) / 2;
    const points = 5;
    const outerRad = rad;
    const innerRad = rad / 2;

    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / points;

    this.ctx.moveTo(centerX, centerY - rad);

    for (let i = 0; i < points; i++) {
      const x1 = centerX + Math.cos(rot) * outerRad;
      const y1 = centerY + Math.sin(rot) * outerRad;

      this.ctx.lineTo(x1, y1);
      rot += step;

      const x2 = centerX + Math.cos(rot) * innerRad;
      const y2 = centerY + Math.sin(rot) * innerRad;

      this.ctx.lineTo(x2, y2);
      rot += step;
    }

    this.ctx.closePath();
  }

  downloadCanvas() {
    const fileName = prompt("Enter a name for your drawing:", "drawing");
    if (!fileName) return;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;

    tempCtx.fillStyle = this.backgroundColor;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.drawImage(this.canvas, 0, 0);

    const link = document.createElement("a");
    link.href = tempCanvas.toDataURL("image/png");
    link.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`; // Ensure .png extension
    link.click();
  }
}

//prevent zooming
document.addEventListener("keydown", function (e) {
  if (
    e.ctrlKey &&
    (e.keyCode == "61" ||
      e.keyCode == "107" ||
      e.keyCode == "173" ||
      e.keyCode == "109" ||
      e.keyCode == "187" ||
      e.keyCode == "189")
  ) {
    e.preventDefault();
  }
});
document.addEventListener(
  "wheel",
  function (e) {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  },
  {
    passive: false,
  }
);

new DrawingBoard();
