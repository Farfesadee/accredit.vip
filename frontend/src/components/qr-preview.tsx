"use client";

import { QRCodeSVG } from "qrcode.react";

interface QRPreviewProps {
  qrValue: string;
  imageUrl?: string | null;
  size?: number;
}

export function QRPreview({ qrValue, imageUrl, size = 200 }: QRPreviewProps) {
  return (
    <div className="inline-flex items-center justify-center p-2 bg-white rounded-lg">
      <QRCodeSVG value={qrValue} size={size} level="M" includeMargin />
    </div>
  );
}
