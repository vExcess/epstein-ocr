const fs = require("fs");
const { createCanvas, loadImage } = require('canvas');

const charSet = "abcdefghijklmnopqrstuvwyxzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=?"; 

const savePath = 'file://./epstein-ocr-model';

// 2. Initialize Canvas
let canvas = null;
let ctx = null;

function getCanvas() {
    return canvas;
}

function getCtx() {
    return ctx;
}

function getPNGImageIPath(docName, idx) {
    let imagePath = null;
    // for (var paddingWidth = 1; paddingWidth <= 5; paddingWidth++) {
        var paddingWidth = 3;
        let idxString = idx.toString().padStart(paddingWidth, "0");
        let path = `./files/${docName}/png/${docName}-${idxString}.png`;
        if (fs.existsSync(path)) {
            imagePath = path;
        }
    // }
    return imagePath;
}

async function drawImageI(docName, idx) {
    // 1. Load from local file
    const image = await loadImage(getPNGImageIPath(docName, idx));
    canvas = createCanvas(image.width, image.height);
    ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
}

module.exports = {
    getCanvas,
    getCtx,
    charSet,
    savePath,
    drawImageI
};