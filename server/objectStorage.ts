import { createClient } from "@replit/object-storage";
import { randomBytes } from "crypto";
import { promisify } from "util";
import path from "path";

// Create a randomBytes function that returns a Promise
const randomBytesAsync = promisify(randomBytes);

// Initialize object storage client
const objectStorage = createClient({
  bucketName: "replit-objstore-59539edf-f9e5-470f-b744-2fd4b1b3c6f6",
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
    await objectStorage.put(objectKey, fileBuffer, {
      contentType,
      accessControl: "publicRead", // Make the file publicly accessible
    });
    
    // Get the public URL
    return await objectStorage.getPublicUrl(objectKey);
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
    const urlObject = new URL(fileUrl);
    const objectKey = urlObject.pathname.startsWith("/")
      ? urlObject.pathname.slice(1) // Remove leading slash
      : urlObject.pathname;
    
    // Delete from object storage
    await objectStorage.delete(objectKey);
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
    // Try to list objects to verify connection
    await objectStorage.list({ prefix: "test", maxKeys: 1 });
    return true;
  } catch (error) {
    console.error("Object storage is not accessible:", error);
    return false;
  }
}

// Export the object storage client for direct access if needed
export { objectStorage };