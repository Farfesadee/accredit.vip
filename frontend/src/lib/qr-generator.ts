import QRCodeStyling from 'qr-code-styling';
import { FastAverageColor } from 'fast-average-color';

export async function getDominantColor(imageUrl: string): Promise<string> {
  try {
    const fac = new FastAverageColor();
    const color = await fac.getColorAsync(imageUrl);
    return color.hex;
  } catch (error) {
    return '#1ABC9C'; // Fallback to brand color
  }
}

export async function generateQRWithImage(
  qrValue: string,
  imageUrl: string,
  dominantColor?: string
): Promise<string> {
  try {
    const color = dominantColor || await getDominantColor(imageUrl);

    const qrCode = new QRCodeStyling({
      width: 300,
      height: 300,
      data: qrValue,
      image: imageUrl,
      dotsOptions: {
        color: color,
        type: 'rounded',
      },
      cornersSquareOptions: {
        color: color,
        type: 'extra-rounded',
      },
      cornersDotOptions: {
        color: color,
        type: 'square',
      },
      backgroundOptions: {
        color: '#ffffff',
      },
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: 10,
        imageSize: 80,
      },
    });

    return new Promise((resolve, reject) => {
      qrCode.getRawData('png').then((raw) => {
        if (raw) {
          const url = URL.createObjectURL(raw as Blob);
          resolve(url);
        } else {
          reject(new Error('Failed to generate QR code'));
        }
      }).catch(reject);
    });
  } catch (error) {
    throw error;
  }
}

export function generateSimpleQRWithImage(
  qrValue: string,
  imageUrl: string,
  dominantColor: string
): QRCodeStyling {
  return new QRCodeStyling({
    width: 300,
    height: 300,
    data: qrValue,
    image: imageUrl,
    dotsOptions: {
      color: dominantColor,
      type: 'rounded',
    },
    cornersSquareOptions: {
      color: dominantColor,
      type: 'extra-rounded',
    },
    cornersDotOptions: {
      color: dominantColor,
      type: 'square',
    },
    backgroundOptions: {
      color: '#ffffff',
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 10,
      imageSize: 80,
    },
  });
}
