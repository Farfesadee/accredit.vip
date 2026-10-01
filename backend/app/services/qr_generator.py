"""Generate styled QR codes with embedded images and dominant color extraction."""

import io
import base64
from typing import Optional, Tuple
from PIL import Image, ImageDraw
import qrcode


def extract_dominant_color(image_data: bytes) -> str:
    """Extract dominant color from image data (bytes).

    Returns hex color string (e.g., '#E91E8C').
    Falls back to default pink if extraction fails.
    """
    try:
        img = Image.open(io.BytesIO(image_data))
        img = img.convert('RGB')

        # Resize for faster processing
        img.thumbnail((150, 150))

        # Get pixel data
        pixels = list(img.getdata())

        if not pixels:
            return '#E91E8C'  # Default fallback

        # Calculate average color
        r = sum(p[0] for p in pixels) // len(pixels)
        g = sum(p[1] for p in pixels) // len(pixels)
        b = sum(p[2] for p in pixels) // len(pixels)

        # Convert to hex
        return f'#{r:02x}{g:02x}{b:02x}'.upper()
    except Exception as e:
        print(f"Error extracting dominant color: {e}")
        return '#E91E8C'  # Default fallback


def generate_styled_qr(
    qr_value: str,
    image_data: bytes,
    size: int = 300,
) -> str:
    """Generate a styled QR code with embedded image and dominant color.

    Args:
        qr_value: The data to encode in the QR code
        image_data: Image bytes to embed in the center
        size: QR code size in pixels (default 300)

    Returns:
        Base64 encoded PNG image string
    """
    try:
        # Extract dominant color
        dominant_color_hex = extract_dominant_color(image_data)
        # Convert hex to RGB tuple
        dominant_color = tuple(int(dominant_color_hex[i:i+2], 16) for i in (1, 3, 5))

        # Create QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(qr_value)
        qr.make(fit=True)

        # Create image with dominant color
        qr_img = qr.make_image(
            fill_color=dominant_color,
            back_color='white'
        ).convert('RGB')

        # Resize to desired size
        qr_img = qr_img.resize((size, size), Image.Resampling.LANCZOS)

        # Add rounded corners to QR code
        qr_img = add_rounded_corners(qr_img, radius=30)

        # Prepare embedded image
        try:
            embedded_img = Image.open(io.BytesIO(image_data))
            embedded_img = embedded_img.convert('RGBA')

            # Size the embedded image (about 25-30% of QR code)
            embed_size = int(size * 0.27)
            embedded_img.thumbnail((embed_size, embed_size), Image.Resampling.LANCZOS)

            # Add white background to embedded image
            white_bg = Image.new('RGBA', (embed_size + 8, embed_size + 8), 'white')
            embed_offset = ((white_bg.width - embedded_img.width) // 2,
                          (white_bg.height - embedded_img.height) // 2)
            white_bg.paste(embedded_img, embed_offset, embedded_img)

            # Add rounded corners to embedded image
            white_bg = add_rounded_corners(white_bg.convert('RGB'), radius=8)

            # Paste embedded image into center of QR code
            qr_img = qr_img.convert('RGBA')
            embed_offset = ((qr_img.width - white_bg.width) // 2,
                          (qr_img.height - white_bg.height) // 2)
            qr_img.paste(white_bg, embed_offset, white_bg if white_bg.mode == 'RGBA' else None)
            qr_img = qr_img.convert('RGB')
        except Exception as e:
            print(f"Warning: Failed to embed image: {e}")
            # Continue with just the colored QR code
            pass

        # Convert to PNG bytes
        img_io = io.BytesIO()
        qr_img.save(img_io, format='PNG', optimize=True)
        img_io.seek(0)

        # Return as base64
        return base64.b64encode(img_io.getvalue()).decode('utf-8')

    except Exception as e:
        print(f"Error generating styled QR code: {e}")
        # Fallback: generate plain QR without styling
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_H,
                box_size=10,
                border=2,
            )
            qr.add_data(qr_value)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color='black', back_color='white').resize((size, size))

            img_io = io.BytesIO()
            qr_img.save(img_io, format='PNG', optimize=True)
            img_io.seek(0)

            return base64.b64encode(img_io.getvalue()).decode('utf-8')
        except Exception as fallback_e:
            print(f"Error generating fallback QR code: {fallback_e}")
            raise


def add_rounded_corners(img: Image.Image, radius: int = 20) -> Image.Image:
    """Add rounded corners to an image.

    Args:
        img: PIL Image to process
        radius: Corner radius in pixels

    Returns:
        Image with rounded corners
    """
    try:
        # Create a new image with alpha channel
        img_with_alpha = Image.new('RGBA', img.size, (0, 0, 0, 0))

        # Paste the original image
        if img.mode == 'RGBA':
            img_with_alpha = img
        else:
            img_with_alpha.paste(img, (0, 0))

        # Create a mask with rounded corners
        mask = Image.new('L', img.size, 0)
        draw = ImageDraw.Draw(mask)

        # Draw rounded rectangle
        draw.rounded_rectangle(
            [(0, 0), img.size],
            radius=radius,
            fill=255
        )

        # Apply the mask
        img_with_alpha.putalpha(mask)

        # Convert back to RGB if needed
        final_img = Image.new('RGB', img.size, 'white')
        final_img.paste(img_with_alpha, (0, 0), img_with_alpha)

        return final_img
    except Exception as e:
        print(f"Warning: Failed to add rounded corners: {e}")
        return img
