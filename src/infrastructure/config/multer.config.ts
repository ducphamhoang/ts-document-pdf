import multer from 'multer';
import path from 'path';
import os from 'os';
import config from '../config';
import { UnsupportedFileTypeError, FileTooLargeError } from '../../domain/errors';

// Configure storage for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, os.tmpdir()); // Use system's temp directory
  },
  filename: function (req, file, cb) {
    // Create a unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter to only allow specific file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // List of allowed file extensions
  const allowedExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(fileExtension)) {
    cb(null, true); // Accept the file
  } else {
    // Create our custom error for unsupported file types
    const error = new UnsupportedFileTypeError(
      `File type ${file.mimetype} with extension ${fileExtension} is not supported. Supported extensions: ${allowedExtensions.join(', ')}`
    );
    cb(error); // Pass error only (multer standard)
  }
};

// Create multer instance with configuration
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: config.files.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
    // Also set parts and fields limits to prevent abuse
    fields: 1,  // Only allow 1 field (the file field)
    files: 1,   // Only allow 1 file
  },
  fileFilter: fileFilter
});

export default upload;