let vantaEffect = null;
let currentEffect = 'FOG';
let lastColor = [182, 182, 182]; // Default color


const availableEffects = {
    WAVES: VANTA.WAVES,
    NET: VANTA.NET,
    FOG: VANTA.FOG,
    BIRDS: VANTA.BIRDS,
    CLOUDS2: VANTA.CLOUDS2,
    HALO: VANTA.HALO
};


const effectOptions = {
    WAVES: { el: "#vanta-bg", shininess: 40, waveHeight: 18, waveSpeed: 0.8, zoom: 0.9 },
    NET: { el: "#vanta-bg", backgroundAlpha: 0.08, color: 0x3fa4ff, pointsX: 12, pointsY: 8, smoothCycles: 0.25, spacing: 18 },
    FOG: { el: "#vanta-bg", color: 0x2b71b8, fogColor: 0x0c0c0c, speed: 0.8, zoom: 0.85 },
    BIRDS: { el: "#vanta-bg", color: 0x7199ff, backgroundAlpha: 0.0, quantity: 2, birdSize: 12, speed: 1.2,wingSpan: 28,separation: 15,mouseControls: true,touchControls: true,gyroControls: false,minHeight: 200.0,minWidth: 200.0,scale: 0.2,scaleMobile: 1.0},
    CLOUDS2: { el: "#vanta-bg",   mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 1.00,
        texturePath: "https://www.vantajs.com/gallery/noise.png",},
    HALO: { el: "#vanta-bg",
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00
          }
};

function getDominantColor(imgElement, callback) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const width = canvas.width = imgElement.naturalWidth || imgElement.width;
    const height = canvas.height = imgElement.naturalHeight || imgElement.height;

    context.drawImage(imgElement, 0, 0, width, height);
    try {
        const imageData = context.getImageData(0, 0, width, height).data;
        const colorCounts = {};
        let dominantColor = [0, 0, 0];
        let maxCount = 0;

        for (let i = 0; i < imageData.length; i += 4 * 10) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const a = imageData[i + 3];

            // Skip pixels that are mostly transparent
            if (a < 128) continue;

            const brightness = (r + g + b) / 3;
            // Skip very bright and very dark pixels
            if (brightness > 220 || brightness < 20) continue;

            const rgb = `${r},${g},${b}`;
            colorCounts[rgb] = (colorCounts[rgb] || 0) + 1;

            if (colorCounts[rgb] > maxCount) {
                maxCount = colorCounts[rgb];
                dominantColor = [r, g, b];
            }
        }

        // Visualize the dominant color
        //visualizeDominantColor(dominantColor);

        callback(dominantColor);
    } catch (error) {
        console.error("Error getting dominant color:", error);
        callback([182, 182, 182]); // Return default color on error
    }
}

function visualizeDominantColor(color) {
    const colorBox = document.getElementById('dominantColorBox');
    if (!colorBox) {
        // Create a new color box if it doesn't exist
        const box = document.createElement('div');
        box.id = 'dominantColorBox';
        box.style.position = 'fixed';
        box.style.bottom = '10px';
        box.style.right = '10px';
        box.style.width = '50px';
        box.style.height = '50px';
        box.style.border = '2px solid #000';
        box.style.zIndex = '1000';
        document.body.appendChild(box);
    }
    // Update the color box background
    document.getElementById('dominantColorBox').style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function startVanta(effectName = 'WAVES', color = [182, 182, 182]) {
    if (vantaEffect) {
        vantaEffect.destroy();
    }

    const toHex = ([r, g, b]) => (r << 16) + (g << 8) + b;

    const adjustColor = (col, amount) =>
        col.map((c, i) => Math.max(0, Math.min(255, c + amount[i])));

    const calculateBrightness = (col) => (col[0] + col[1] + col[2]) / 3;

    const options = {
        ...effectOptions[effectName],
        el: "#vanta-bg"
    };

    if (effectName === 'FOG') {
        // Calculate brightness of the dominant color
        const brightness = calculateBrightness(color);
    
        // Apply more aggressive adjustments based on brightness
        const adjustment = brightness > 180 ? -120 : brightness < 80 ? 60 : 0;
    
        const highlight = adjustColor(color, [255 + adjustment, 255 + adjustment, 255 + adjustment]); // Aggressively brighten
        const lowlight = adjustColor(color, [-255 + adjustment, -255 + adjustment, -255 + adjustment]); // Aggressively darken
        console.log("Highlight:", highlight, "Lowlight:", lowlight); // Debugging output
    
        options.highlightColor = toHex(highlight); // Brighter highlights
        options.midtoneColor = toHex(color); // Keep the midtone as the dominant color
        options.lowlightColor = toHex(lowlight); // Darker lowlights
        options.baseColor = toHex(color); // Base color remains the dominant color
        options.backgroundColor = toHex(adjustColor(color, [-50, -50, -50])); // Darker background for contrast
    } else {
        options.color = toHex(color);
        
    }

    vantaEffect = availableEffects[effectName](options);
}

function setupEffectDropdown() {
    const dropdown = document.getElementById('effectDropdown');
    dropdown.addEventListener('change', (event) => {
        const selectedEffect = event.target.value;
        if (availableEffects[selectedEffect]) {
            currentEffect = selectedEffect;
            startVanta(selectedEffect, lastColor);
        } else {
            console.error('Invalid effect selected:', selectedEffect);
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    setupEffectDropdown();
    startVanta(); // Initialize Vanta with the default effect
});