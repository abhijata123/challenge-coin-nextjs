import imageCompression from 'browser-image-compression';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const processImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.5, // Reduced from 1MB to 0.5MB for faster uploads
    maxWidthOrHeight: 800,
    useWebWorker: true,
    preserveAspectRatio: true,
    initialQuality: 0.6, // Reduced quality for better compression
    fileType: 'image/webp',
    alwaysKeepResolution: true,
    onProgress: () => {},
    strict: true
  };

  try {
    console.log('Original image size:', file.size / 1024 / 1024, 'MB');
    const compressedFile = await imageCompression(file, options);
    console.log('Compressed image size:', compressedFile.size / 1024 / 1024, 'MB');
    
    return new File([compressedFile], file.name.replace(/\.[^/.]+$/, '.webp'), {
      type: 'image/webp',
    });
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
};

export const convertToWebP = async (imageUrl: string, retryCount = 0): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    const blob = await response.blob();
    const file = new File([blob], 'image.webp', { type: 'image/webp' });
    const processedFile = await processImage(file);
    return URL.createObjectURL(processedFile);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error converting to WebP (attempt ${retryCount + 1}):`, error.message);
    }

    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return convertToWebP(imageUrl, retryCount + 1);
    }

    console.warn('Failed to convert image, using original URL:', imageUrl);
    return imageUrl;
  }
};