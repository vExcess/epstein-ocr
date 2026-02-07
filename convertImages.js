const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get all files in the current working directory
const files = fs.readdirSync("./EFTA00400459");

// Filter for .webp files (case-insensitive)
const webpFiles = files.filter(file => path.extname(file).toLowerCase() === '.webp');

console.log(`Found ${webpFiles.length} files. Starting conversion...`);

if (!fs.existsSync("./PNG_EFTA00400459")) {
    fs.mkdirSync("./PNG_EFTA00400459");
}

for (var i = 0; i < webpFiles.length; i++) {
    const file = webpFiles[i];
    const input = file;
    // Replace extension with .png
    const output = path.parse(file).name + '.png';

    try {
        // Execute FFmpeg command
        // -i: input file
        // -y: overwrite output if it exists
        execSync(`ffmpeg -i "./EFTA00400459/${input}" -y "./PNG_EFTA00400459/${output}"`, { stdio: 'ignore' });
        console.log(`${Math.round(i / webpFiles.length * 100)}%`);
    } catch (error) {
        console.error(`Failed to convert ${input}:`, error.message);
    }
}

console.log("Processing complete.");