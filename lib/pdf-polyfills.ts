// Polyfills for pdfjs-dist in Node.js/serverless environment
if (typeof global !== 'undefined') {
  // @ts-ignore
  if (!global.DOMMatrix) {
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix {
      constructor() {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
      }
    };
  }

  // @ts-ignore
  if (!global.Path2D) {
    // @ts-ignore
    global.Path2D = class Path2D {};
  }
}
