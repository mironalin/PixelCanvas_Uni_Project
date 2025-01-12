class LandingPage {
  constructor(onStart) {
    this.landing = document.getElementById("landing");
    this.startButton = this.landing.querySelector(".start-drawing");
    this.zoomControls = document.getElementById("zoom-controls");

    this.startButton.addEventListener("click", () => {
      this.landing.classList.add("hidden");
      this.zoomControls.classList.add("visible");
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
    this.isDarkMode = false;

    this.recentColors = JSON.parse(localStorage.getItem("recentColors")) || [
      "#000000",
      "#ffffff",
      "#ff0000",
      "#00ff00",
      "#0000ff",
    ];

    this.elements = [];
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;
    this.paths = [];
    this.currentPath = null;
    this.tempShape = null;

    this.draggableImages = [];
    this.isDragging = false;
    this.isResizing = false;
    this.selectedImage = null;
    this.editMode = false;

    this.zoom = 1;
    this.isPanning = false;
    this.lastX = 0;
    this.lastY = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    this.createDropzoneOverlay();

    this.landing = new LandingPage(() => {
      this.initializeCanvas();
      this.setupEventListeners();
      this.initializeColorPicker();
      this.initializeBrushSizeControl();
      this.setupDragAndDrop();
      this.saveState();
    });
  }

  createDropzoneOverlay() {
    this.dropzoneOverlay = document.createElement("div");
    this.dropzoneOverlay.className = "dropzone-overlay";
    this.dropzoneOverlay.innerHTML = `
      <div class="dropzone-message">
        <span>🖼️ Drop images here</span>
      </div>
    `;
    document.body.appendChild(this.dropzoneOverlay);
  }

  updateZoomIndicator() {
    const zoomLevel = document.getElementById("zoom-level");
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  initializeCanvas() {
    this.resizeCanvas();
    this.updateZoomIndicator();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupEventListeners() {
    window.addEventListener("resize", () => this.resizeCanvas());
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mouseout", this.handleMouseLeave.bind(this));
    this.canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));
    this.canvas.addEventListener("wheel", this.handleWheel.bind(this));
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("keyup", this.handleKeyUp.bind(this));

    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", () => this.handleButtonClick(btn));
    });
  }

  handleMouseDown(event) {
    if (this.isPanning) {
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (this.editMode) {
      this.handleEditModeMouseDown(event);
      return;
    }
    this.startDrawing(event);
  }

  handleMouseMove(event) {
    if (this.isPanning && this.lastX && this.lastY) {
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.redraw();
      return;
    }

    if (this.editMode) {
      this.handleEditModeMouseMove(event);
      return;
    }
    this.draw(event);
  }

  handleMouseUp() {
    if (this.isPanning) {
      this.canvas.style.cursor = "grab";
      return;
    }

    if (this.editMode) {
      if (this.isDragging || this.isResizing) {
        this.isDragging = false;
        this.isResizing = false;
        this.canvas.style.cursor = "default";
        this.saveState();
      }
      return;
    }
    this.stopDrawing();
  }

  handleMouseLeave() {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
    }

    if (this.isDragging || this.isResizing) {
      this.isDragging = false;
      this.isResizing = false;
      this.canvas.style.cursor = "default";
      this.saveState();
    } else if (this.isDrawing) {
      this.handleMouseUp();
    }
  }

  handleEditModeMouseDown(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.offsetX) / this.zoom;
    const y = (event.clientY - rect.top - this.offsetY) / this.zoom;

    if (this.selectedImage) {
      if (this.checkResizeHandles(x, y)) {
        return;
      }
      if (this.checkImageBounds(x, y)) {
        return;
      }
    }
  }

  handleEditModeMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.offsetX) / this.zoom;
    const y = (event.clientY - rect.top - this.offsetY) / this.zoom;

    if (this.isDragging && this.selectedImage) {
      this.selectedImage.x = x - this.dragStartX;
      this.selectedImage.y = y - this.dragStartY;
      this.redraw();
    } else if (this.isResizing && this.selectedImage) {
      this.handleResize(event);
    }
  }

  handleDoubleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.offsetX) / this.zoom;
    const y = (event.clientY - rect.top - this.offsetY) / this.zoom;

    for (let i = this.draggableImages.length - 1; i >= 0; i--) {
      const img = this.draggableImages[i];
      if (x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height) {
        this.editMode = true;
        this.selectedImage = img;
        this.draggableImages.forEach((image) => (image.selected = false));
        img.selected = true;
        this.redraw();
        return;
      }
    }

    this.editMode = false;
    this.draggableImages.forEach((img) => (img.selected = false));
    this.selectedImage = null;
    this.redraw();
  }

  handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const pointX = (mouseX - this.offsetX) / this.zoom;
    const pointY = (mouseY - this.offsetY) / this.zoom;

    this.zoom *= delta;
    this.zoom = Math.min(Math.max(0.1, this.zoom), 10);

    this.offsetX = mouseX - pointX * this.zoom;
    this.offsetY = mouseY - pointY * this.zoom;

    this.updateZoomIndicator();
    this.redraw();
  }

  handleKeyDown(event) {
    if ((event.key === "Delete" || event.key === "Backspace") && this.selectedImage) {
      const index = this.draggableImages.indexOf(this.selectedImage);
      if (index > -1) {
        this.draggableImages.splice(index, 1);
        this.elements = this.elements.filter((el) => el !== this.selectedImage);
        this.selectedImage = null;
        this.editMode = false;
        this.redraw();
        this.saveState();
      }
    } else if (event.key === "Escape" && this.editMode) {
      this.editMode = false;
      this.selectedImage = null;
      this.redraw();
    }

    if (event.code === "ControlLeft") {
      this.canvas.style.cursor = "grab";
      if (!this.isPanning) {
        this.isPanning = true;
        this.lastX = 0;
        this.lastY = 0;
      }
    }
  }

  handleKeyUp(e) {
    if (e.code === "ControlLeft") {
      this.canvas.style.cursor = "default";
      this.isPanning = false;
    }
  }

  startDrawing(event) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.offsetX) / this.zoom;
    const y = (event.clientY - rect.top - this.offsetY) / this.zoom;

    this.startX = x;
    this.startY = y;

    if (this.currentTool === "pencil") {
      this.currentPath = {
        type: "path",
        tool: "pencil",
        color: this.color,
        brushSize: this.brushSize,
        points: [{ x, y }],
        timestamp: Date.now(),
      };
      this.paths.push(this.currentPath);
      this.elements.push(this.currentPath);
    } else {
      this.tempShape = {
        type: "shape",
        tool: this.currentTool,
        color: this.color,
        brushSize: this.brushSize,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        timestamp: Date.now(),
      };
    }
  }

  stopDrawing() {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    if (this.tempShape) {
      this.paths.push(this.tempShape);
      this.elements.push(this.tempShape);
      this.tempShape = null;
      this.saveState();
    } else if (this.currentPath && this.currentPath.points.length > 1) {
      this.saveState();
    }

    this.currentPath = null;
  }

  drawShape(shape) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = shape.color;
    this.ctx.lineWidth = shape.brushSize;

    switch (shape.tool) {
      case "line":
        this.ctx.moveTo(shape.startX, shape.startY);
        this.ctx.lineTo(shape.endX, shape.endY);
        break;
      case "rectangle":
        const width = shape.endX - shape.startX;
        const height = shape.endY - shape.startY;
        this.ctx.strokeRect(shape.startX, shape.startY, width, height);
        break;
      case "circle":
        const centerX = (shape.startX + shape.endX) / 2;
        const centerY = (shape.startY + shape.endY) / 2;
        const radius = Math.sqrt(Math.pow(shape.endX - shape.startX, 2) + Math.pow(shape.endY - shape.startY, 2)) / 2;
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        break;
      case "triangle":
        this.ctx.moveTo(shape.startX, shape.endY);
        this.ctx.lineTo((shape.startX + shape.endX) / 2, shape.startY);
        this.ctx.lineTo(shape.endX, shape.endY);
        this.ctx.closePath();
        break;
      case "diamond":
        const midX = (shape.startX + shape.endX) / 2;
        const midY = (shape.startY + shape.endY) / 2;
        this.ctx.moveTo(midX, shape.startY);
        this.ctx.lineTo(shape.endX, midY);
        this.ctx.lineTo(midX, shape.endY);
        this.ctx.lineTo(shape.startX, midY);
        this.ctx.closePath();
        break;
      case "star":
        const outerRadius = Math.min(Math.abs(shape.endX - shape.startX), Math.abs(shape.endY - shape.startY)) / 2;
        const innerRadius = outerRadius * 0.4;
        const cx = (shape.startX + shape.endX) / 2;
        const cy = (shape.startY + shape.endY) / 2;
        const spikes = 5;
        const rot = Math.PI / 2;

        for (let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / spikes - rot;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;

          if (i === 0) {
            this.ctx.moveTo(x, y);
          } else {
            this.ctx.lineTo(x, y);
          }
        }
        this.ctx.closePath();
        break;
    }

    this.ctx.stroke();
  }

  draw(event) {
    if (!this.isDrawing) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.offsetX) / this.zoom;
    const y = (event.clientY - rect.top - this.offsetY) / this.zoom;

    if (this.currentTool === "pencil") {
      this.currentPath.points.push({ x, y });
      this.redraw();
    } else if (this.tempShape) {
      this.tempShape.endX = x;
      this.tempShape.endY = y;
      this.redraw();
    }
  }

  redraw() {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // apply zoom and pan transformations
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.zoom, this.zoom);

    // timestamp for keeping track of the order of elements
    const sortedElements = [...this.elements].sort((a, b) => a.timestamp - b.timestamp);

    // draw elements in order
    sortedElements.forEach((element) => {
      if (element.type === "image") {
        this.ctx.drawImage(element.element, element.x, element.y, element.width, element.height);
        if (element.selected && this.editMode) {
          this.drawSelectionBox(element);
        }
      } else if (element.type === "path" && element.points.length >= 2) {
        this.ctx.beginPath();
        this.ctx.moveTo(element.points[0].x, element.points[0].y);
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = element.brushSize;

        for (let i = 1; i < element.points.length; i++) {
          this.ctx.lineTo(element.points[i].x, element.points[i].y);
        }

        this.ctx.stroke();
      } else if (element.type === "shape") {
        this.drawShape(element);
      }
    });

    if (this.tempShape) {
      this.drawShape(this.tempShape);
    }

    this.ctx.restore();
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

    document.querySelector(".theme-toggle").addEventListener("click", () => {
      this.toggleTheme();
    });
  }

  updateButtonIcons() {
    const buttons = document.querySelectorAll(".btn img");
    buttons.forEach((img) => {
      const button = img.parentElement;
      if (this.isDarkMode) {
        img.classList.add("white-outline");
      } else {
        img.classList.toggle("white-outline", button.classList.contains("active"));
      }
    });
  }

  updateColorForTheme() {
    const targetColor = this.isDarkMode ? "#ffffff" : "#000000";
    if (this.color === (this.isDarkMode ? "#000000" : "#ffffff")) {
      this.updateFromHexInput(targetColor);
      this.addToRecentColors(targetColor);
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    document.body.setAttribute("data-theme", this.isDarkMode ? "dark" : "light");

    this.updateColorForTheme();
    this.updateCanvasBackground();
    this.updateButtonIcons();
  }

  updateCanvasBackground() {
    this.canvas.style.backgroundColor = this.isDarkMode ? "#121212" : "#ffffff";
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
      case "theme":
        return;
      default:
        this.currentTool = tool;
        document.querySelectorAll(".btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.tool === tool);
          if (btn.getElementsByTagName("img")[0]) {
            btn
              .getElementsByTagName("img")[0]
              .classList.toggle("white-outline", this.isDarkMode || btn.dataset.tool === tool);
          }
        });
    }
  }

  setupDragAndDrop() {
    const handleDragEnter = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.dropzoneOverlay.style.display = "flex";
    };

    const handleDragOver = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handleDragLeave = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.relatedTarget === null) {
        this.dropzoneOverlay.style.display = "none";
      }
    };

    const handleDrop = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.dropzoneOverlay.style.display = "none";

      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left - this.offsetX) / this.zoom;
            const y = (event.clientY - rect.top - this.offsetY) / this.zoom;

            const newImage = {
              type: "image",
              element: img,
              x: x - img.width / 2,
              y: y - img.height / 2,
              width: img.width,
              height: img.height,
              selected: false,
              timestamp: Date.now(),
            };

            this.draggableImages.push(newImage);
            this.elements.push(newImage);
            this.redraw();
            this.saveState();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);
  }

  drawSelectionBox(img) {
    this.ctx.strokeStyle = "#0095ff";
    this.ctx.lineWidth = 2 / this.zoom;
    this.ctx.strokeRect(img.x, img.y, img.width, img.height);

    const handleSize = 8 / this.zoom;
    const handles = this.getResizeHandles(img, handleSize);

    handles.forEach((handle) => {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
      this.ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    });
  }

  getResizeHandles(img, handleSize) {
    return [
      { x: img.x - handleSize / 2, y: img.y - handleSize / 2 }, // top-left
      { x: img.x + img.width / 2 - handleSize / 2, y: img.y - handleSize / 2 }, // top-middle
      { x: img.x + img.width - handleSize / 2, y: img.y - handleSize / 2 }, // top-right
      { x: img.x + img.width - handleSize / 2, y: img.y + img.height / 2 - handleSize / 2 }, // middle-right
      { x: img.x + img.width - handleSize / 2, y: img.y + img.height - handleSize / 2 }, // bottom-right
      { x: img.x + img.width / 2 - handleSize / 2, y: img.y + img.height - handleSize / 2 }, // bottom-middle
      { x: img.x - handleSize / 2, y: img.y + img.height - handleSize / 2 }, // bottom-left
      { x: img.x - handleSize / 2, y: img.y + img.height / 2 - handleSize / 2 }, // middle-left
    ];
  }

  checkResizeHandles(x, y) {
    if (!this.selectedImage) return false;

    const handleSize = 8 / this.zoom;
    const handles = this.getResizeHandles(this.selectedImage, handleSize);

    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      if (x >= handle.x && x <= handle.x + handleSize && y >= handle.y && y <= handle.y + handleSize) {
        this.isResizing = true;
        this.resizeHandle = i;
        this.resizeStartX = x;
        this.resizeStartY = y;
        this.originalWidth = this.selectedImage.width;
        this.originalHeight = this.selectedImage.height;
        this.originalX = this.selectedImage.x;
        this.originalY = this.selectedImage.y;
        this.aspectRatio = this.originalWidth / this.originalHeight;
        return true;
      }
    }
    return false;
  }

  checkImageBounds(x, y) {
    if (
      x >= this.selectedImage.x &&
      x <= this.selectedImage.x + this.selectedImage.width &&
      y >= this.selectedImage.y &&
      y <= this.selectedImage.y + this.selectedImage.height
    ) {
      this.isDragging = true;
      this.dragStartX = x - this.selectedImage.x;
      this.dragStartY = y - this.selectedImage.y;
      this.canvas.style.cursor = "move";
      return true;
    }
    return false;
  }

  handleResize(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.offsetX) / this.zoom;
    const y = (event.clientY - rect.top - this.offsetY) / this.zoom;

    const dx = x - this.resizeStartX;
    const dy = y - this.resizeStartY;

    switch (this.resizeHandle) {
      case 0: // top-left
        this.resizeTopLeft(dx, dy);
        break;
      case 1: // top-middle
        this.resizeTop(dy);
        break;
      case 2: // top-right
        this.resizeTopRight(dx, dy);
        break;
      case 3: // middle-right
        this.resizeRight(dx);
        break;
      case 4: // bottom-right
        this.resizeBottomRight(dx, dy);
        break;
      case 5: // bottom-middle
        this.resizeBottom(dy);
        break;
      case 6: // bottom-left
        this.resizeBottomLeft(dx, dy);
        break;
      case 7: // middle-left
        this.resizeLeft(dx);
        break;
    }

    this.redraw();
  }

  resizeTopLeft(dx, dy) {
    const newWidth = this.originalWidth - dx;
    const newHeight = newWidth / this.aspectRatio;
    if (newWidth > 20 && newHeight > 20) {
      this.selectedImage.width = newWidth;
      this.selectedImage.height = newHeight;
      this.selectedImage.x = this.originalX + dx;
      this.selectedImage.y = this.originalY + dy;
    }
  }

  resizeTop(dy) {
    const newHeight = this.originalHeight - dy;
    if (newHeight > 20) {
      this.selectedImage.height = newHeight;
      this.selectedImage.y = this.originalY + dy;
    }
  }

  resizeTopRight(dx, dy) {
    const newWidth = this.originalWidth + dx;
    const newHeight = newWidth / this.aspectRatio;
    if (newWidth > 20 && newHeight > 20) {
      this.selectedImage.width = newWidth;
      this.selectedImage.height = newHeight;
      this.selectedImage.y = this.originalY + dy;
    }
  }

  resizeRight(dx) {
    const newWidth = this.originalWidth + dx;
    if (newWidth > 20) {
      this.selectedImage.width = newWidth;
    }
  }

  resizeBottomRight(dx, dy) {
    const newWidth = this.originalWidth + dx;
    const newHeight = newWidth / this.aspectRatio;
    if (newWidth > 20 && newHeight > 20) {
      this.selectedImage.width = newWidth;
      this.selectedImage.height = newHeight;
    }
  }

  resizeBottom(dy) {
    const newHeight = this.originalHeight + dy;
    if (newHeight > 20) {
      this.selectedImage.height = newHeight;
    }
  }

  resizeBottomLeft(dx, dy) {
    const newWidth = this.originalWidth - dx;
    const newHeight = newWidth / this.aspectRatio;
    if (newWidth > 20 && newHeight > 20) {
      this.selectedImage.width = newWidth;
      this.selectedImage.height = newHeight;
      this.selectedImage.x = this.originalX + dx;
    }
  }

  resizeLeft(dx) {
    const newWidth = this.originalWidth - dx;
    if (newWidth > 20) {
      this.selectedImage.width = newWidth;
      this.selectedImage.x = this.originalX + dx;
    }
  }

  saveState() {
    const state = {
      paths: JSON.parse(JSON.stringify(this.paths)),
      elements: this.elements.map((el) => {
        if (el.type === "image") {
          return {
            ...el,
            element: el.element.src,
          };
        }
        return el;
      }),
    };

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(state);
    this.historyIndex++;

    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  restoreState() {
    const state = this.history[this.historyIndex];
    if (!state) return;

    this.paths = state.paths;
    this.elements = [];
    this.draggableImages = [];

    state.elements.forEach((el) => {
      if (el.type === "image") {
        const img = new Image();
        img.onload = () => {
          const restoredImage = {
            ...el,
            element: img,
          };
          this.draggableImages.push(restoredImage);
          this.elements.push(restoredImage);
          this.redraw();
        };
        img.src = el.element;
      } else {
        this.elements.push(el);
      }
    });

    this.redraw();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreState();
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreState();
    }
  }

  clearCanvas() {
    this.paths = [];
    this.draggableImages = [];
    this.elements = [];
    this.selectedImage = null;
    this.editMode = false;
    this.redraw();
    this.saveState();
  }

  downloadCanvas() {
    const fileName = prompt("Enter a name for your drawing:", "drawing");
    if (!fileName) return;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;

    if (this.isDarkMode) {
      tempCtx.fillStyle = "#121212";
    } else {
      tempCtx.fillStyle = "#ffffff";
    }

    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.drawImage(this.canvas, 0, 0);

    const link = document.createElement("a");
    link.href = tempCanvas.toDataURL("image/png");
    link.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`; // make .png extension as default
    link.click();
  }
}
new DrawingBoard();
