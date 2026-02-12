let RIGHT_SHIFT = 0;

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

/**
 * Doubles the size of an ImageData object using Nearest Neighbor scaling.
 * @param {ImageData} sourceData - The original ImageData object.
 * @returns {ImageData} - A new ImageData object at 2x scale.
 */
function doubleImageData(sourceData) {
    const sw = sourceData.width;
    const sh = sourceData.height;
    
    // New dimensions: width * 2 and height * 2
    const dw = sw * 2;
    const dh = sh * 2;
    
    // Create a new buffer for the target
    const targetData = new Uint8ClampedArray(dw * dh * 4);
    
    // Use 32-bit views to manipulate 4 bytes (RGBA) at once
    const sourceBuf = new Uint32Array(sourceData.data.buffer);
    const targetBuf = new Uint32Array(targetData.buffer);

    for (let y = 0; y < sh; y++) {
        const sourceRowOffset = y * sw;
        const targetRowOffset = (y * 2) * dw;
        const targetNextRowOffset = (y * 2 + 1) * dw;

        for (let x = 0; x < sw; x++) {
            // Get the 32-bit pixel value from the source
            const pixel = sourceBuf[sourceRowOffset + x];

            // Calculate the 2x2 block start in the target
            const targetX = x * 2;

            // Fill the 2x2 block in the destination
            // Top-left and Top-right
            targetBuf[targetRowOffset + targetX] = pixel;
            targetBuf[targetRowOffset + targetX + 1] = pixel;
            
            // Bottom-left and Bottom-right
            targetBuf[targetNextRowOffset + targetX] = pixel;
            targetBuf[targetNextRowOffset + targetX + 1] = pixel;
        }
    }

    return {
        data: targetData,
        width: dw,
        height: dh
    };
}

/**
 * Extracts a rectangular section from a cached ImageData object.
 * * @param {ImageData} sourceData - The cached ImageData of the full canvas.
 * @param {number} x - The starting X coordinate of the section.
 * @param {number} y - The starting Y coordinate of the section.
 * @param {number} width - The width of the section to extract.
 * @param {number} height - The height of the section to extract.
 * @returns {ImageData} - A new ImageData object containing the section.
 */
function getSubImageData(sourceData, x, y, width, height) {
    const sourceWidth = sourceData.width;
    const sourcePixels = sourceData.data;
    
    // Create a new buffer for the sub-section
    const targetData = new Uint8ClampedArray(width * height * 4);
    
    for (let row = 0; row < height; row++) {
        // Calculate the starting index of the row in the source and target
        const sourceStart = ((y + row) * sourceWidth + x) << 2;
        const targetStart = (row * width) << 2;
        const rowLength = width << 2;
        
        // Use .subarray and .set for a high-performance memory copy
        const rowPixels = sourcePixels.subarray(sourceStart, sourceStart + rowLength);
        targetData.set(rowPixels, targetStart);
    }
    
    return {
        data: targetData,
        width: width,
        height: height
    };
}

function scan(imageData, start, limit1, limit2, scanAxis, dir, scanForWhite, cutoff) {
    let isRowWhite = !scanForWhite;
    while (scanForWhite ? !isRowWhite : isRowWhite) {
        if (scanAxis === "x") {
            if (
                (dir === 1 && start >= imageData.width) ||
                (dir === -1 && start < 0)
            ) {
                break;
            }
        } else /* if (scanAxis === "y") */ {
            if (
                (dir === 1 && start >= imageData.height) ||
                (dir === -1 && start < 0)
            ) {
                break;
            }
        }

        if (scanForWhite) {
            isRowWhite = true;
        }

        for (let i = limit1; i < limit2; i++) {
            let idx;
            if (scanAxis === "x") {
                idx = (start + i * imageData.width) << 2;
            } else /* if (scanAxis === "y") */ {
                idx = (i + start * imageData.width) << 2;
            }
            const r = imageData.data[idx];
            const g = imageData.data[idx+1];
            const b = imageData.data[idx+2];
            if (r < cutoff || g < cutoff || b < cutoff) {
                isRowWhite = false;
                break;
            }
        }
        
        if (scanForWhite ? !isRowWhite : isRowWhite) {
            start += dir;   
        }
    }

    return start;
}

function isBlank(bitmap) {
    for (let i = 0; i < bitmap.length; i++) {
        if (bitmap[i] < 255) {
            return false;
        }
    }
    return true;
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
    let imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

    let scaleFactor = canvasHeight / 3375;

    // estimate left of caret
    let caretXEstimate = scan(imageData, 0, 0, canvasHeight, "x", 1, false, 254) - 1;
    let caretWidthEstimate = Math.round(24 * scaleFactor) - 1;
    let caretWidth = undefined;

    let caretBottomY = scan(imageData, canvasHeight - 1, caretXEstimate, caretXEstimate + caretWidthEstimate, "y", -1, false, 254);
    let caretY = scan(imageData, caretBottomY, caretXEstimate, caretXEstimate + caretWidthEstimate, "y", -1, true, 254);
    let caretHeight = caretBottomY - caretY;

    let carets = [];
    for (let i = 0; i < 65; i++) {
        if (caretY > 0) {
            let caret = {
                x: 0,
                y: caretY,
                halfHeight: caretHeight / 2
            };

            caret.x = scan(imageData, caretXEstimate, caret.y, caret.y + caretHeight, "x", 1, false, 254) - 1;

            if (caretWidth === undefined) {
                caretWidth = scan(imageData, caret.x + 1, caret.y, caret.y + caretHeight, "x", 1, true, 254) - caret.x - 1;
            }

            carets.push(caret);
            caretY = scan(imageData, caretY, caretXEstimate, caretXEstimate + caretWidth, "y", -1, false, 254) - caretHeight;
        }
    }

    carets = carets.reverse();

    const nonCaretBottomSearchStartX = carets[0].x + caretWidth + 3;
    const nonCaretBottomSearchStopX = carets[0].x + caretWidth * 2 - 1;
    let nonCaretBottom = scan(imageData, carets[carets.length-1].y, nonCaretBottomSearchStartX, nonCaretBottomSearchStopX, "y", -1, false, 254) + 1;
    while (carets.length >= 1 && carets[0].y < nonCaretBottom) {
        carets = carets.slice(1);
    }
    
    for (let i = 0; i < carets.length; i++) {
        const caret = carets[i];
        if (typeof line === "function") {
            line(caret.x, caret.y, caret.x + caretWidth, caret.y);
            line(caret.x, caret.y, caret.x, caret.y + caretHeight);
            line(caret.x, caret.y + Math.round(caret.halfHeight), caret.x + caretWidth, caret.y + Math.round(caret.halfHeight));
        }
    }

    let avgCaretDist = 0;
    for (let i = 0; i < carets.length - 1; i++) {
        const caret = carets[i];
        avgCaretDist += carets[i+1].y - carets[i].y;
    }
    const lineHeight = avgCaretDist / (carets.length - 1);

    let base64LeftEstimate = scan(imageData, carets[0].x + caretWidth + 2, nonCaretBottom, canvasHeight, "x", 1, false, 254);
    let base64RightEstimate = scan(imageData, canvasWidth - 1, 0, canvasHeight, "x", -1, false, 254);
    let base64Top = scan(imageData, carets[0].y, base64LeftEstimate, base64RightEstimate, "y", -1, true, 254);
    let base64Bottom = scan(imageData, carets[carets.length-1].y, base64LeftEstimate, base64RightEstimate, "y", 1, true, 254);
    let base64Left = scan(imageData, carets[0].x + caretWidth + 1, base64Top, base64Bottom, "x", 1, false, 230);
    let base64Right = scan(imageData, canvasWidth - 1, base64Top, base64Bottom, "x", -1, false, 240);
    
    const chWidth = (base64Right - base64Left + 1) / 76;

    if (typeof line === "function") {
        line(nonCaretBottomSearchStartX, nonCaretBottom, nonCaretBottomSearchStopX, nonCaretBottom);
        
        line(0, base64Top, canvasWidth, base64Top);        
        line(0, base64Bottom, canvasWidth, base64Bottom);
        line(base64Left, 0, base64Left, canvasHeight);
        line(base64Right, 0, base64Right, canvasHeight);
    }

    let linePadding = 4 * scaleFactor;
    let chHeight = Math.ceil(lineHeight - linePadding);

    let rows = [];
    for (let i = 0; i < carets.length; i++) {
        const caret = carets[i];
        let row = [];

        let y = caret.y - Math.round(6 * scaleFactor);
        let x = base64Left;
        for (let j = 0; j < 76; j++) {
            let xPos = Math.round(x);
            let yPos = Math.round(y);

            let chImgData = getSubImageData(imageData, xPos, yPos, Math.ceil(chWidth), chHeight);
            // chImgData = doubleImageData(chImgData);
            // chImgData = downscaleHalf(chImgData);
            let colorData = chImgData.data;
            let bitmap = new Array(colorData.length / 4);
            for (let k = 0; k < colorData.length; k += 4) {
                bitmap[k / 4] = colorData[k] >> RIGHT_SHIFT;
            }

            if (!isBlank(bitmap)){
                const chImageData = {
                    width: chImgData.width,
                    height: chImgData.height,
                    bitmap: bitmap,
                    imageData: chImgData
                };
                row.push(chImageData);

                if (typeof line === "function") {
                    line(xPos, y, xPos, y + chHeight);
                    line(xPos, y, xPos + Math.ceil(chWidth), y);
                    line(xPos, y + chHeight, xPos + Math.ceil(chWidth), y + chHeight);
                }
            }

            x += chWidth;
        }

        rows.push(row);
    }

    return rows;
}

if (typeof module !== "undefined") {
    module.exports = {
        process,
        RIGHT_SHIFT
    };
}