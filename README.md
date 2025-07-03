# CoordinateFinders

CoordinateFinders is a web-based toolkit for deducing Minecraft world coordinates from screenshots—without needing the F3 debug screen. It provides tools for both **cloud pattern matching** and **block texture rotation analysis**, enabling users to reverse-engineer coordinates using in-game visual cues.

## Features

- **Cloud Pattern Finder:**  
  Estimate Z and Y coordinates by matching cloud patterns in screenshots to the Minecraft cloud texture.  
  - Supports different Minecraft versions (25w20a- and 25w21a+).
  - Input your observed cloud pattern to get possible coordinate matches.

- **Texture Rotation Classifier:**  
  Use AI to detect block texture rotations (e.g., grass, stone) in screenshots and infer possible world coordinates.  
  - Upload a screenshot, mark the area, and let the tool analyze block rotations.
  - Supports ground blocks (grass, etc.) for Minecraft 1.8+.
  - Export rotation data for use in coordinate-finding tools.

- **Training and Data Generation Scripts:**  
  Python scripts for generating training data and training new AI models for block rotation detection.

## Usage

### Online Tools

- **Home:** Overview and navigation.
- **Clouds:**  
  1. Enter your observed cloud pattern (using 0, 1, and ? for unknowns).
  2. Select the correct Minecraft version.
  3. Get estimated Z coordinates and pixel locations in the cloud texture.

- **Textures:**  
  1. Upload a screenshot.
  2. Adjust the perspective grid to match the in-game area.
  3. Click grid squares to run AI detection on block textures.
  4. Export rotation info for further analysis.

### Training Your Own Models

See [`textures/usage.md`](textures/usage.md) for detailed instructions:
- Generate data with `generate_variants.py`.
- Train models with `train.py`.
- Export trained models to TensorFlow.js format for use in the web app.

## Credits

- **xVoid879:** Project lead, web development, cloudfinder port.
- **grumm3057/Kittycat7J:** Idea, support, HTML/JS for texture rotations, data generation.
- **encryptal:** AI code for texture rotation, dataset expansion.
- **fanda857:** Provided datasets for AI training.
- **edd:** Original cloudfinder.
- **19MisterX98:** Program for finding valid coordinates from rotation info.

See the [Credits page](credits/index.html) for more details.

## License

Copyright xVoid879 2025  
All rights reserved.  
This software is proprietary and confidential. Unauthorized copying, redistribution, modification, or use of any part of this software is strictly prohibited without prior written permission from the author.

---

**For more information, see the [website](https://coordinatefinders.netlify.app/) or the [GitHub repository](https://github.com/xVoid879/CoordinateFinders).**

- _readme by cursor AI because I couldnt be bothered_