import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import multer from 'multer';
import { Express, Request } from 'express';

// Ensure the uploads directory exists
const UPLOAD_DIR = './public/uploads';

async function ensureUploadDirExists() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    console.log('Upload directory is ready');
  } catch (error) {
    console.error('Error creating upload directory:', error);
  }
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate a unique filename with the original extension
    const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// File filter to only accept image files
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

export async function setupUploads() {
  await ensureUploadDirExists();
}