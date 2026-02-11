// 1. THIS IS THE CRITICAL LINE: Polyfill the missing Node internal before TF loads
const util = require('util');
if (!util.isNullOrUndefined) {
    util.isNullOrUndefined = (obj) => obj === null || obj === undefined;
}

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
    
    function predict(flatBitmap, width, height) {
        const input = tf.tensor4d(flatBitmap, [1, height, width, 1]).div(255 >> imageProcessor.rightShift);
        const prediction = model.predict(input);
        const index = prediction.argMax(1).dataSync()[0];

        // free tensor memory
        input.dispose();
        prediction.dispose();

        return charSet[index];
    };

    console.log("OCRing all the files!");

    // predict the rest
    // skip the first file because it contains non base64 data - handle image 1 manually
    const numImages = fs.readdirSync(`./files/${docName}/png`).length;
    let out = "";
    for (let i = 0; i < numImages; i++) {
        console.log("Processing image " + i + "...");

        await drawImageI(docName, i);
        const charDatas = imageProcessor.process(getCtx(), getCanvas().width, getCanvas().height);

        for (let j = 0; j < charDatas.length; j++) {
            out += predict(charDatas[j].data, charDatas[j].width, charDatas[j].height);
        }
    }

    if (TRAINING_DATA[docName]?.start && TRAINING_DATA[docName]?.end) {
        const start = TRAINING_DATA[docName].start.join("");
        const end = TRAINING_DATA[docName].end.join("");

        // since '=' are only at the end of the file, they won't be in the training data
        // so I handle them manually
        out = out.slice(out.indexOf(start), out.indexOf(end)) + end + "==";
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
