// 1. THIS IS THE CRITICAL LINE: Polyfill the missing Node internal before TF loads
const util = require('util');
if (!util.isNullOrUndefined) {
    util.isNullOrUndefined = (obj) => obj === null || obj === undefined;
}

const fs = require("fs");
const { createCanvas, loadImage } = require('canvas');
const tf = require('@tensorflow/tfjs-node');

const imageProcessor = require("./processImage.js");
const trainingData = require("./training_data.js").join("").split("");

let docName = process.argv[2];

const charSet = "abcdefghijklmnopqrstuvwyxzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=?"; 

const savePath = 'file://./epstein-ocr-model';

async function trainOCR(bitmaps, characters, width, height) {
    // 1. Label Encoding
    const labelsAsInts = characters.map(c => charSet.indexOf(c));

    // 2. Prepare Tensors
    // We reshape flat arrays into [samples, height, width, channels]
    // '1' at the end represents a single color channel (grayscale)
    const xs = tf.tensor4d(bitmaps.flat(), [bitmaps.length, height, width, 1]).div(255 >> imageProcessor.rightShift);
    const ys = tf.oneHot(tf.tensor1d(labelsAsInts, 'int32'), charSet.length);

    // 3. Build the CNN
    let model;
    let usingExistingModel = false;
    try {
        console.log('Loading existing model...');
        model = await tf.loadLayersModel(savePath + "/model.json");
        usingExistingModel = true;
    } catch (err) {
        console.log('No existing model found. Creating new model.');
        
        model = tf.sequential();

        /*
            I have no clue how all these layers work. 
            Gemini said this is what to do, so I did and it works.
        */

        // First layer: detects basic edges/lines
        model.add(tf.layers.conv2d({
            inputShape: [height, width, 1],
            kernelSize: 3,
            filters: 8,
            activation: 'relu',
            padding: 'same'
        }));
        model.add(tf.layers.maxPooling2d({poolSize: 2}));

        // Second layer: detects complex shapes
        model.add(tf.layers.conv2d({
            kernelSize: 3,
            filters: 16,
            activation: 'relu',
            padding: 'same'
        }));
        model.add(tf.layers.maxPooling2d({poolSize: 2}));

        // Flatten to transition to classification
        model.add(tf.layers.flatten());
        model.add(tf.layers.dense({units: 64, activation: 'relu'}));
        // Add this: It forces the model to generalize
        model.add(tf.layers.dropout({rate: 0.25}));
        model.add(tf.layers.dense({units: charSet.length, activation: 'softmax'}));
    }

    // 4. Compile and Train
    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    // 1. Calculate weights
    const classCounts = {};
    labelsAsInts.forEach(label => {
        classCounts[label] = (classCounts[label] || 0) + 1;
    });

    const totalSamples = labelsAsInts.length;
    const classWeight = {};
    Object.keys(classCounts).forEach(label => {
        // Formula: total / (num_classes * count_for_this_class)
        classWeight[label] = totalSamples / (charSet.length * classCounts[label]);
    });

    if (!usingExistingModel) {
        console.log('Training...');
        await model.fit(xs, ys, {
            epochs: 100, // 100 seems optimal
            batchSize: 16,
            classWeight: classWeight, // This is the magic line
            shuffle: true,
            // callbacks: tf.callbacks.earlyStopping({
            //     monitor: 'loss',
            //     patience: 10 // Stops if loss doesn't improve for 10 straight epochs
            // })
        });
    }

    // 5. Prediction Wrapper
    const predict = (flatBitmap) => {
        return tf.tidy(() => {
            const input = tf.tensor4d(flatBitmap, [1, height, width, 1]).div(255 >> imageProcessor.rightShift);
            const prediction = model.predict(input);
            const index = prediction.argMax(1).dataSync()[0];
            return charSet[index];
        });
    };

    return { model, predict };
}

// 2. Initialize Canvas
let canvas = null;
let ctx = null;

function getPNGImagePath(docName, idx) {
    let imagePath = null;
    for (var i = 1; i <= 5; i++) {
        let idxString = idx.toString().padStart(i, "0");
        let path = `./files/${docName}/png/${docName}-${idxString}.png`;
        if (fs.existsSync(path)) {
            imagePath = path;
        }
    }
    return imagePath;
}

async function drawImageI(docName, idx) {
    // 1. Load from local file
    const image = await loadImage(getPNGImagePath(docName, idx));
    canvas = createCanvas(image.width, image.height);
    ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
}

async function main() {
    // load & process training image
    await drawImageI(docName, 2);
    imageProcessor.process(ctx, canvas.width, canvas.height);

    // train the model
    var c = imageProcessor.charDatas()[0];
    var bitmaps = imageProcessor.charDatas().map(a => a.data).slice(0, trainingData.length);
    var {model, predict} = await trainOCR(bitmaps, trainingData, c.width, c.height);

    console.log("Model Trained!");

    // --- 5. Save to Disk ---
    await model.save(savePath);
    console.log(`Model saved to ${savePath}`);

    console.log("OCRing all the files!");

    // predict the rest
    // skip the first file because it contains non base64 data - handle image 1 manually
    var out = "";
    for (var i = 2; i <= 76; i++) {
        console.log("Processing image " + i + "...");

        await drawImageI(docName, i);
        imageProcessor.process(ctx, canvas.width, canvas.height);

        for (var j = 0; j < imageProcessor.charDatas().length; j++) {
            out += predict(imageProcessor.charDatas()[j].data);
        }
    }

    var firstLine = "JVBERi0xLjUNJeLjz9MNCjM0IDAgb2JqDTw8L0xpbmVhcml6ZWQgMS9MIDI3NjAyOC9PIDM2L0Ug";
    var lastLine = "ZWFtDWVuZG9iag1zdGFydHhyZWYNCjExNg0KJSVFT0YNCg";

    // since '=' are only at the end of the file, they won't be in the training data
    // so I handle them manually
    out = firstLine + out.slice(0, out.indexOf(lastLine)) + lastLine + "==";

    if (!fs.existsSync(`./files/${docName}/output`)) {
        fs.mkdirSync(`./files/${docName}/output`);
    }

    fs.writeFileSync(`./files/${docName}/output/base64.txt`, out);
    fs.writeFileSync(`./files/${docName}/output/output.pdf`, Buffer.from(out, "base64"));

    console.log("OCR complete!");
}

main();
