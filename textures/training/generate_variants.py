from PIL import Image
import numpy as np
import os
import sys

# === CONFIG ===
INPUT_IMAGE_PATH = "input.png"  # Update this
OUTPUT_DIR = "./output"
IMAGE_SIZE = (64, 64)
VARIATIONS_PER_DIRECTION = 16
MAX_SHIFT = 8  # Max shift in pixels (corresponds to ~8 degrees)
DIRECTIONS = [
    "top", "bottom", "left", "right",
    "top_left", "top_right", "bottom_left", "bottom_right"
]

FLIP_TYPES = {
    0: None,
    1: Image.FLIP_LEFT_RIGHT,
    2: Image.FLIP_TOP_BOTTOM,
    3: "both"
}

# === UTILITIES ===

def get_quad_coords(direction, shift):
    w, h = IMAGE_SIZE
    coords = [0, 0, w, 0, w, h, 0, h]  # TL, TR, BR, BL

    if direction == "top":
        coords[1] += shift  # TL.y
        coords[3] += shift  # TR.y
    elif direction == "bottom":
        coords[5] -= shift  # BR.y
        coords[7] -= shift  # BL.y
    elif direction == "left":
        coords[0] += shift  # TL.x
        coords[6] += shift  # BL.x
    elif direction == "right":
        coords[2] -= shift  # TR.x
        coords[4] -= shift  # BR.x
    elif direction == "top_left":
        coords[0] += shift; coords[1] += shift  # TL
    elif direction == "top_right":
        coords[2] -= shift; coords[3] += shift  # TR
    elif direction == "bottom_right":
        coords[4] -= shift; coords[5] -= shift  # BR
    elif direction == "bottom_left":
        coords[6] += shift; coords[7] -= shift  # BL

    return tuple(coords)

def apply_skew(img, direction, shift):
    src_quad = (0, 0, IMAGE_SIZE[0], 0, IMAGE_SIZE[0], IMAGE_SIZE[1], 0, IMAGE_SIZE[1])
    dst_quad = get_quad_coords(direction, shift)
    return img.transform(IMAGE_SIZE, Image.QUAD, dst_quad, Image.BICUBIC)

def apply_flip(img, flip_type):
    if flip_type == "diagonal":
        return img.transpose(Image.TRANSPOSE)  # Flip over y = x
    return img  # No flip if flip_type is not "diagonal"

def apply_rotation(img, rotation_type):
    if "--alt" in sys.argv:
        if rotation_type == 0:
            return img  # 0 degrees
        elif rotation_type == 1:
            return img.transpose(Image.FLIP_LEFT_RIGHT)  # Flip left to right
        elif rotation_type == 2:
            return img.rotate(-180, expand=True)  # 180 degrees
        elif rotation_type == 3:
            flipped = img.transpose(Image.FLIP_LEFT_RIGHT)  # Flip left to right
            return flipped.rotate(-180, expand=True)  # 180 degrees
    else:
        if rotation_type == 0:
            return img  # 0 degrees
        elif rotation_type == 1:
            return img.rotate(-90, expand=True)  # 90 degrees clockwise
        elif rotation_type == 2:
            return img.rotate(-180, expand=True)  # 180 degrees
        elif rotation_type == 3:
            return img.rotate(-270, expand=True)  # 270 degrees clockwise

# === MAIN ===

# Load and resize input
img = Image.open(INPUT_IMAGE_PATH).convert("L").resize(IMAGE_SIZE)  # Convert to grayscale

# Make output folders
for class_id in range(4):
    os.makedirs(os.path.join(OUTPUT_DIR, f"class_{class_id}"), exist_ok=True)

# Generate variations
for class_id in range(4):
    rotated = apply_rotation(img, class_id)  # Apply rotation based on class ID

    count = 0
    for direction in DIRECTIONS:
        for step in range(VARIATIONS_PER_DIRECTION + 1):
            shift = int(MAX_SHIFT * step / VARIATIONS_PER_DIRECTION)
            skewed = apply_skew(rotated, direction, shift)
            flipped = apply_flip(skewed, "diagonal")
            out_path = os.path.join(OUTPUT_DIR, f"class_{class_id}", f"img_{count:03}({class_id}).png")
            flipped.save(out_path)
            count += 1
