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

    this.initializeCanvas();
    this.setupEventListeners();
    this.saveState();
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
}

new DrawingBoard();
