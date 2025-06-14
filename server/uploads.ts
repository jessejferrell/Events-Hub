import multer from 'multer';
import { Express, Request } from 'express';
import { isObjectStorageReady } from './objectStorage';

// Configure multer for memory storage (for object storage)
// Instead of saving to disk, we'll keep files in memory and then upload to object storage
const storage = multer.memoryStorage();

// File filter to only accept image files
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const upload = multer({
  storage, // Using memory storage
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Check if Supabase storage is configured and accessible
export async function setupUploads() {
  try {
    const isReady = await isObjectStorageReady();
    if (isReady) {
      console.log('Object storage is ready for uploads');
    } else {
      console.warn('Storage service is not accessible. Uploads may fail.');
    }
  } catch (error) {
    console.error('Error checking object storage:', error);
  }
}