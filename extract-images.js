const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let docName = process.argv[2];

if (!fs.existsSync(`./files/${docName}/png`)) {
    fs.mkdirSync(`./files/${docName}/png`);
}

if (fs.existsSync(`./files/${docName}/original-images`)) {
    // Get all files in the current working directory
    const files = fs.readdirSync(`./files/${docName}/original-images`);

    // Filter for image files (case-insensitive)
    const imageFiles = files.filter(file => [".webp", ".jpg", ".jpeg", ".png"].includes(path.extname(file).toLowerCase()));

    console.log(`Found ${imageFiles.length} files. Starting conversion...`);

    for (var i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const output = path.parse(file).name + '.png';

        try {
            // Execute FFmpeg command
            // -i: input file
            // -y: overwrite output if it exists
            execSync(`ffmpeg -i "./files/${docName}/original-images/${file}" -y "./files/${docName}/png/${output}"`, { stdio: 'ignore' });
            console.log(`${Math.round(i / imageFiles.length * 100)}%`);
        } catch (error) {
            console.error(`Failed to convert ${file}:`, error.message);
        }
    }
} else if (fs.existsSync(`./files/${docName}/${docName}.pdf`)) {
    // extract images from pdf
    execSync(`pdfimages -j ./files/${docName}/${docName}.pdf ./files/${docName}/png/${docName} -png`);
} else {
    console.log("No source to extract images from found");
}

console.log("Image extraction complete.");
