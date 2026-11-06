import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Compresses an image file on the client side and returns the local URI for preview.
 * Resizes the image to a maximum dimension of 800px and reduces JPEG quality.
 */
export const compressImage = async (uri: string): Promise<string> => {
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      {
        compress: 0.7,
        format: SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.warn('Failed to compress image client-side:', error);
    return uri;
  }
};

/**
 * Compresses an image file and returns the base64 data URI string for network upload.
 */
export const compressImageToBase64 = async (uri: string): Promise<string | null> => {
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      {
        compress: 0.6,
        format: SaveFormat.JPEG,
        base64: true,
      }
    );
    return result.base64 ? `data:image/jpeg;base64,${result.base64}` : null;
  } catch (error) {
    console.warn('Failed to convert image to base64:', error);
    return null;
  }
};

/**
 * Compresses an image to WebP at max 800px / 0.75 quality using expo-image-manipulator.
 * Returns raw base64 string (no data-URI prefix) + mimeType for server upload.
 * Falls back to JPEG if WebP is unavailable on the platform.
 */
export const compressImageToWebpBase64 = async (
  uri: string
): Promise<{ base64: string; mimeType: 'image/webp' | 'image/jpeg' } | null> => {
  // Try WebP first
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.75, format: SaveFormat.WEBP, base64: true }
    );
    if (result.base64) return { base64: result.base64, mimeType: 'image/webp' };
  } catch (_) {
    // WebP not supported on this platform — fall through to JPEG
  }

  // JPEG fallback
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.75, format: SaveFormat.JPEG, base64: true }
    );
    if (result.base64) return { base64: result.base64, mimeType: 'image/jpeg' };
  } catch (error) {
    console.warn('Failed to compress image for upload:', error);
  }

  return null;
};
