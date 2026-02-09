# Epstein OCR
The Epstein files contain base64 data. What is contained in it?

Original Write Up: [https://neosmart.net/blog/recreating-epstein-pdfs-from-raw-encoded-attachments/
](https://neosmart.net/blog/recreating-epstein-pdfs-from-raw-encoded-attachments/
)

TLDR: In theory [ now in actuality ;) ] one can run optical character recognition on the base64 data in the Epstein files to recover it as text, and then convert the base64 to binary to recover the redacted attachements from the Epstein files. The issue is that the characters are rather low resolution and in Courier New making it ambiguous what many of the characters are. The many existing generic OCR models are unable to reliably figure out the difference between a '1' and a 'l' in the files. This is a tensorflow.js model trained specifically to read the Epstein files reliably. I have included my training of the model in this repo.

## Files Successfully Decoded
These are the files successfully decoded with my model. It may or may not be able to decode other files.
- EFTA00400459

## Notes
This project is heavily "vibe coded".

Running this project will consume 6 GB of RAM (I think it's memory leaking somewhere, but idk).

## Running
My code currently doesn't handle pages/images that include non-base64 text so the first and last page of the base64 images need slight manual intervention. Also this project only runs on Linux.

### Setup
Clone repo: `https://github.com/vExcess/epstein-ocr.git`  
Install dependencies: `npm install`

Obtain the files you wish to process: I recommend archive.org  
View in browser: [https://archive.org/details/efta-00400459/mode/2up](https://archive.org/details/efta-00400459/mode/2up)  
Download: [https://archive.org/download/efta-00400459-lossless-webp](https://archive.org/download/efta-00400459-lossless-webp) 

Place the documents in the correct location for processing. The structure is the following diagram. Anything in curly braces is a variable. Do not include the curly braces in the file/directory names. The `original-images` folder is optional. Use it only if you are extracting directly from images instead of from a pdf.
```
files/
    {DOC_NAME}/
        {DOC_NAME}.pdf
        original-images/
            {DOC_NAME}-{IMAGE_NUMBER}.{IMAGE_FORMAT}
        png/
            {DOC_NAME}-{IMAGE_NUMBER}.png
```
e.g.
```
files/
    EFTA00382108/
        EFTA00382108.pdf
        png/
            EFTA00382108-000.png
            EFTA00382108-001.png
            EFTA00382108-002.png
```

### Extract images
If extracting from a pdf, you must have poppler-utils installed.  
`sudo apt install poppler-utils`

If extracting from images, you must have ffmpeg installed.  
`sudo apt install ffmpeg`

perform the image extraction: `node extract-images.js {DOC_NAME}`  
e.g. `node extract-images.js EFTA00382108`  

### Training and Decoding
Run `node index.js`. 

This will create and train the OCR model if it doesn't already exist in the `epstein-ocr-model` directory. If the model already exists, the script will skip training and automatically jump to extracting the base64 from the images. This takes a while, but once complete the output will be written to the directory ./files/{DOC_NAME}/output. If the `output.pdf` file in output is openable then we have success, otherwise the model made an error in its transcription.

## ToDo
- Automatically handle non-base64 data being included on the first and last pages