# Epstein OCR
The Epstein files contain base64 data. What is contained in it?

The relevant files:  
View in browser: [https://archive.org/details/efta-00400459/mode/2up](https://archive.org/details/efta-00400459/mode/2up)  
Download: [https://archive.org/download/efta-00400459-lossless-webp](https://archive.org/download/efta-00400459-lossless-webp) 

Original Write Up: [https://neosmart.net/blog/recreating-epstein-pdfs-from-raw-encoded-attachments/
](https://neosmart.net/blog/recreating-epstein-pdfs-from-raw-encoded-attachments/
)

TLDR: In theory [ now in actuality ;) ] one can run optical character recognition on the base64 data in the Epstein files to recover it as text, and then convert the base64 to binary to recover the censored attachements from the Epstein files. The issue is that the characters are rather low resolution and in Courier New making it ambiguous what many of the characters are. The many existing generic OCR models are unable to figure out the difference between a '1' and a 'l' in the files. This is a tensorflow.js model trained specifically to read the Epstein files.

## Notes
This project is heavily "vibe coded".

Running this project will consume 6 GB of RAM (I think it's memory leaking somewhere, but idk).

## Running
My code current doesn't handle pages/images that include non-base64 text so the first and last page of the base64 images need slight manual intervention.

After downloading the images from archive.org, extract them, and then run `node convertImages.js` to use FFMPEG to convert the images from webp to png (node canvas doesn't support webp).

Next run `node index.js`. This will create and train the OCR model if it doesn't already exist in the `epstein-ocr-model` directory. If the model already exists, the script will skip training and automatically jump to extracting the base64 from the images. This takes a while, but once complete the output will be written to the `output` directory. If the `document.pdf` file in output is openable then we have success, otherwise the model made an error in it's transcription.

I have included my training of the model in this repo. My training of the model as provided can successfully decode the EFTA00400459 files. There is no guarentee it works on any other files.