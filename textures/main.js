// --- Block Rotation Detector WebApp (AI removed) ---
// Uses OpenCV.js for all image processing

let inputCanvas, outputCanvas, inputCtx, outputCtx;
let imgElement = null;
let srcMat = null;
let warpedMat = null;
let points = [];
let dragging = false;
let dragPointIndex = -1;
let lastSelectedPoint = -1;
let pointRadius = 10;
let pointSize = 8;
let lineThickness = 2;
let pointMoveStep = 5;
let gridSquares = [];
let squareSize = 0;
let squareDst = null;
let cleanWarpedCanvas = null;

let magnifiedCanvas, magnifiedCtx;
let magnifiedView;
let magnificationLevel = 4;

let squareTexts = {}; // Stores labels for grid squares

function appInit() {
    inputCanvas = document.getElementById('inputCanvas');
    outputCanvas = document.getElementById('outputCanvas');
    inputCtx = inputCanvas.getContext('2d');
    outputCtx = outputCanvas.getContext('2d');

    magnifiedCanvas = document.getElementById('magnifiedCanvas');
    magnifiedCtx = magnifiedCanvas.getContext('2d');
    magnifiedView = document.getElementById('magnifiedView');

    const magnifierSizeSlider = document.getElementById('magnifierSizeSlider');
    const updateMagnifierSize = () => {
        const sizeMultiplier = parseInt(magnifierSizeSlider.value, 10);
        magnifiedCanvas.width = sizeMultiplier * 4;
        magnifiedCanvas.height = sizeMultiplier * 3;
        if (lastSelectedPoint >= 0 && lastSelectedPoint < points.length) {
            const [x, y] = points[lastSelectedPoint];
            updateMagnifiedView(x, y);
        }
    };

    magnifierSizeSlider.addEventListener('input', updateMagnifierSize);
    updateMagnifierSize();

    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    document.getElementById('generateBtn').addEventListener('click', handleGenerate);
    document.addEventListener('keydown', handleKeyDown);
    inputCanvas.addEventListener('mousedown', handleMouseDown);
    inputCanvas.addEventListener('mousemove', handleMouseMove);
    inputCanvas.addEventListener('mouseup', handleMouseUp);
    inputCanvas.addEventListener('mouseleave', handleMouseUp);
    inputCanvas.addEventListener('mousemove', handleInputMouseMove);
    outputCanvas.addEventListener('mousedown', handleOutputCanvasClick);

    loadSavedImage();
    preventInputFieldKeyPropagation();
}

function showMessageBox(message) {
    const messageBox = document.createElement('div');
    messageBox.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    messageBox.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-lg text-white max-w-sm text-center">
            <p class="mb-4">${message}</p>
            <button onclick="this.parentNode.parentNode.remove()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                OK
            </button>
        </div>
    `;
    document.body.appendChild(messageBox);
}

if (typeof cv !== 'undefined' && cv.onRuntimeInitialized) {
    cv.onRuntimeInitialized = () => {
        appInit();
    };
} else if (typeof cv !== 'undefined') {
    appInit();
} else {
    console.error("OpenCV.js not found or not initialized.");
    showMessageBox("Error: OpenCV.js is not loaded. Image processing features will not work.");
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        imgElement = new window.Image();
        imgElement.onload = function() {
            setupImage();
            localStorage.setItem('blockDetector_image', ev.target.result);
        };
        imgElement.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function setupImage() {
    inputCanvas.width = imgElement.width;
    inputCanvas.height = imgElement.height;
    outputCanvas.width = imgElement.width + 100;
    outputCanvas.height = imgElement.height + 100;

    if (srcMat) srcMat.delete();
    srcMat = cv.imread(imgElement);

    let savedPoints = localStorage.getItem('blockDetector_points');
    if (savedPoints) {
        try {
            points = JSON.parse(savedPoints);
            let validPoints = true;
            for (let point of points) {
                if (point[0] < 0 || point[0] > imgElement.width || 
                    point[1] < 0 || point[1] > imgElement.height) {
                    validPoints = false;
                    break;
                }
            }
            if (!validPoints || points.length !== 4) {
                points = getDefaultPoints();
            }
        } catch (e) {
            points = getDefaultPoints();
        }
    } else {
        points = getDefaultPoints();
    }

    lastSelectedPoint = 0;
    dragging = false;
    dragPointIndex = -1;
    drawInput();
    applyPerspectiveTransform();
    magnifiedView.style.display = 'flex';
    updateMagnifiedView(imgElement.width / 2, imgElement.height / 2);
}

function getDefaultPoints() {
    return [
        [30, 30],
        [imgElement.width - 30, 30],
        [imgElement.width - 30, imgElement.height - 30],
        [30, imgElement.height - 30]
    ];
}

function savePoints() {
    if (points.length === 4) {
        localStorage.setItem('blockDetector_points', JSON.stringify(points));
    }
}

function drawInput() {
    inputCtx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
    inputCtx.drawImage(imgElement, 0, 0);

    inputCtx.strokeStyle = 'lime';
    inputCtx.lineWidth = lineThickness;
    inputCtx.beginPath();
    for (let i = 0; i < points.length; ++i) {
        let p1 = points[i];
        let p2 = points[(i + 1) % points.length];
        inputCtx.moveTo(p1[0], p1[1]);
        inputCtx.lineTo(p2[0], p2[1]);
    }
    inputCtx.stroke();

    for (let i = 0; i < points.length; ++i) {
        let [x, y] = points[i];
        inputCtx.beginPath();
        inputCtx.arc(x, y, pointSize + (i === lastSelectedPoint ? 2 : 0), 0, 2 * Math.PI);
        inputCtx.fillStyle = i === lastSelectedPoint ? 'red' : 'lime';
        inputCtx.fill();
        inputCtx.font = '14px Arial';
        inputCtx.fillStyle = 'white';
        inputCtx.fillText((i + 1).toString(), x + 8, y + 8);
        if (i === lastSelectedPoint) {
            inputCtx.fillText('*', x - 14, y - 10);
        }
    }
    savePoints();

    if (lastSelectedPoint >= 0 && lastSelectedPoint < points.length) {
        let [x, y] = points[lastSelectedPoint];
        updateMagnifiedView(x, y);
    }
}

function handleMouseDown(e) {
    if (!imgElement) return;
    const rect = inputCanvas.getBoundingClientRect();
    const scaleX = inputCanvas.width / rect.width;
    const scaleY = inputCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (e.shiftKey || e.ctrlKey || e.altKey) return;

    const heldKey = Object.keys(keyStates).find(key => key >= '1' && key <= '4' && keyStates[key]);
    if (heldKey) {
        const pointIndex = parseInt(heldKey) - 1;
        if (pointIndex < points.length) {
            points[pointIndex] = [x, y];
            lastSelectedPoint = pointIndex;
            drawInput();
            if (points.length === 4) {
                applyPerspectiveTransform();
            }
        }
        return;
    }

    drawInput();
    inputCtx.save();
    inputCtx.strokeStyle = 'magenta';
    inputCtx.lineWidth = 2;
    inputCtx.beginPath();
    inputCtx.moveTo(x - 8, y); inputCtx.lineTo(x + 8, y);
    inputCtx.moveTo(x, y - 8); inputCtx.lineTo(x, y + 8);
    inputCtx.stroke();
    inputCtx.beginPath();
    inputCtx.arc(x, y, 4, 0, 2 * Math.PI);
    inputCtx.stroke();
    inputCtx.restore();

    for (let i = 0; i < points.length; ++i) {
        let [px, py] = points[i];
        if (Math.hypot(x - px, y - py) <= pointSize + 2) {
            lastSelectedPoint = i;
            drawInput();
            dragging = true;
            dragPointIndex = i;
            return;
        }
    }

    if (points.length < 4) {
        points.push([x, y]);
        lastSelectedPoint = points.length - 1;
        drawInput();
        if (points.length === 4) {
            applyPerspectiveTransform();
        }
    }
}

function handleMouseMove(e) {
    if (!imgElement || !dragging || dragPointIndex === -1) return;
    const rect = inputCanvas.getBoundingClientRect();
    const scaleX = inputCanvas.width / rect.width;
    const scaleY = inputCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    points[dragPointIndex] = [x, y];
    drawInput();
}

function handleMouseUp(e) {
    dragging = false;
    if (dragPointIndex !== -1) lastSelectedPoint = dragPointIndex;
    if (points.length === 4) {
        applyPerspectiveTransform();
    }
    dragPointIndex = -1;
}

function handleKeyDown(e) {
    if (!imgElement || lastSelectedPoint === -1) return;
    let [x, y] = points[lastSelectedPoint];
    let changed = false;
    if (e.key === 'w' || e.key === 'W') { y -= pointMoveStep; changed = true; }
    if (e.key === 's' || e.key === 'S') { y += pointMoveStep; changed = true; }
    if (e.key === 'a' || e.key === 'A') { x -= pointMoveStep; changed = true; }
    if (e.key === 'd' || e.key === 'D') { x += pointMoveStep; changed = true; }
    if (e.key >= '1' && e.key <= '4') {
        let idx = parseInt(e.key) - 1;
        if (idx < points.length) {
            lastSelectedPoint = idx;
            drawInput();
            let [newX, newY] = points[lastSelectedPoint];
            updateMagnifiedView(newX, newY);
        }
        return;
    }
    if (e.key === '+' || e.key === '=') { pointMoveStep = Math.min(10, pointMoveStep + 1); return; }
    if (e.key === '-') { pointMoveStep = Math.max(1, pointMoveStep - 1); return; }
    if (e.key === 'r' || e.key === 'R') { resetPoints(); return; }
    if (changed) {
        points[lastSelectedPoint] = [x, y];
        drawInput();
        if (points.length === 4) {
            applyPerspectiveTransform();
        }
    }
}

function resetPoints() {
    if (!imgElement) return;
    points = getDefaultPoints();
    lastSelectedPoint = 0;
    squareTexts = {};
    drawInput();
    drawGridOverlay();
    applyPerspectiveTransform();
}

function loadSavedImage() {
    const savedImage = localStorage.getItem('blockDetector_image');
    if (savedImage) {
        imgElement = new window.Image();
        imgElement.onload = function() {
            setupImage();
        };
        imgElement.src = savedImage;
    }
}

function applyPerspectiveTransform() {
    if (!imgElement || points.length !== 4) {
        outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        cleanWarpedCanvas = null;
        return;
    }
    let cx = (points[0][0] + points[1][0] + points[2][0] + points[3][0]) / 4;
    let cy = (points[0][1] + points[1][1] + points[2][1] + points[3][1]) / 4;
    let sideLengths = [
        Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]),
        Math.hypot(points[2][0] - points[1][0], points[2][1] - points[1][1]),
        Math.hypot(points[3][0] - points[2][0], points[3][1] - points[2][1]),
        Math.hypot(points[0][0] - points[3][0], points[0][1] - points[3][1])
    ];
    let avgSide = sideLengths.reduce((a, b) => a + b, 0) / 4;
    let halfSide = avgSide / 2;
    let padding = 50;
    let dst = [
        [cx + padding - halfSide, cy + padding - halfSide],
        [cx + padding + halfSide, cy + padding - halfSide],
        [cx + padding + halfSide, cy + padding + halfSide],
        [cx + padding - halfSide, cy + padding + halfSide]
    ];
    squareDst = dst;
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, points.flat());
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, dst.flat());
    let dsize = new cv.Size(imgElement.width + 2 * padding, imgElement.height + 2 * padding);
    if (warpedMat) warpedMat.delete();
    warpedMat = new cv.Mat();
    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(srcMat, warpedMat, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    srcTri.delete();
    dstTri.delete();
    M.delete();

    cv.imshow(outputCanvas, warpedMat);
    cleanWarpedCanvas = document.createElement('canvas');
    cleanWarpedCanvas.width = outputCanvas.width;
    cleanWarpedCanvas.height = outputCanvas.height;
    let cleanCtx = cleanWarpedCanvas.getContext('2d');
    cleanCtx.drawImage(outputCanvas, 0, 0);
    drawGridOverlay();
}

function handleOutputCanvasClick(e) {
    if (e.button !== 0) return;
    if (!cleanWarpedCanvas || !squareDst) {
        logger.warn("Cannot handle click: missing warped canvas or square destination");
        return;
    }

    const rect = outputCanvas.getBoundingClientRect();
    const scaleX = outputCanvas.width / rect.width;
    const scaleY = outputCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let squarePoints = squareDst.map(pt => [Math.round(pt[0]), Math.round(pt[1])]);
    let avgSide = Math.hypot(squarePoints[1][0] - squarePoints[0][0], squarePoints[1][1] - squarePoints[0][1]);
    let sSize = Math.round(avgSide);

    let gridOriginX = squarePoints[0][0];
    let gridOriginY = squarePoints[0][1];

    let i = Math.floor((x - gridOriginX) / sSize);
    let j = Math.floor((y - gridOriginY) / sSize);

    let tlx = gridOriginX + i * sSize;
    let tly = gridOriginY + j * sSize;
    let brx = tlx + sSize;
    let bry = tly + sSize;

    if (tlx < 0 || tly < 0 || brx > outputCanvas.width || bry > outputCanvas.height) {
        logger.debug(`Click outside valid grid area: (${x}, ${y}) -> grid (${i}, ${j})`);
        return;
    }

    let squareKey = `${i},${j}`;

    if (squareTexts[squareKey]) {
        logger.info(`Removing existing identification for square (${i},${j}): ${squareTexts[squareKey]}`);
        delete squareTexts[squareKey];
        drawGridOverlay();
        return;
    }

    logger.info(`Starting identification for square at grid (${i},${j})`);
    identifySquare(i, j, tlx, tly, sSize).then(label => {
        if (label) {
            squareTexts[squareKey] = label;
            logger.info(`Successfully identified square (${i},${j}) as ${label}`);
            drawGridOverlay();
            drawInput();
        } else {
            logger.warn(`Failed to identify square (${i},${j})`);
        }
    }).catch(error => {
        logger.error(`Error during square identification (${i},${j}): ${error.message}`);
    });
}

const referenceImages = {};
const blockType = 'grass'; // default type

// Enhanced logging system
const logger = {
    log: (message, level = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        console.log(`${prefix} ${message}`);
    },
    info: (message) => logger.log(message, 'info'),
    warn: (message) => logger.log(message, 'warn'),
    error: (message) => logger.log(message, 'error'),
    debug: (message) => logger.log(message, 'debug')
};

// Load 4 reference images at startup
function loadReferenceImages() {
    logger.info(`Loading reference images for block type: ${blockType}`);
    
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `/blocks/${blockType}/${i}.png`;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            referenceImages[i] = ctx.getImageData(0, 0, img.width, img.height);
            logger.debug(`Loaded reference image ${i}: ${img.width}x${img.height} pixels`);
        };
        img.onerror = () => {
            logger.error(`Failed to load reference image ${i}: ${img.src}`);
        };
    }
}
loadReferenceImages();

// Initialize logging
logger.info("Texture rotation detection system initialized");
logger.info("Enhanced pixel matching with similarity comparison enabled");
logger.debug("Available similarity metrics: SSIM, NCC, Pixel Similarity, Pixelmatch");

function toGrayscale(imageData) {
    const data = imageData.data;
    const gray = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
        const avg = 0.3 * data[i] + 0.59 * data[i+1] + 0.11 * data[i+2];
        gray[i] = gray[i+1] = gray[i+2] = avg;
        gray[i+3] = 255;
    }
    return new ImageData(gray, imageData.width, imageData.height);
}

// Advanced similarity calculation functions
function calculateImageStats(imageData) {
    const data = imageData.data;
    let sum = 0, sumSq = 0;
    const pixelCount = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.3 * data[i] + 0.59 * data[i+1] + 0.11 * data[i+2];
        sum += gray;
        sumSq += gray * gray;
    }
    
    const mean = sum / pixelCount;
    const variance = (sumSq / pixelCount) - (mean * mean);
    const stdDev = Math.sqrt(variance);
    
    return { mean, stdDev, pixelCount };
}

function calculateSSIM(img1Data, img2Data) {
    if (img1Data.width !== img2Data.width || img1Data.height !== img2Data.height) {
        return 0; // Cannot compare images of different sizes
    }
    
    const stats1 = calculateImageStats(img1Data);
    const stats2 = calculateImageStats(img2Data);
    
    const data1 = img1Data.data;
    const data2 = img2Data.data;
    let covariance = 0;
    
    for (let i = 0; i < data1.length; i += 4) {
        const gray1 = 0.3 * data1[i] + 0.59 * data1[i+1] + 0.11 * data1[i+2];
        const gray2 = 0.3 * data2[i] + 0.59 * data2[i+1] + 0.11 * data2[i+2];
        covariance += (gray1 - stats1.mean) * (gray2 - stats2.mean);
    }
    covariance /= stats1.pixelCount;
    
    // SSIM constants
    const c1 = 0.01 * 255 * 0.01 * 255;
    const c2 = 0.03 * 255 * 0.03 * 255;
    
    const ssim = ((2 * stats1.mean * stats2.mean + c1) * (2 * covariance + c2)) /
                 ((stats1.mean * stats1.mean + stats2.mean * stats2.mean + c1) * 
                  (stats1.stdDev * stats1.stdDev + stats2.stdDev * stats2.stdDev + c2));
    
    return Math.max(0, Math.min(1, ssim));
}

function calculateNormalizedCrossCorrelation(img1Data, img2Data) {
    if (img1Data.width !== img2Data.width || img1Data.height !== img2Data.height) {
        return 0;
    }
    
    const stats1 = calculateImageStats(img1Data);
    const stats2 = calculateImageStats(img2Data);
    
    const data1 = img1Data.data;
    const data2 = img2Data.data;
    let correlation = 0;
    
    for (let i = 0; i < data1.length; i += 4) {
        const gray1 = 0.3 * data1[i] + 0.59 * data1[i+1] + 0.11 * data1[i+2];
        const gray2 = 0.3 * data2[i] + 0.59 * data2[i+1] + 0.11 * data2[i+2];
        correlation += (gray1 - stats1.mean) * (gray2 - stats2.mean);
    }
    
    const denominator = Math.sqrt(stats1.stdDev * stats1.stdDev * stats1.pixelCount) * 
                       Math.sqrt(stats2.stdDev * stats2.stdDev * stats2.pixelCount);
    
    return denominator === 0 ? 0 : Math.max(-1, Math.min(1, correlation / denominator));
}

function calculatePixelSimilarity(img1Data, img2Data) {
    if (img1Data.width !== img2Data.width || img1Data.height !== img2Data.height) {
        return 0;
    }
    
    const data1 = img1Data.data;
    const data2 = img2Data.data;
    let totalDiff = 0;
    const maxDiff = 255 * Math.sqrt(3); // Maximum possible RGB difference
    
    for (let i = 0; i < data1.length; i += 4) {
        const dr = data1[i] - data2[i];
        const dg = data1[i+1] - data2[i+1];
        const db = data1[i+2] - data2[i+2];
        const pixelDiff = Math.sqrt(dr*dr + dg*dg + db*db);
        totalDiff += pixelDiff / maxDiff;
    }
    
    const avgDiff = totalDiff / (data1.length / 4);
    return Math.max(0, 1 - avgDiff); // Convert to similarity (0-1)
}

function resizeImageData(imageData, targetWidth, targetHeight) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Create source canvas
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = imageData.width;
    sourceCanvas.height = imageData.height;
    sourceCanvas.getContext('2d').putImageData(imageData, 0, 0);
    
    // Resize to target
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    
    return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

function identifySquare(i, j, x, y, size) {
    return new Promise((resolve) => {
        logger.debug(`Identifying square at grid (${i},${j}), pixel coords (${x},${y}), size: ${size}`);
        
        try {
            const ctx = cleanWarpedCanvas.getContext('2d');
            const squareImage = ctx.getImageData(x, y, size, size);
            logger.debug(`Extracted square image: ${squareImage.width}x${squareImage.height}`);

            let bestMatch = null;
            let highestSimilarity = -1;
            let matchDetails = [];

            for (let index in referenceImages) {
                const ref = referenceImages[index];
                if (!ref) {
                    logger.warn(`Reference image ${index} is not loaded`);
                    continue;
                }

                // Resize square to match reference dimensions for accurate comparison
                const resizedSquare = resizeImageData(squareImage, ref.width, ref.height);
                const refGray = toGrayscale(ref);
                const squareGray = toGrayscale(resizedSquare);

                // Calculate multiple similarity metrics
                const ssim = calculateSSIM(refGray, squareGray);
                const ncc = calculateNormalizedCrossCorrelation(refGray, squareGray);
                const pixelSim = calculatePixelSimilarity(ref, resizedSquare);
                
                // Fallback to pixelmatch for pixel difference count
                const diff = new Uint8ClampedArray(ref.width * ref.height * 4);
                const numDiffPixels = pixelmatch(
                    refGray.data, squareGray.data, diff,
                    ref.width, ref.height,
                    { threshold: 0.1 }
                );
                const pixelMatchSim = Math.max(0, 1 - (numDiffPixels / (ref.width * ref.height)));

                // Weighted combined similarity score
                const combinedSimilarity = (
                    0.4 * ssim +           // Structural similarity (most important)
                    0.3 * Math.abs(ncc) +  // Normalized cross-correlation
                    0.2 * pixelSim +       // Pixel-wise similarity
                    0.1 * pixelMatchSim    // Legacy pixel match
                );

                const details = {
                    index: parseInt(index),
                    ssim: (ssim * 100).toFixed(1),
                    ncc: (ncc * 100).toFixed(1),
                    pixelSim: (pixelSim * 100).toFixed(1),
                    pixelMatch: (pixelMatchSim * 100).toFixed(1),
                    combined: (combinedSimilarity * 100).toFixed(1),
                    diffPixels: numDiffPixels
                };
                
                matchDetails.push(details);
                logger.debug(`Reference ${index}: SSIM=${details.ssim}%, NCC=${details.ncc}%, PixelSim=${details.pixelSim}%, Combined=${details.combined}%`);

                if (combinedSimilarity > highestSimilarity) {
                    highestSimilarity = combinedSimilarity;
                    bestMatch = index;
                }
            }

            // Sort match details by combined similarity for logging
            matchDetails.sort((a, b) => parseFloat(b.combined) - parseFloat(a.combined));
            
            if (bestMatch !== null) {
                const confidence = (highestSimilarity * 100).toFixed(1);
                const result = `${bestMatch} (${confidence}%)`;
                
                logger.info(`Square (${i},${j}) identified as rotation ${bestMatch} with ${confidence}% confidence`);
                logger.debug(`Top 3 matches: ${matchDetails.slice(0, 3).map(d => `${d.index}:${d.combined}%`).join(', ')}`);
                
                // Warn if confidence is low
                if (highestSimilarity < 0.6) {
                    logger.warn(`Low confidence match for square (${i},${j}): ${confidence}%`);
                }
                
                resolve(result);
            } else {
                logger.warn(`No suitable match found for square (${i},${j})`);
                resolve(null);
            }
            
        } catch (error) {
            logger.error(`Error identifying square (${i},${j}): ${error.message}`);
            resolve(null);
        }
    });
}


function drawGridOverlay() {
    if (!warpedMat) return;
    let ctx = outputCtx;
    ctx.save();

    if (cleanWarpedCanvas) {
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        ctx.drawImage(cleanWarpedCanvas, 0, 0);
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'lime';

    let squarePoints = squareDst.map(pt => [Math.round(pt[0]), Math.round(pt[1])]);
    let avgSide = Math.hypot(squarePoints[1][0] - squarePoints[0][0], squarePoints[1][1] - squarePoints[0][1]);
    squareSize = Math.round(avgSide);

    let w = outputCanvas.width;
    let h = outputCanvas.height;

    for (let y = squarePoints[0][1]; y < h; y += squareSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    for (let y = squarePoints[0][1]; y > 0; y -= squareSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    for (let x = squarePoints[0][0]; x > 0; x -= squareSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let x = squarePoints[1][0]; x < w; x += squareSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; ++i) {
        let p1 = squarePoints[i];
        let p2 = squarePoints[(i + 1) % 4];
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
    }
    ctx.stroke();

    for (let key in squareTexts) {
        let [i, j] = key.split(',').map(Number);
        let tlx = squarePoints[0][0] + i * squareSize;
        let tly = squarePoints[0][1] + j * squareSize;
        let centerX = tlx + squareSize / 2;
        let centerY = tly + squareSize / 2;
        let fontSize = Math.round((3 / 4) * squareSize / ((squareTexts[key].length) * 2));
        let maxLabelWidth = (5 / 7) * squareSize;

        // Set main label font and measure
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = 'yellow';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // If label is too wide, shrink font size to fit
        let label = squareTexts[key];
        let measured = ctx.measureText(label);
        while (measured.width > maxLabelWidth && fontSize > 8) {
            fontSize -= 1;
            ctx.font = `${fontSize}px Arial`;
            measured = ctx.measureText(label);
        }
        ctx.fillText(label, centerX, centerY - 0.2 * squareSize, maxLabelWidth);

        // Coordinates: 4/5 of font size
        let coordFontSize = Math.round((4 / 5) * fontSize);
        ctx.font = `${coordFontSize}px Arial`;
        ctx.fillStyle = 'cyan';
        ctx.fillText(`(${i},${j})`, centerX, centerY + 0.2 * squareSize);
    }
    ctx.restore();
}

function updateMagnifiedView(x, y) {
    if (!imgElement || !magnifiedCanvas) return;

    const zoom = magnificationLevel;
    const magnifiedWidth = magnifiedCanvas.width;
    const magnifiedHeight = magnifiedCanvas.height;

    const sourceWidth = magnifiedWidth / zoom;
    const sourceHeight = magnifiedHeight / zoom;
    const sourceX = Math.max(0, Math.min(x - sourceWidth / 2, imgElement.width - sourceWidth));
    const sourceY = Math.max(0, Math.min(y - sourceHeight / 2, imgElement.height - sourceHeight));

    magnifiedCtx.clearRect(0, 0, magnifiedWidth, magnifiedHeight);
    magnifiedCtx.drawImage(
        imgElement,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, magnifiedWidth, magnifiedHeight
    );

    magnifiedCtx.strokeStyle = 'red';
    magnifiedCtx.lineWidth = 2;
    magnifiedCtx.beginPath();
    magnifiedCtx.moveTo(magnifiedWidth / 2 - 10, magnifiedHeight / 2);
    magnifiedCtx.lineTo(magnifiedWidth / 2 + 10, magnifiedHeight / 2);
    magnifiedCtx.moveTo(magnifiedWidth / 2, magnifiedHeight / 2 - 10);
    magnifiedCtx.lineTo(magnifiedWidth / 2, magnifiedHeight / 2 + 10);
    magnifiedCtx.stroke();

    document.getElementById('magnifiedCoords').textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
}

document.getElementById('magnificationSlider').addEventListener('input', (e) => {
    magnificationLevel = parseInt(e.target.value, 10);
    if (lastSelectedPoint >= 0 && lastSelectedPoint < points.length) {
        const [x, y] = points[lastSelectedPoint];
        updateMagnifiedView(x, y);
    }
});

function handleInputMouseMove(e) {
    if (!imgElement) return;
    if (lastSelectedPoint === -1 || dragging) {
        const rect = inputCanvas.getBoundingClientRect();
        const scaleX = inputCanvas.width / rect.width;
        const scaleY = inputCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        updateMagnifiedView(x, y);
    }
}

function preventInputFieldKeyPropagation() {
    const coordinateInputs = document.querySelectorAll('.coordinate-inputs input');
    coordinateInputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
    });
}

let keyStates = {};

document.addEventListener('keydown', (e) => {
    keyStates[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    delete keyStates[e.key];
});

function handleGenerate() {
    const generationType = document.getElementById('generationType').value;
    const orientation = document.getElementById('orientation').value;
    const { relativeX, relativeY, relativeZ } = getCoordinateInputs();
    // Get the state of the direction correction checkbox
    const directionCorrectionEnabled = document.getElementById('directionCorrectionCheckbox')?.checked ?? true;
    generateRaw(orientation, generationType, relativeX, relativeY, relativeZ, directionCorrectionEnabled);
}

// Place your existing generateRaw() function here if used


// Function to retrieve numerical values from relative coordinate input fields
function getCoordinateInputs() {
    const relativeX = parseFloat(document.getElementById('relativeX').value) || 0;
    const relativeY = parseFloat(document.getElementById('relativeY').value) || 0;
    const relativeZ = parseFloat(document.getElementById('relativeZ').value) || 0;

    return { relativeX, relativeY, relativeZ };
}

function generateRaw(orientation = 'wall', type = 'raw', relativeX, relativeY, relativeZ, directionCorrectionEnabled = true) {
    if (!squareDst || Object.keys(squareTexts).length === 0) {
        showMessageBox('No detected squares found. Please click on some squares in the warped output to run detection first.');
        return;
    }

    // Determine separator based on output type
    const separator = type === 'spaced' ? ' ' : ',';

    // Calculate min/max grid indices to determine the extent of the detected area
    let minI = Infinity, maxI = -Infinity;
    let minJ = Infinity, maxJ = -Infinity;

    for (let key in squareTexts) {
        let [i, j] = key.split(',').map(Number);
        minI = Math.min(minI, i);
        maxI = Math.max(maxI, i);
        minJ = Math.min(minJ, j);
        maxJ = Math.max(maxJ, j);
    }

    // Calculate the center of the detected grid for centering logic
    let centerI = Math.floor((minI + maxI) / 2);
    let centerJ = Math.floor((minJ + maxJ) / 2);

    let output = ''; // String to build the final generated output
    let formationText = ''; // Temporary formation text for direction detection

    // First pass: Generate formation.add lines for direction detection
    for (let key in squareTexts) {
        let [i, j] = key.split(',').map(Number); // Current square's grid indices
        let detectedClass = squareTexts[key].split(' ')[0]; // Extract class from "Class (Confidence%)"

        let finalCoordX; // Final X coordinate for output
        let finalCoordY; // Final Y coordinate for output
        let finalCoordZ; // Final Z coordinate for output
        let isWallForRotationInfo; // Boolean for RotationInfo constructor

        // Conditional logic for coordinates based on type and orientation
        if (type === 'rotationinfo' && orientation === 'ground') {
            // Special case: RotationInfo + Ground -> use raw i, j for X, Z
            finalCoordX = i;
            finalCoordY = 0; // Y for ground is a fixed offset, currently 0
            finalCoordZ = j;
            isWallForRotationInfo = false;
        } else {
            // General case: use centered coordinates relative to the detected grid's center
            let x_centered = i
            let y_centered = j
            let fixed_offset_dimension = 0; // The fixed offset for the third dimension (wall's Z or ground's Y)

            if (orientation === 'ground') {
                finalCoordX = x_centered;
                finalCoordY = fixed_offset_dimension;
                finalCoordZ = y_centered; // For ground, the 'y_centered' from grid becomes the Z-axis
                isWallForRotationInfo = false;
            } else { // orientation === 'wall'
                finalCoordX = x_centered;
                finalCoordY = y_centered; // For wall, the 'y_centered' from grid becomes the Y-axis
                finalCoordZ = fixed_offset_dimension;
                isWallForRotationInfo = true;
            }
        }

        // Apply relative offsets to the calculated coordinates
        finalCoordX += relativeX;
        finalCoordY += relativeY;
        finalCoordZ += relativeZ;

        // Build formation text for direction detection
        formationText += `formation.add(new RotationInfo(${finalCoordX}, ${finalCoordY}, ${finalCoordZ}, ${detectedClass}, ${isWallForRotationInfo}));\n`;
    }

    // Detect the cluster facing direction
    logger.debug("Performing cluster direction detection...");
    const detectedDirection = determineClusterFacing(formationText);
    logger.info(`Detected direction: ${detectedDirection || 'None'}`);

    // Second pass: Generate final output with adjusted coordinates
    for (let key in squareTexts) {
        let [i, j] = key.split(',').map(Number); // Current square's grid indices
        let detectedClass = squareTexts[key].split(' ')[0]; // Extract class from "Class (Confidence%)"

        let finalCoordX; // Final X coordinate for output
        let finalCoordY; // Final Y coordinate for output
        let finalCoordZ; // Final Z coordinate for output
        let isWallForRotationInfo; // Boolean for RotationInfo constructor

        // Conditional logic for coordinates based on type and orientation
        if (type === 'rotationinfo' && orientation === 'ground') {
            // Special case: RotationInfo + Ground -> use raw i, j for X, Z
            finalCoordX = i;
            finalCoordY = 0; // Y for ground is a fixed offset, currently 0
            finalCoordZ = j;
            isWallForRotationInfo = false;
        } else {
            // General case: use centered coordinates relative to the detected grid's center
            let x_centered = i
            let y_centered = j
            let fixed_offset_dimension = 0; // The fixed offset for the third dimension (wall's Z or ground's Y)

            if (orientation === 'ground') {
                finalCoordX = x_centered;
                finalCoordY = fixed_offset_dimension;
                finalCoordZ = y_centered; // For ground, the 'y_centered' from grid becomes the Z-axis
                isWallForRotationInfo = false;
            } else { // orientation === 'wall'
                finalCoordX = x_centered;
                finalCoordY = y_centered; // For wall, the 'y_centered' from grid becomes the Y-axis
                finalCoordZ = fixed_offset_dimension;
                isWallForRotationInfo = true;
            }
        }

        // Apply relative offsets to the calculated coordinates
        finalCoordX += relativeX;
        finalCoordY += relativeY;
        finalCoordZ += relativeZ;

        // Adjust coordinates based on detected direction (only for X and Z)
        if (directionCorrectionEnabled && detectedDirection && detectedDirection !== "North") {
            [finalCoordX, finalCoordZ] = adjustCoordinatesForDirection(finalCoordX, finalCoordZ, detectedDirection);
        }

        // Construct the output string based on the selected generation type
        if (type === 'raw') {
            output += `${finalCoordX}${separator}${finalCoordY}${separator}${finalCoordZ}${separator}${detectedClass}\n`;
        } else if (type === 'rotationinfo') {
            output += `formation.add(new RotationInfo(${finalCoordX}, ${finalCoordY}, ${finalCoordZ}, ${detectedClass}, ${isWallForRotationInfo}));\n`;
        }
    }

    // Display the generated output in the dedicated section
    
    const directionInfo = detectedDirection ? ` (Adjusted for ${detectedDirection} facing)` : '';
    const title = `${orientation.charAt(0).toUpperCase() + orientation.slice(1)} ${type.charAt(0).toUpperCase() + type.slice(1)} Data${directionInfo}`;
    if (directionCorrectionEnabled) {
    displayGeneratedOutput(output, title);
    } else {
        displayGeneratedOutput(output,' ');
    }
    logger.info(`Generated ${type} data for ${orientation} orientation with ${Object.keys(squareTexts).length} squares`);
    logger.debug(`Generated data preview: ${output.substring(0, 200)}${output.length > 200 ? '...' : ''}`);
}

function displayGeneratedOutput(output, title) {
    // Get or create the output display div
    let outputDisplay = document.getElementById('generatedOutput');
    if (!outputDisplay) {
        outputDisplay = document.createElement('div');
        outputDisplay.id = 'generatedOutput';
        outputDisplay.className = 'generated-output';
        document.querySelector('.generate-section').appendChild(outputDisplay);
    }
    
    // Populate the output display with the generated text and a download button
    outputDisplay.innerHTML = `
        <h4>${title}</h4>
        <div class="code-block">
            <pre><code>${output}</code></pre>
        </div>
        <button onclick="downloadGeneratedOutput('${output.replace(/\n/g, '\\n')}', 'detected_squares.txt')" class="download-btn">
            Download as .txt
        </button>
    `;
}

function downloadGeneratedOutput(content, filename) {
    // Create a Blob from the content
    const blob = new Blob([content], { type: 'text/plain' });
    // Create a URL for the Blob
    const url = URL.createObjectURL(blob);
    // Create a temporary anchor element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // Append to body to ensure it's in the DOM for click
    a.click(); // Programmatically click the anchor to start download
    document.body.removeChild(a); // Clean up the temporary element
    URL.revokeObjectURL(url); // Release the Blob URL
}

document.addEventListener('keydown', (e) => {
    keyStates[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    delete keyStates[e.key];
});

// Prevents keyboard events from input fields from affecting canvas controls
function preventInputFieldKeyPropagation() {
    const coordinateInputs = document.querySelectorAll('.coordinate-inputs input');
    coordinateInputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Stop the event from bubbling up to the document
        });
    });
}

// Call this function during app initialization to set up input field key handlers
// document.addEventListener('DOMContentLoaded', () => { // This is handled by appInit call within opencv.js runtime check
//     preventInputFieldKeyPropagation();
// });

// --- Direction Detection Functions (ported from Python) ---
const DIRECTIONS = ["North", "West", "South", "East"]; // 0, 1, 2, 3

function parseFormationAddLines(formationText) {
    const blocks = [];
    const pattern = /formation\.add\(new RotationInfo\(\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(\d+),\s*(true|false)\s*\)\);/g;
    
    let match;
    while ((match = pattern.exec(formationText)) !== null) {
        const x = parseInt(match[1]);
        const y = parseInt(match[2]);
        const z = parseInt(match[3]);
        const rot = parseInt(match[4]);
        blocks.push({
            x: x,
            y: y,
            z: z,
            rot: rot % 4
        });
    }
    
    return blocks;
}

function unrotate(x, z, rot) {
    rot = rot % 4;
    if (rot === 0) { // North
        return [x, z];
    } else if (rot === 1) { // West
        return [-z, x];
    } else if (rot === 2) { // South
        return [-x, -z];
    } else if (rot === 3) { // East
        return [z, -x];
    }
}

function findOriginBlock(blocks) {
    for (const block of blocks) {
        const [unrotX, unrotZ] = unrotate(block.x, block.z, block.rot);
        if (unrotX === 0 && unrotZ === 0) {
            return block;
        }
    }
    return null;
}

function determineClusterFacing(formationText) {
    logger.debug("Starting cluster facing direction detection");
    const blocks = parseFormationAddLines(formationText);
    
    if (blocks.length === 0) {
        logger.warn("No blocks found in formation text");
        return null;
    }
    
    logger.info(`Found ${blocks.length} blocks for direction analysis`);
    logger.debug("--- Scanned Blocks ---");
    for (const b of blocks) {
        logger.debug(`Block at (${b.x}, ${b.z}) rotation ${b.rot}`);
    }
    
    const originBlock = findOriginBlock(blocks);
    
    if (originBlock === null) {
        logger.warn("Could not find a block that originated at (0,0).");
        return null;
    }
    
    const scannedRotation = originBlock.rot % 4;
    const facing = DIRECTIONS[scannedRotation];
    
    logger.info(`Cluster facing direction detected: ${facing} (rotation ${scannedRotation})`);
    logger.debug(`Origin block found at (${originBlock.x}, ${originBlock.z}) with rotation ${originBlock.rot}`);
    return facing;
}

function adjustCoordinatesForDirection(x, z, detectedDirection) {
    // Convert coordinates based on detected direction
    // Assuming North is the default (neg z, pos x)
    switch (detectedDirection) {
        case "North": // Default, no change needed
            return [x, z];
        case "West": // Rotate 90 degrees counterclockwise
            return [z, -x];
        case "South": // Rotate 180 degrees
            return [-x, -z];
        case "East": // Rotate 90 degrees clockwise
            return [-z, x];
        default:
            return [x, z]; // Default to North if unknown
    }
}
