import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { promisify } from "util";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// Create a randomBytes function that returns a Promise
const randomBytesAsync = promisify(randomBytes);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Define the storage bucket name
const STORAGE_BUCKET = 'uploads';

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
 * Upload a file to Supabase storage
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
    const filePath = `${uniqueFileName}`;
    
    // Upload to Supabase storage
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: false
      });
    
    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('Upload failed: No data returned');
    }
    
    // Get the public URL
    const { data: publicUrlData } = supabase
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);
    
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Error uploading file to storage:", error);
    throw new Error("Failed to upload file to storage");
  }
}

/**
 * Delete a file from Supabase storage
 * @param fileUrl URL of the file to delete
 * @returns true if deletion was successful
 */
export async function deleteFile(fileUrl: string): Promise<boolean> {
  try {
    // Extract the file path from the URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // Delete from Supabase storage
    const { error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .remove([fileName]);
    
    if (error) {
      console.error(`Delete failed: ${error.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting file from storage:", error);
    return false;
  }
}

/**
 * Check if the Supabase storage is configured and accessible
 * @returns boolean indicating if storage is ready
 */
export async function isObjectStorageReady(): Promise<boolean> {
  try {
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or key not configured');
      return false;
    }
    
    // Check if the bucket exists
    const { data, error } = await supabase
      .storage
      .getBucket(STORAGE_BUCKET);
    
    if (error) {
      // If bucket doesn't exist, try to create it
      if (error.message.includes('not found')) {
        const { error: createError } = await supabase
          .storage
          .createBucket(STORAGE_BUCKET, {
            public: true,
            fileSizeLimit: 5 * 1024 * 1024 // 5MB
          });
          
        if (createError) {
          console.error(`Failed to create bucket: ${createError.message}`);
          return false;
        }
        return true;
      }
      
      console.error(`Storage check failed: ${error.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Storage service is not accessible:", error);
    return false;
  }
}

/**
 * Get an object from Supabase storage
 * @param filePath The path of the file to get
 * @returns The object data as a Buffer
 */
export async function getObject(filePath: string): Promise<Buffer | null> {
  try {
    // Download from Supabase storage
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .download(filePath);
    
    if (error) {
      console.error(`Download failed: ${error.message}`);
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Error getting object ${filePath}:`, error);
    return null;
  }
}