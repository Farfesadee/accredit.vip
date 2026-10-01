"""Generate animated banner GIFs for email invitations."""

from PIL import Image, ImageDraw, ImageFont
import io
import os

PHRASES = [
    "Create Your Own Event",
    "Send Branded Invites",
    "Generate QR Codes",
    "Track Attendance",
]

BRAND_PINK = "#E91E8C"
BRAND_DARK = "#0D1B2A"


def generate_animated_logo_gif(output_path: str = None, include_button: bool = True) -> bytes:
    """
    Generate an animated GIF of the Accredit.vip logo with fade in/out effect and optional CTA button.
    Both logo and button fade in/out together for maximum impact.

    Args:
        output_path: Optional path to save the GIF file
        include_button: If True, includes "Create Your Event" button below logo

    Returns the GIF as bytes if output_path is None, otherwise saves to file.
    """
    frames = []
    frame_duration = 80  # milliseconds per frame

    # Image dimensions - logo will be centered
    width, height = 600, 280 if include_button else 200
    bg_color = (255, 255, 255)  # White background

    # Load logo
    logo = None
    try:
        import os as os_module
        logo_path = os_module.path.join(
            os_module.path.dirname(os_module.path.dirname(os_module.path.dirname(__file__))),
            "..", "frontend", "public", "logo.png"
        )
        if os_module.path.exists(logo_path):
            logo = Image.open(logo_path).convert("RGBA")
            # Resize logo to fit nicely in email (width ~280px)
            logo_width = 280
            aspect_ratio = logo.height / logo.width
            logo_height = int(logo_width * aspect_ratio)
            logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)
    except Exception as e:
        print(f"Warning: Could not load logo: {e}")
        return b""

    if not logo:
        return b""

    def draw_button_on_frame(frame: Image.Image, opacity: int, draw: ImageDraw.ImageDraw) -> None:
        """Helper to draw the CTA button with the given opacity"""
        if not include_button:
            return

        # Button dimensions and colors
        button_width = 240
        button_height = 50
        button_color_rgb = (233, 30, 140)  # Pink from accredit.vip brand
        button_x = (width - button_width) // 2
        button_y = 200

        # Create button with opacity
        button_alpha = int(255 * (opacity / 255))

        # Draw button background (rounded rectangle approximation)
        draw.rounded_rectangle(
            [(button_x, button_y), (button_x + button_width, button_y + button_height)],
            radius=8,
            fill=(*button_color_rgb, button_alpha)
        )

        # Draw button text
        try:
            font = ImageFont.truetype("arial.ttf", 16)
        except:
            font = ImageFont.load_default()

        button_text = "Create Your Event"
        bbox = draw.textbbox((0, 0), button_text, font=font)
        text_width = bbox[2] - bbox[0]
        text_x = button_x + (button_width - text_width) // 2
        text_y = button_y + (button_height - (bbox[3] - bbox[1])) // 2

        draw.text((text_x, text_y), button_text, fill=(255, 255, 255, button_alpha), font=font)

    # Create fade in effect (frames 0-20: opacity 0->100%)
    for i in range(21):
        frame = Image.new("RGB", (width, height), color=bg_color)
        draw = ImageDraw.Draw(frame, "RGBA")

        # Calculate opacity (0-255)
        opacity = int(255 * (i / 20))

        # Create a version of the logo with the current opacity
        logo_with_opacity = logo.copy()

        # Adjust alpha channel for the fade effect
        if logo_with_opacity.mode == "RGBA":
            r, g, b, a = logo_with_opacity.split()
            a = a.point(lambda x: int(x * opacity / 255))
            logo_with_opacity.putalpha(a)

        # Center the logo
        logo_x = (width - logo.width) // 2
        logo_y = 30

        # Paste logo onto frame
        frame.paste(logo_with_opacity, (logo_x, logo_y), logo_with_opacity)

        # Draw button if included
        draw_button_on_frame(frame, opacity, draw)

        frames.append(frame)

    # Hold full opacity for 1 second (12 frames at 80ms)
    for _ in range(12):
        frame = Image.new("RGB", (width, height), color=bg_color)
        draw = ImageDraw.Draw(frame, "RGBA")

        logo_x = (width - logo.width) // 2
        logo_y = 30
        frame.paste(logo, (logo_x, logo_y), logo)

        draw_button_on_frame(frame, 255, draw)
        frames.append(frame)

    # Create fade out effect (frames 20->0: opacity 100->0%)
    for i in range(20, -1, -1):
        frame = Image.new("RGB", (width, height), color=bg_color)
        draw = ImageDraw.Draw(frame, "RGBA")

        # Calculate opacity (255->0)
        opacity = int(255 * (i / 20))

        # Create a version of the logo with the current opacity
        logo_with_opacity = logo.copy()

        # Adjust alpha channel for the fade effect
        if logo_with_opacity.mode == "RGBA":
            r, g, b, a = logo_with_opacity.split()
            a = a.point(lambda x: int(x * opacity / 255))
            logo_with_opacity.putalpha(a)

        # Center the logo
        logo_x = (width - logo.width) // 2
        logo_y = 30

        # Paste logo onto frame
        frame.paste(logo_with_opacity, (logo_x, logo_y), logo_with_opacity)

        # Draw button if included
        draw_button_on_frame(frame, opacity, draw)

        frames.append(frame)

    # Brief pause before looping
    for _ in range(3):
        frame = Image.new("RGB", (width, height), color=bg_color)
        frames.append(frame)

    # Save as GIF
    if frames:
        gif_buffer = io.BytesIO()
        frames[0].save(
            gif_buffer,
            format="GIF",
            save_all=True,
            append_images=frames[1:],
            duration=frame_duration,
            loop=0,  # Infinite loop
            optimize=False
        )
        gif_buffer.seek(0)

        if output_path:
            with open(output_path, "wb") as f:
                f.write(gif_buffer.getvalue())

        return gif_buffer.getvalue()

    return b""


def generate_animated_banner_gif(output_path: str = None) -> bytes:
    """
    Generate an animated GIF banner with typewriter effect for the Accredit.vip motion banner.
    Shows "Join" text with logo, then features appearing character by character.

    Returns the GIF as bytes if output_path is None, otherwise saves to file.
    """
    frames = []
    frame_duration = 100  # milliseconds per frame

    # Image dimensions
    width, height = 600, 120
    bg_gradient_start = (233, 30, 140)  # Pink
    bg_gradient_end = (196, 22, 111)    # Dark pink
    text_color_rgb = (255, 255, 255)    # White

    # Try to load logo
    logo = None
    try:
        import os as os_module
        logo_path = os_module.path.join(
            os_module.path.dirname(os_module.path.dirname(os_module.path.dirname(__file__))),
            "..", "frontend", "public", "logo-white.png"
        )
        if os_module.path.exists(logo_path):
            logo = Image.open(logo_path).convert("RGBA")
            # Resize logo to fit in banner (height ~30px with padding)
            logo_height = 30
            aspect_ratio = logo.width / logo.height
            logo_width = int(logo_height * aspect_ratio)
            logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)
    except Exception as e:
        print(f"Warning: Could not load logo: {e}")

    phrase_index = 0
    current_phrase = PHRASES[phrase_index]

    # Phase 1: Type out text character by character
    for char_count in range(len(current_phrase) + 1):
        frame = Image.new("RGB", (width, height), color=bg_gradient_start)
        draw = ImageDraw.Draw(frame)

        # Try to load a nice font, fall back to default
        try:
            font = ImageFont.truetype("arial.ttf", 36)
            small_font = ImageFont.truetype("arial.ttf", 14)
        except:
            font = ImageFont.load_default()
            small_font = ImageFont.load_default()

        # Draw gradient effect (simple horizontal gradient by drawing lines)
        for x in range(width):
            r = int(bg_gradient_start[0] + (bg_gradient_end[0] - bg_gradient_start[0]) * x / width)
            g = int(bg_gradient_start[1] + (bg_gradient_end[1] - bg_gradient_start[1]) * x / width)
            b = int(bg_gradient_start[2] + (bg_gradient_end[2] - bg_gradient_start[2]) * x / width)
            draw.line([(x, 0), (x, height)], fill=(r, g, b))

        # Draw "Join" text and logo
        join_text = "Join "
        bbox = draw.textbbox((0, 0), join_text, font=small_font)
        join_width = bbox[2] - bbox[0]

        # Calculate positions for "Join" + logo
        logo_width_px = logo.width if logo else 0
        total_width = join_width + logo_width_px + 5  # 5px gap
        start_x = (width - total_width) // 2

        # Draw "Join" text
        draw.text(
            (start_x, 50),
            join_text,
            fill=text_color_rgb,
            font=small_font
        )

        # Draw logo if available
        if logo:
            logo_frame = Image.new("RGB", frame.size, color=bg_gradient_start)
            logo_frame.paste(logo, (start_x + join_width + 5, 45), logo)
            frame = Image.composite(logo_frame, frame, Image.new("L", frame.size, 0))

        # Draw typing text
        typing_text = current_phrase[:char_count]
        bbox = draw.textbbox((0, 0), typing_text, font=font)
        text_width = bbox[2] - bbox[0]
        draw.text(
            ((width - text_width) // 2, 55),
            typing_text,
            fill=text_color_rgb,
            font=font
        )

        # Add cursor
        if char_count < len(current_phrase):
            cursor_x = (width // 2) + (text_width // 2) + 5
            draw.line([(cursor_x, 55), (cursor_x, 85)], fill=text_color_rgb, width=2)

        frames.append(frame)

    # Phase 2: Hold the complete text for 2 seconds (20 frames at 100ms)
    for _ in range(20):
        frame = Image.new("RGB", (width, height), color=bg_gradient_start)
        draw = ImageDraw.Draw(frame)

        # Draw gradient
        for x in range(width):
            r = int(bg_gradient_start[0] + (bg_gradient_end[0] - bg_gradient_start[0]) * x / width)
            g = int(bg_gradient_start[1] + (bg_gradient_end[1] - bg_gradient_start[1]) * x / width)
            b = int(bg_gradient_start[2] + (bg_gradient_end[2] - bg_gradient_start[2]) * x / width)
            draw.line([(x, 0), (x, height)], fill=(r, g, b))

        # Draw "Join" and logo
        join_text = "Join "
        bbox = draw.textbbox((0, 0), join_text, font=small_font)
        join_width = bbox[2] - bbox[0]
        logo_width_px = logo.width if logo else 0
        total_width = join_width + logo_width_px + 5
        start_x = (width - total_width) // 2

        draw.text((start_x, 50), join_text, fill=text_color_rgb, font=small_font)
        if logo:
            logo_frame = Image.new("RGB", frame.size, color=bg_gradient_start)
            logo_frame.paste(logo, (start_x + join_width + 5, 45), logo)
            frame = Image.composite(logo_frame, frame, Image.new("L", frame.size, 0))

        bbox = draw.textbbox((0, 0), current_phrase, font=font)
        text_width = bbox[2] - bbox[0]
        draw.text(
            ((width - text_width) // 2, 85),
            current_phrase,
            fill=text_color_rgb,
            font=font
        )

        frames.append(frame)

    # Phase 3: Delete text character by character
    for char_count in range(len(current_phrase), -1, -1):
        frame = Image.new("RGB", (width, height), color=bg_gradient_start)
        draw = ImageDraw.Draw(frame)

        # Draw gradient
        for x in range(width):
            r = int(bg_gradient_start[0] + (bg_gradient_end[0] - bg_gradient_start[0]) * x / width)
            g = int(bg_gradient_start[1] + (bg_gradient_end[1] - bg_gradient_start[1]) * x / width)
            b = int(bg_gradient_start[2] + (bg_gradient_end[2] - bg_gradient_start[2]) * x / width)
            draw.line([(x, 0), (x, height)], fill=(r, g, b))

        # Draw "Join" and logo
        join_text = "Join "
        bbox = draw.textbbox((0, 0), join_text, font=small_font)
        join_width = bbox[2] - bbox[0]
        logo_width_px = logo.width if logo else 0
        total_width = join_width + logo_width_px + 5
        start_x = (width - total_width) // 2

        draw.text((start_x, 50), join_text, fill=text_color_rgb, font=small_font)
        if logo:
            logo_frame = Image.new("RGB", frame.size, color=bg_gradient_start)
            logo_frame.paste(logo, (start_x + join_width + 5, 45), logo)
            frame = Image.composite(logo_frame, frame, Image.new("L", frame.size, 0))

        typing_text = current_phrase[:char_count]
        if typing_text:
            bbox = draw.textbbox((0, 0), typing_text, font=font)
            text_width = bbox[2] - bbox[0]
            draw.text(
                ((width - text_width) // 2, 85),
                typing_text,
                fill=text_color_rgb,
                font=font
            )

        frames.append(frame)

    # Phase 4: Pause before next phrase
    for _ in range(5):
        frame = Image.new("RGB", (width, height), color=bg_gradient_start)
        draw = ImageDraw.Draw(frame)
        for x in range(width):
            r = int(bg_gradient_start[0] + (bg_gradient_end[0] - bg_gradient_start[0]) * x / width)
            g = int(bg_gradient_start[1] + (bg_gradient_end[1] - bg_gradient_start[1]) * x / width)
            b = int(bg_gradient_start[2] + (bg_gradient_end[2] - bg_gradient_start[2]) * x / width)
            draw.line([(x, 0), (x, height)], fill=(r, g, b))

        # Draw "Join" and logo during pause
        join_text = "Join "
        bbox = draw.textbbox((0, 0), join_text, font=small_font)
        join_width = bbox[2] - bbox[0]
        logo_width_px = logo.width if logo else 0
        total_width = join_width + logo_width_px + 5
        start_x = (width - total_width) // 2

        draw.text((start_x, 50), join_text, fill=text_color_rgb, font=small_font)
        if logo:
            logo_frame = Image.new("RGB", frame.size, color=bg_gradient_start)
            logo_frame.paste(logo, (start_x + join_width + 5, 45), logo)
            frame = Image.composite(logo_frame, frame, Image.new("L", frame.size, 0))

        frames.append(frame)

    # Save as GIF
    if frames:
        gif_buffer = io.BytesIO()
        frames[0].save(
            gif_buffer,
            format="GIF",
            save_all=True,
            append_images=frames[1:],
            duration=frame_duration,
            loop=0,  # Infinite loop
            optimize=False
        )
        gif_buffer.seek(0)

        if output_path:
            with open(output_path, "wb") as f:
                f.write(gif_buffer.getvalue())

        return gif_buffer.getvalue()

    return b""
