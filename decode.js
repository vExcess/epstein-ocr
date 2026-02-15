// 1. THIS IS THE CRITICAL LINE: Polyfill the missing Node internal before TF loads
const util = require('util');
if (!util.isNullOrUndefined) {
    util.isNullOrUndefined = (obj) => obj === null || obj === undefined;
}
// remove deprecation warnings
process.removeAllListeners('warning');

const fs = require("fs");
const tf = require('@tensorflow/tfjs-node');

const imageProcessor = require("./processImage.js");
const TRAINING_DATA = require("./training-data.js");

let docName = process.argv[2];

const { charSet, savePath, drawImageI, getCtx, getCanvas } = require("./utils.js");

async function loadOCR() {
    // 3. Build the CNN
    let model;
    let usingExistingModel = false;
    try {
        console.log('Loading existing model...');
        model = await tf.loadLayersModel(savePath + "/model.json");
        usingExistingModel = true;
    } catch (err) {
        console.log('No existing model found. Make sure to run train.js before extract-base64.js');
    }

    return model;
}

async function main() {
    const model = await loadOCR();

    const inputShape = model.layers[0].batchInputShape;
    const modelInputWidth = inputShape[2];
    const modelInputHeight = inputShape[1];
        
    function predict(flatBitmap, width, height) {
        const input = tf.tensor4d(flatBitmap, [1, height, width, 1]).div(255 >> imageProcessor.RIGHT_SHIFT);
        const prediction = model.predict(input);
        const index = prediction.argMax(1).dataSync()[0];

        // free tensor memory
        input.dispose();
        prediction.dispose();

        return charSet[index];
    }

    console.log("OCRing all the files!");

    // predict the rest
    // skip the first file because it contains non base64 data - handle image 1 manually
    const numImages = fs.readdirSync(`./files/${docName}/png`).length;
    let out = "";
    let count = 0;
    for (let i = 0; i < numImages; i++) {
        console.log("Processing image " + i + "...");

        await drawImageI(docName, i);
        const rows = imageProcessor.process(getCtx(), getCanvas().width, getCanvas().height);

        let skipRowFirst = -1;
        let skipRowLast = -1;
        for (let j = 0; j < rows.length; j++) {
            const charDatas = rows[j];

            const validBitmaps = charDatas
                .filter(c => c.width === modelInputWidth && c.height === modelInputHeight)
                .map(c => c.bitmap);

            if (validBitmaps.length === 0) {
                if (skipRowFirst === -1) {
                    skipRowFirst = j;
                }
                skipRowLast = j;
                continue;
            }

            if (skipRowFirst !== -1) {
                console.log(`skipping page ${i} rows ${skipRowFirst}-${skipRowLast}`);
                skipRowFirst = -1;
            }

            // 3. Stack all bitmaps into one 4D tensor: [batchSize, height, width, 1]
            const input = tf.tensor4d(
                validBitmaps.flat(), 
                [validBitmaps.length, modelInputHeight, modelInputWidth, 1]
            ).div(255 >> imageProcessor.RIGHT_SHIFT);

            // 4. Predict the entire batch at once
            const predictions = model.predict(input);
            const indices = predictions.argMax(1).dataSync();
            const probabilities = predictions.max(1).dataSync();

            // Convert indices to characters
            for (let k = 0; k < indices.length; k++) {
                const guess = charSet[indices[k]];
                const confidence = probabilities[k];
                out += guess;
                count++;
                if (confidence < 0.75) {
                    console.log(`${i}-${j}-${k} (${count}) ${guess} ${confidence}%`);
                }
            }

            input.dispose();
            predictions.dispose();
        }

        if (skipRowFirst !== -1) {
            console.log(`skipping page ${i} rows ${skipRowFirst}-${skipRowLast}`);
            skipRowFirst = -1;
        }
    }

    if (TRAINING_DATA[docName]?.start && TRAINING_DATA[docName]?.end) {
        const start = TRAINING_DATA[docName].start.join("");
        const end = TRAINING_DATA[docName].end.join("");

        // since '=' are only at the end of the file, they won't be in the training data
        // so I handle them manually
        let startIdx = out.indexOf(start);
        if (startIdx === -1) startIdx = 0;
        let endIdx = out.indexOf(end.replaceAll("=", ""));
        if (endIdx === -1) endIdx = out.length;
        out = out.slice(startIdx, endIdx) + end;
    }

    const outputPath = `./files/${docName}/output`;

    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
    }

    fs.writeFileSync(`${outputPath}/base64.txt`, out);
    fs.writeFileSync(`${outputPath}/output.pdf`, Buffer.from(out, "base64"));

    console.log("OCR complete!");
}

main();
