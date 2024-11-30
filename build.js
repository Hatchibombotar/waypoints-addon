// thanks chatgpt

const fs = require('fs');
const path = require('path');

// Define the target directory
const targetDir = 'BP/scripts'

// Check if the directory exists
if (!fs.existsSync(targetDir)) {
  console.error(`The directory "${targetDir}" does not exist.`);
  process.exit(1);
}

// Read the directory contents
fs.readdir(targetDir, (err, files) => {
  if (err) {
    console.error(`Error reading directory "${targetDir}":`, err);
    process.exit(1);
  }

  // Filter .ts files
  const tsFiles = files.filter(file => path.extname(file) === '.ts');

  if (tsFiles.length === 0) {
    console.log('No .ts files found in the directory.');
    return;
  }

  // Delete each .ts file
  tsFiles.forEach(file => {
    const filePath = path.join(targetDir, file);
    fs.unlink(filePath, err => {
      if (err) {
        console.error(`Error deleting file "${filePath}":`, err);
      } else {
        console.log(`Deleted file: ${filePath}`);
      }
    });
  });
});