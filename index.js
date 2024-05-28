const express = require('express');
const fs = require('node:fs')
const cloudconvert = require('cloudconvert');
const cors = require('cors');
const multer = require('multer');

const app = express();
require('dotenv').config();
const upload = multer({ dest: '/uploads' });

// Specify the URL of React app
const allowedOrigin = 'http://localhost:3000';

// Configure CORS middleware to allow
const corsOptions = {
  origin: allowedOrigin,
};

// Enable CORS with the specified options
app.use(cors(corsOptions));

// Configure CloudConvert API credentials
const cloudConvertApiKey = process.env.CLOUD_CONVERT_API_KEY;
const cloudConvertSandboxKey = process.env.CLOUD_CONVERT_SAN_KEY;

const cloudConvert = new cloudconvert(cloudConvertApiKey, false);
// const cloudConvert = new cloudconvert(cloudConvertSandboxKey, true);

// Define an API endpoint to receive DXF file
app.post('/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const format = req.body.format

    // Create a CloudConvert job
    const job = await cloudConvert.jobs.create({
      tasks: {
        'import-my-file': {
          operation: 'import/upload'
        },
        'convert-my-file': {
          operation: 'convert',
          input: ['import-my-file'],
          output_format: format
        },
        'export-my-file': {
          operation: 'export/url',
          input: 'convert-my-file'
        }
      }
    });

    // Get the upload task from the job
    const uploadTask = job.tasks.find(task => task.name === 'import-my-file');

    // Create a read stream for the uploaded file
    const inputFileStream = fs.createReadStream(req.file.path);

    // Upload the file to CloudConvert
    await cloudConvert.tasks.upload(uploadTask, inputFileStream, req.file.originalname);

    // Wait for the conversion task to finish
    const result = await cloudConvert.jobs.wait(job.id);

    // get the result and find export file
    const exportTask = result.tasks.find(el => el.name === 'export-my-file');
    const exportFile = exportTask.result.files[0];

    // // Get the converted file URL
    const downloadUrl = exportFile.url;

    // Return the download URL of the converted file
    res.json({ downloadUrl });
  } catch (error) {
    console.error('Error converting file:', error);
    res.status(500).send(error);
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
