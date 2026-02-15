// utility for comparing base64 output to expected output
const fs = require("fs");

const modelOutput = fs.readFileSync(process.argv[2]).toString();
const truth = fs.readFileSync(process.argv[3]).toString();

const len = Math.min(modelOutput.length, truth.length);
for (let i = 0; i < len; i++) {
    if (modelOutput[i] !== truth[i]) {
        console.log(`At ${i} saw ${modelOutput[i]} expected ${truth[i]}`);
    }
}

