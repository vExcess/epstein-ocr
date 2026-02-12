const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let docName = process.argv[2];

const pngImagesPath = `./files/${docName}/png`;
const originalImagesPath = `./files/${docName}/original-images`;
const pdfPath = `./files/${docName}/${docName}.pdf`;

if (!fs.existsSync(pngImagesPath)) {
    fs.mkdirSync(pngImagesPath);
}

if (fs.existsSync(originalImagesPath)) {
    // Get all files in the current working directory
    const files = fs.readdirSync(originalImagesPath);

    // Filter for image files (case-insensitive)
    const imageFilesNames = files.filter(file => [".webp", ".jpg", ".jpeg", ".png"].includes(path.extname(file).toLowerCase()));

    console.log(`Found ${imageFilesNames.length} files. Starting conversion...`);

    const isZeroIndexed = parseInt(imageFilesNames.sort((a, b) => a.localeCompare(b, 'en', {'sensitivity': 'base'}))[0].split("-")[1].split(".")[0]) === 0;

    for (let i = 0; i < imageFilesNames.length; i++) {
        const fileName = imageFilesNames[i];
        const documentName = fileName.split("-")[0];
        const imageNumber = fileName.split("-")[1].split(".")[0];
        const fileExt = fileName.split(".")[1];

        // some image collection downloads are 1 indexed. this project expects images to be 0 indexed
        const imageOutputNumber = isZeroIndexed ? imageNumber : (imageNumber - 1);
        const outputName = `${documentName}-${imageOutputNumber.toString().padStart(3, "0")}.png`;

        try {
            // Execute FFmpeg command
            // -i: input file
            // -y: overwrite output if it exists
            execSync(`ffmpeg -i "${originalImagesPath}/${fileName}" -y "${pngImagesPath}/${outputName}"`, { stdio: 'ignore' });
            console.log(`${Math.round(i / imageFilesNames.length * 100)}%`);
        } catch (error) {
            console.error(`Failed to convert ${fileName}:`, error.message);
        }
    }
} else if (fs.existsSync(pdfPath)) {
    // extract images from pdf
    console.log("Extracting images...");
    execSync(`pdfimages -j ${pdfPath} ${pngImagesPath}/${docName} -png`);
} else {
    console.log("No source to extract images from found");
}

console.log("Image extraction complete.");
