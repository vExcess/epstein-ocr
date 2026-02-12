# Epstein OCR
The Epstein files contain base64 data. What information is hidden in the base64?

Original Write Up: [https://neosmart.net/blog/recreating-epstein-pdfs-from-raw-encoded-attachments/
](https://neosmart.net/blog/recreating-epstein-pdfs-from-raw-encoded-attachments/
)

TLDR: In theory (now in actuality) one can run optical character recognition on the base64 data in the Epstein files to recover it as text, and then convert the base64 to binary to recover the redacted attachements from the Epstein files. The issue is that the characters are rather low resolution and in Courier New making it ambiguous what many of the characters are. The many existing generic OCR models are unable to reliably figure out the difference between a '1' and a 'l' in the files. This is a tensorflow.js model trained specifically to read the Epstein files reliably. I have included my training of the model in this repo.

## Files Successfully Decoded
These are the files successfully decoded with my model and their SHA256 hash. It may or may not be able to decode other files.
| File  | SHA256 Sum |
| ------------- | ------------- |
| EFTA00400459  | d0e3d0c8f506e58dc5cecb57b02c3e9cb81d3d0b406c84cbcee410563ce60e66 |
| EFTA00382108  | Partially decoded - but the PDF is corrupted. Need to do more fine tuning  |

## Notes
This project is partially "vibe coded".

Running this project gradually consumes more and more memory. For me it consumes 3 GB despite me calling .dispose() on my tensors to free their memory.

## Running
My code currently doesn't handle pages/images that include non-base64 text so the first and last page of the base64 images need slight manual intervention. Also this project only runs on Linux.

### Setup
Clone repo: `https://github.com/vExcess/epstein-ocr.git`  
Install dependencies: `npm install`

Obtain the files you wish to process: I recommend archive.org [https://web.archive.org/web/20260131153148/https://www.justice.gov/epstein/files/DataSet%209/EFTA00400459.pdf](https://web.archive.org/web/20260131153148/https://www.justice.gov/epstein/files/DataSet%209/EFTA00400459.pdf)

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
e.g. `node extract-images.js EFTA00400459`  

### Training
Run `node train.js`

This will train the OCR model and save it to the `epstein-ocr-model` directory. If the model already exists in that directory, it loads and continues training the existing model, otherwise it creates a new model from scratch.

Note: Be wary of overtraining the model. Too much training makes it perform worse. I've found that 100-150 epochs or so is a good amount.

The images are scaled up by 2x before processing because it blurs the image which increases the model's accuracy.

### Decoding Base64
Run `node decode.js {DOC_NAME}`  
e.g. `node decode.js EFTA00400459`  

Extracts the base64 from the images and saves it as a base64 file and a binary file. This takes a while, but once complete the output will be written to the directory ./files/{DOC_NAME}/output. If the `output.pdf` file in output is openable then we have success, otherwise the model made an error in its transcription.

## ToDo
- Automatically handle non-base64 data being included on the first and last pages
- Use mulithreading for better performance
- handle bleeding from adjacent characters
- write script to find out what characters in the training data are failing