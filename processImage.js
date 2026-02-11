let rightShift = 0;

/**
 * Downscales ImageData by half.
 * @param {ImageData} imageData - The original image data.
 * @returns {ImageData} The new downscaled ImageData.
 */
function downscaleHalf(imageData) {
    const oldW = imageData.width;
    const oldH = imageData.height;
    
    // Handle odd dimensions by rounding down
    const newW = Math.floor(oldW / 2);
    const newH = Math.floor(oldH / 2);
    
    const oldData = imageData.data;
    const newData = new Uint8ClampedArray(newW * newH * 4);

    for (let y = 0; y < newH; y++) {
        for (let x = 0; x < newW; x++) {
            const newIndex = (y * newW + x) * 4;
            
            // Map back to the top-left pixel of the 2x2 block in the original
            const oldIndex = ((y * 2) * oldW + (x * 2)) * 4;

            // Average the 4 pixels (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
            // for each channel (R, G, B, A)
            for (let c = 0; c < 4; c++) {
                const p1 = oldData[oldIndex + c];
                const p2 = oldData[oldIndex + 4 + c];
                const p3 = oldData[oldIndex + (oldW * 4) + c];
                const p4 = oldData[oldIndex + (oldW * 4) + 4 + c];
                
                newData[newIndex + c] = (p1 + p2 + p3 + p4) / 4;
            }
        }
    }

    return {
        data: newData,
        width: newW,
        height: newH
    };
}

/*
    Processes the canvas context and returns an array
    of character data where the data for a character
    follows the format
    {
        width: Integer,
        height: Integer,
        data: Array<Integer>
    }
*/
function process(ctx, canvasWidth, canvasHeight) {
    let characterDatas = [];

    let imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

    // estimate left of caret
    let caretX = 0;
    let caretWidth = 24;
    {
        let isRowWhite = true;
        while (isRowWhite && caretX < canvasWidth) {
            for (let y = 0; y < canvasHeight; y++) {
                const idx = (caretX + y * imageData.width) << 2;
                const r = imageData.data[idx];
                const g = imageData.data[idx+1];
                const b = imageData.data[idx+2];
                if (r < 255 || g < 255 || b < 255) {
                    isRowWhite = false;
                    break;
                }
            }
            if (isRowWhite) {
                caretX++;   
            }
        }

        caretX--;
    }

    let caretY = canvasHeight - 1;
    let caretHeight = 0;
    {
        let isRowWhite = true;
        // find bottom of caret
        while (isRowWhite && caretY >= 0) {
            for (let x = caretX; x < caretX + caretWidth; x++) {
                let idx = (x + caretY * imageData.width) << 2;
                let r = imageData.data[idx];
                let g = imageData.data[idx+1];
                let b = imageData.data[idx+2];
                if (r < 255 || g < 255 || b < 255) {
                    isRowWhite = false;
                    break;
                }
            }
            if (isRowWhite) {
                caretY--;   
            }
        }

        // find top of caret
        while (!isRowWhite && caretY >= 0) {
            // start and stop of the caret
            isRowWhite = true;
            for (let x = caretX; x < caretX + caretWidth; x++) {
                let idx = (x + caretY * imageData.width) << 2;
                let r = imageData.data[idx];
                let g = imageData.data[idx+1];
                let b = imageData.data[idx+2];
                if (r < 255 || g < 255 || b < 255) {
                    isRowWhite = false;
                    break;
                }
            }
            if (!isRowWhite) {
                caretY--;
                caretHeight++;
            }
        }
    }

    let carets = [];
    const yHeight = 46.9;
    for (let i = 0; i < 65; i++) {
        if (Math.round(caretY) > 0) {
            let caret = {
                x: caretX,
                y: Math.round(caretY),
                halfHeight: caretHeight / 2
            };

            {
                // find exact left of caret
                let isRowWhite = true;
                while (isRowWhite && caret.x < canvasWidth) {
                    for (let y = caret.y; y < caret.y + caretHeight; y++) {
                        const idx = (caret.x + y * imageData.width) << 2;
                        const r = imageData.data[idx];
                        const g = imageData.data[idx+1];
                        const b = imageData.data[idx+2];
                        if (r < 255 || g < 255 || b < 255) {
                            isRowWhite = false;
                            break;
                        }
                    }
                    if (isRowWhite) {
                        caret.x++;   
                    }
                }

                caret.x--;
            }

            {
                // find exact top of caret
                let isRowWhite = true;
                while (isRowWhite && caret.y < canvasHeight) {
                    // start and stop of the caret
                    for (var x = caret.x; x < caret.x + caretWidth; x++) {
                        var idx = (x + caret.y * imageData.width) << 2;
                        var r = imageData.data[idx];
                        var g = imageData.data[idx+1];
                        var b = imageData.data[idx+2];
                        if (r < 255 || g < 255 || b < 255) {
                            isRowWhite = false;
                            break;
                        }
                    }
                    if (isRowWhite) {
                        caret.y++;   
                    }
                }

                caret.y--;
            }

            carets.push(caret);
            caretY -= yHeight;
        }
    }

    for (let i = 0; i < carets.length; i++) {
        const caret = carets[i];
        if (typeof line === "function") {
            line(caret.x, caret.y, caret.x + caretWidth, caret.y);
            line(caret.x, caret.y, caret.x, caret.y + caretHeight);
            line(caret.x, caret.y + caret.halfHeight, caret.x + caretWidth, caret.y + caret.halfHeight);
        }
    }

    carets = carets.reverse();

    let yPad = 4;
    let chWidth = 24.38;
    let chHeight = Math.ceil(yHeight) - yPad;

    for (let i = 0; i < carets.length; i++) {
        const caret = carets[i];

        let y = caret.y - 6;
        let x = caret.x + 52;
        for (let j = 0; j < 76; j++) {
            let xPos = Math.round(x);
            let yPos = Math.round(y);
            
            if (typeof line === "function") {
                line(x, y, x, y + chHeight);
                line(x, y, x + Math.ceil(chWidth), y);
                line(x, y + chHeight, x + Math.ceil(chWidth), y + chHeight);
            }

            let chImgData = ctx.getImageData(xPos, yPos, Math.ceil(chWidth), chHeight);
            // chImgData = downscaleHalf(chImgData);
            let colorData = chImgData.data;
            let black = new Array(colorData.length / 4);
            for (let k = 0; k < colorData.length; k += 4) {
                black[k / 4] = colorData[k] >> rightShift;
            }
            characterDatas.push({
                width: chImgData.width,
                height: chImgData.height,
                data: black
            });

            x += chWidth;
        }
    }

    return characterDatas;
}

if (typeof module !== "undefined") {
    module.exports = {
        process,
        rightShift
    };
}