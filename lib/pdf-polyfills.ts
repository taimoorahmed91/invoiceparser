// Polyfills for pdfjs-dist in Node.js/serverless environment

// DOMMatrix polyfill
class DOMMatrixPolyfill {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;

  constructor(init?: string | number[]) {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
  }

  translate(tx: number, ty: number) {
    return this;
  }

  scale(scaleX: number, scaleY?: number) {
    return this;
  }

  rotate(angle: number) {
    return this;
  }

  inverse() {
    return this;
  }
}

// Path2D polyfill
class Path2DPolyfill {
  constructor(path?: Path2DPolyfill | string) {}

  addPath(path: Path2DPolyfill, transform?: DOMMatrixPolyfill) {}
  closePath() {}
  moveTo(x: number, y: number) {}
  lineTo(x: number, y: number) {}
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {}
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {}
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean) {}
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {}
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean) {}
  rect(x: number, y: number, w: number, h: number) {}
}

// ImageData polyfill
class ImageDataPolyfill {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(width: number, height: number);
  constructor(data: Uint8ClampedArray, width: number, height?: number);
  constructor(dataOrWidth: Uint8ClampedArray | number, width: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = width;
      this.data = new Uint8ClampedArray(dataOrWidth * width * 4);
    } else {
      this.data = dataOrWidth;
      this.width = width;
      this.height = height || Math.floor(dataOrWidth.length / (width * 4));
    }
  }
}

// Apply polyfills to globalThis
if (typeof globalThis !== 'undefined') {
  // @ts-ignore
  if (!globalThis.DOMMatrix) {
    // @ts-ignore
    globalThis.DOMMatrix = DOMMatrixPolyfill;
  }

  // @ts-ignore
  if (!globalThis.Path2D) {
    // @ts-ignore
    globalThis.Path2D = Path2DPolyfill;
  }

  // @ts-ignore
  if (!globalThis.ImageData) {
    // @ts-ignore
    globalThis.ImageData = ImageDataPolyfill;
  }
}

// Also set on global for compatibility
if (typeof global !== 'undefined') {
  // @ts-ignore
  if (!global.DOMMatrix) {
    // @ts-ignore
    global.DOMMatrix = DOMMatrixPolyfill;
  }

  // @ts-ignore
  if (!global.Path2D) {
    // @ts-ignore
    global.Path2D = Path2DPolyfill;
  }

  // @ts-ignore
  if (!global.ImageData) {
    // @ts-ignore
    global.ImageData = ImageDataPolyfill;
  }
}
