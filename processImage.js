let characterBitmaps = [];

var rightShift = 0;

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

function charDatas() {
    return characterBitmaps;
}

function process(ctx, canvasWidth, canvasHeight) {
    characterBitmaps = [];

    var imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

    var xOff = 189;
    var xWidth = 24.38;

    var yOff = 122 - 5;
    var yHeight = 46.9;

    var yPad = 4;

    var yPositions = [];
    var y = yOff;
    for (var i = 0; i < 65; i++) {
        yPositions.push(Math.round(y));
        y += yHeight;
    }

    // window.diffs = [];
    for (var i = 0; i < yPositions.length; i++) {
        var y = yPositions[i];

        var isRowWhite = true;
        while (isRowWhite) {
            // start and stop of the caret
            for (var x = 130; x < 170; x++) {
                var idx = (x + y * imageData.width) << 2;
                var r = imageData.data[idx];
                var g = imageData.data[idx+1];
                var b = imageData.data[idx+2];
                if (r !== 255 || g !== 255 || b !== 255) {
                    isRowWhite = false;
                    break;
                }
            }
            if (isRowWhite) {
                y++;   
            }
        }

        if (typeof line === "function") {
            line(130, y, 170, y);
        }

        // subtract fixed amount from top of caret
        y -= 7;

        // diffs.push(y - yPositions[i]);
        yPositions[i] = y;
    }

    var chWidth = Math.ceil(xWidth);
    var chHeight = Math.ceil(yHeight) - yPad;

    for (var i = 0; i < yPositions.length; i++) {
        var y = yPositions[i];
        var x = xOff;
        for (var j = 0; j < 76; j++) {
            var xPos = Math.round(x);
            var yPos = Math.round(y);
            
            if (typeof line === "function") {
                line(x, y, x, y + chHeight);
                line(x, y, x + chWidth, y);
                line(x, y + chHeight, x + chWidth, y + chHeight);
            }

            var chImgData = ctx.getImageData(xPos, yPos, chWidth, chHeight);
            // chImgData = downscaleHalf(chImgData);
            var colorData = chImgData.data;
            var black = new Array(colorData.length / 4);
            for (var k = 0; k < colorData.length; k += 4) {
                black[k / 4] = colorData[k] >> rightShift;
            }
            characterBitmaps.push({
                width: chImgData.width,
                height: chImgData.height,
                data: black
            });

            x += xWidth;
        }
    }
}

if (typeof module !== "undefined") {
    module.exports = {
        charDatas,
        process,
        rightShift
    };
}