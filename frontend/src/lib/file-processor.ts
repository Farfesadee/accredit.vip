// File processor for fliers, images, and documents
import pdfParse from 'pdfjs-dist';

export interface ProcessedFlier {
  text: string;
  title?: string;
  description?: string;
  extracted: boolean;
}

export interface ProcessedImage {
  url: string;
  width: number;
  height: number;
  resized: boolean;
  mimeType: string;
}

const INVITE_WIDTH = 1200;
const INVITE_HEIGHT = 800;

export const FileProcessor = {
  // Detect file type
  isImage(file: File): boolean {
    return file.type.startsWith('image/');
  },

  isPDF(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  },

  isDocument(file: File): boolean {
    return (
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'text/plain'
    );
  },

  getFileCategory(file: File): 'image' | 'flier' | 'document' {
    if (this.isImage(file)) return 'image';
    if (this.isPDF(file) || this.isDocument(file)) return 'flier';
    return 'document';
  },

  // Extract text from PDF
  async extractPDFText(file: File): Promise<ProcessedFlier> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfParse.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      // Try to extract title (usually first meaningful line)
      const lines = fullText.split('\n').filter((l) => l.trim().length > 5);
      const title = lines[0]?.substring(0, 100) || undefined;

      return {
        text: fullText.substring(0, 5000),
        title,
        description: lines.slice(1, 3).join(' ').substring(0, 500),
        extracted: true,
      };
    } catch (error) {

      return {
        text: '',
        extracted: false,
      };
    }
  },

  // Resize image to invite dimensions
  async resizeImage(file: File): Promise<ProcessedImage> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = INVITE_WIDTH;
          canvas.height = INVITE_HEIGHT;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }

          // Calculate scaling to cover the canvas (object-cover behavior)
          const scaleX = INVITE_WIDTH / img.width;
          const scaleY = INVITE_HEIGHT / img.height;
          const scale = Math.max(scaleX, scaleY);

          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const offsetX = (INVITE_WIDTH - scaledWidth) / 2;
          const offsetY = (INVITE_HEIGHT - scaledHeight) / 2;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, INVITE_WIDTH, INVITE_HEIGHT);
          ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Blob conversion failed'));
                return;
              }

              const url = URL.createObjectURL(blob);
              resolve({
                url,
                width: INVITE_WIDTH,
                height: INVITE_HEIGHT,
                resized: true,
                mimeType: 'image/jpeg',
              });
            },
            'image/jpeg',
            0.9
          );
        };

        img.onerror = () => reject(new Error('Image loading failed'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  },

  // Process file based on type
  async processFile(
    file: File
  ): Promise<{ flier?: ProcessedFlier; image?: ProcessedImage; error?: string }> {
    try {
      const category = this.getFileCategory(file);

      if (category === 'image') {
        const image = await this.resizeImage(file);
        return { image };
      }

      if (category === 'flier') {
        const flier = await this.extractPDFText(file);
        return { flier };
      }

      return { error: 'Unsupported file type' };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'File processing failed',
      };
    }
  },

  // Compress image for upload
  async compressImage(
    dataUrl: string,
    quality: number = 0.8
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            resolve(blob || new Blob());
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Image loading failed'));
      img.src = dataUrl;
    });
  },
};
