// 1. THIS IS THE CRITICAL LINE: Polyfill the missing Node internal before TF loads
const util = require('util');
if (!util.isNullOrUndefined) {
    util.isNullOrUndefined = (obj) => obj === null || obj === undefined;
}

const fs = require("fs");
const tf = require('@tensorflow/tfjs-node');

const imageProcessor = require("./processImage.js");
const TRAINING_DATA = require("./training-data.js");

const { charSet, savePath, drawImageI, getCtx, getCanvas } = require("./utils.js");

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
    try {
        console.log('Loading existing model...');
        model = await tf.loadLayersModel(savePath + "/model.json");
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

    return model;
}

async function main() {
    for (const docName in TRAINING_DATA) {
        // load & process training image
        await drawImageI(docName, 1);
        const charDatas = imageProcessor.process(getCtx(), getCanvas().width, getCanvas().height);

        // train the model
        const trainingData = TRAINING_DATA[docName]["1"].join("").split("");
        const bitmaps = charDatas.map(a => a.data).slice(0, trainingData.length);
        const model = await trainOCR(bitmaps, trainingData, charDatas[0].width, charDatas[0].height);

        console.log("Model Trained!");

        // --- 5. Save to Disk ---
        await model.save(savePath);
        console.log(`Model saved to ${savePath}!`);
    }
}

main();
