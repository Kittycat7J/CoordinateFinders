from PIL import Image
import os
import json

# === CONFIG ===
IMAGE_FOLDER = "blocks"              # folder containing your images
OUTPUT_JSON = "block_colors.json"      # file to save the results

def average_color(image_path):
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        pixels = list(img.getdata())
        num_pixels = len(pixels)
        avg_r = sum([p[0] for p in pixels]) / num_pixels
        avg_g = sum([p[1] for p in pixels]) / num_pixels
        avg_b = sum([p[2] for p in pixels]) / num_pixels
        return [round(avg_r), round(avg_g), round(avg_b)]

def main():
    result = []
    for filename in os.listdir(IMAGE_FOLDER):
        if filename.lower().endswith((".png", ".jpg", ".jpeg")):
            path = os.path.join(IMAGE_FOLDER, filename)
            avg = average_color(path)
            result.append({
                "filename": filename,
                "avg_color": avg,
                "type": filename.split(".")[0]   # e.g. use filename as type
            })

    with open(OUTPUT_JSON, "w") as f:
        json.dump(result, f, indent=4)

if __name__ == "__main__":
    main()
