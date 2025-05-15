import { Client } from "@replit/object-storage";
import { randomBytes } from "crypto";
import { promisify } from "util";
import path from "path";

// Create a randomBytes function that returns a Promise
const randomBytesAsync = promisify(randomBytes);

// Initialize object storage client
const objectStorage = new Client({
  bucketName: "replit-objstore-59539edf-f9e5-470f-b744-2fd4b1b3c6f6"
});

/**
 * Generate a unique file name for storage
 * @param originalName Original file name
 * @returns Unique file name
 */
async function generateUniqueFileName(originalName: string): Promise<string> {
  const randomString = (await randomBytesAsync(8)).toString("hex");
  const extension = path.extname(originalName);
  const basename = path.basename(originalName, extension);
  
  // Sanitize basename to avoid issues with special characters
  const sanitizedName = basename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40); // Limit length
  
  return `${sanitizedName}-${randomString}${extension}`;
}

/**
 * Upload a file to object storage
 * @param fileBuffer File buffer content
 * @param originalFileName Original file name
 * @param contentType MIME type of the file
 * @returns URL to the uploaded file
 */
export async function uploadFile(
  fileBuffer: Buffer,
  originalFileName: string,
  contentType: string
): Promise<string> {
  try {
    const uniqueFileName = await generateUniqueFileName(originalFileName);
    const objectKey = `uploads/${uniqueFileName}`;
    
    // Upload to object storage
    const uploadResult = await objectStorage.upload(objectKey, fileBuffer, {
      contentType: contentType,
    });
    
    if (uploadResult.err) {
      throw new Error(`Upload failed: ${uploadResult.err.message}`);
    }
    
    // Get the public URL
    const hostUrl = process.env.NODE_ENV === 'production' 
      ? 'https://events.mosspointmainstreet.org' 
      : 'https://events-manager.replit.app';
    
    const publicUrl = `${hostUrl}/api/storage/${objectKey}`;
    return publicUrl;
  } catch (error) {
    console.error("Error uploading file to object storage:", error);
    throw new Error("Failed to upload file to object storage");
  }
}

/**
 * Delete a file from object storage
 * @param fileUrl URL of the file to delete
 * @returns true if deletion was successful
 */
export async function deleteFile(fileUrl: string): Promise<boolean> {
  try {
    // Extract the object key from the URL
    const pathParts = fileUrl.split('/');
    const startIndex = pathParts.indexOf('storage') + 1;
    if (startIndex <= 0) return false;
    
    const objectKey = pathParts.slice(startIndex).join('/');
    
    // Delete from object storage
    const deleteResult = await objectStorage.delete(objectKey);
    
    if (deleteResult.err) {
      console.error(`Delete failed: ${deleteResult.err.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting file from object storage:", error);
    return false;
  }
}

/**
 * Check if the object storage is configured and accessible
 * @returns boolean indicating if object storage is ready
 */
export async function isObjectStorageReady(): Promise<boolean> {
  try {
    // List a few objects to verify connection
    const listResult = await objectStorage.list({ prefix: '' });
    
    if (listResult.err) {
      console.error(`List operation failed: ${listResult.err.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Object storage is not accessible:", error);
    return false;
  }
}

/**
 * Get an object from object storage
 * @param objectKey The key of the object to get
 * @returns The object data as a Buffer
 */
export async function getObject(objectKey: string): Promise<Buffer | null> {
  try {
    const downloadResult = await objectStorage.download(objectKey);
    
    if (downloadResult.err) {
      console.error(`Download failed: ${downloadResult.err.message}`);
      return null;
    }
    
    return downloadResult.data;
  } catch (error) {
    console.error(`Error getting object ${objectKey}:`, error);
    return null;
  }
}