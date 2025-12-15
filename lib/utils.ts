import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';

// Fix for pdfjs-dist worker
if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = getDocument({
      data: arrayBuffer,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/cmaps/`,
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    return fullText;
  } catch (error) {
    console.error("PDF Extraction failed:", error);
    throw new Error("Failed to extract text from PDF. Ensure the file is not corrupted.");
  }
};

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Robustly parses JSON from a string that might contain extra text (e.g. Markdown).
 * Scans for the outermost {} pair that forms valid JSON.
 */
/**
 * Robustly parses JSON from a string that might contain extra text (e.g. Markdown).
 * Scans for the outermost {} pair that forms valid JSON.
 */
export function parseJsonFromText(text: string): any {
  if (!text) return null;

  // 1. Try extracting from markdown code blocks first (most reliable)
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonBlockRegex);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      // Code block content wasn't valid JSON, continue to other methods
    }
  }

  // 2. Try cleaning markdown code blocks (in case the above failed or didn't exist)
  // We keep the content but remove the markers to help with direct parsing
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

  // 3. Try direct parse of the cleaned text
  try {
    return JSON.parse(clean);
  } catch (e) {
    // Continue to extraction logic
  }

  // 4. Extract using brace counting - Iterative approach
  // We look for the first substring that starts with { and forms a valid JSON object
  let startIndex = 0;
  while (true) {
    const start = clean.indexOf('{', startIndex);
    if (start === -1) break;

    let braceCount = 0;
    let end = -1;

    for (let i = start; i < clean.length; i++) {
      if (clean[i] === '{') braceCount++;
      else if (clean[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          end = i;
          // Found a balanced block, try parsing
          try {
            const candidate = clean.substring(start, end + 1);
            return JSON.parse(candidate);
          } catch (e) {
            // This block wasn't valid JSON, but maybe it was just a nested structure in a sentence?
            // We continue searching from the next character after this '}' 
            // (though strictly speaking, we might want to continue from start + 1, but this is an optimization)
          }
          break; // Break the inner loop to continue outer loop from where we left off or next char
        }
      }
    }

    // If we finished the inner loop and didn't return, advance startIndex
    // If we found a balanced block that failed (end != -1), we can start searching after it.
    // If we didn't find a balance (end == -1), we should probably just advance by 1
    startIndex = (end !== -1) ? end + 1 : start + 1;
  }

  return null;
}