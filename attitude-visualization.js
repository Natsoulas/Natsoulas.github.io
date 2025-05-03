console.log("************ ATTITUDE VISUALIZATION START ************");
console.log("Script tag loaded and executing");

// Flag to track initialization state
let initialized = false;

// Load THREE directly
let THREE;

// Add a timeout mechanism for loading
let loadingTimeout;

// Add WebGL detection function before loadThreeJS
function checkWebGLSupport() {
    try {
        const canvas = document.createElement('canvas');
        return !!(
            window.WebGLRenderingContext && 
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        );
    } catch (e) {
        return false;
    }
}

// Replace the loadThreeJS function with a more robust version that tries multiple CDNs
async function loadThreeJS() {
    console.log("Loading THREE.js...");
    const container = document.getElementById('attitude-visualization');
    showLoading();
    
    // Check WebGL support first
    if (!checkWebGLSupport()) {
        console.error("WebGL not supported in this browser");
        showError(container, `
            Your browser doesn't seem to support WebGL, which is required for 3D graphics.
            Please try a different browser, such as Chrome or Firefox.
        `, false);
        return;
    }
    
    // Set a timeout to break out of loading if it takes too long
    clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
        console.error("Loading timeout exceeded - THREE.js initialization is taking too long");
        if (!initialized) {
            showError(container, `
                Visualization loading timed out. This could be due to browser performance issues
                or an error during initialization. Please try reloading the page.
            `);
        }
    }, 15000); // 15 second timeout
    
    // Define multiple CDN sources to try in sequence
    const cdnSources = [
        'https://unpkg.com/three@0.128.0/build/three.module.js',
        'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js',
        'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js',
        // Fall back to older version if needed
        'https://unpkg.com/three@0.126.0/build/three.module.js',
    ];
    
    let loadSuccess = false;
    
    // Try each CDN source in sequence
    for (const source of cdnSources) {
        try {
            console.log(`Attempting to import THREE.js from: ${source}`);
            const module = await import(source);
            THREE = module;
            console.log("THREE.js loaded successfully from:", source);
            
            // Initialize THREE-dependent variables
            if (angularVelocity === null) {
                angularVelocity = new THREE.Vector3(0, 0, 0);
                console.log("Initialized angularVelocity with THREE.Vector3");
            }
            
            loadSuccess = true;
            break; // Exit the loop on successful load
        } catch (error) {
            console.warn(`Failed to load THREE.js from ${source}:`, error);
            // Continue to next source
        }
    }
    
    if (!loadSuccess) {
        console.error("Failed to load THREE.js from all sources");
        clearTimeout(loadingTimeout);
        showError(container, `
            Could not load THREE.js library. This might be due to network issues 
            or browser compatibility. Please check your internet connection and 
            ensure your browser supports modern JavaScript modules.
        `);
        return;
    }
    
    // Add a small delay to ensure the DOM layout is settled
    setTimeout(() => {
        console.log("Starting visualization after delay to ensure layout is complete");
        
        // Force layout calculation
        if (container) {
            // Trigger a layout calculation by accessing properties that cause reflow
            const rect = container.getBoundingClientRect();
            console.log("Forcing layout calculation, container dimensions:", 
                      container.offsetWidth, container.offsetHeight, rect);
            
            try {
                startVisualization();
            } catch (initError) {
                console.error("Error during visualization initialization:", initError);
                clearTimeout(loadingTimeout);
                showError(container, `
                    An error occurred while initializing the 3D visualization: 
                    ${initError.message || 'Unknown error'}. 
                    Please check your browser's WebGL support or try reloading the page.
                `);
            }
        } else {
            console.error("Container element not found for visualization");
            clearTimeout(loadingTimeout);
            showError(document.body, "Container element not found for visualization.");
        }
    }, 50);
}

let scene, camera, renderer;
let satellite; // group representing Sputnik
let isDragging = false;
let prevMouse = {x:0, y:0};
const dragSensitivity = 0.01;
let resizeObs;

// Add variables to track spinning state
let isSpinning = false;
let angularVelocity = null; // Initialize as null until THREE is loaded
let lastSpinTime = 0;

function startVisualization() {
    console.log("Starting visualization...");
    
    // Prevent multiple initializations
    if (initialized) {
        console.log("Visualization already initialized, skipping");
        return;
    }
    
    try {
        console.log("Calling init()...");
        init();
        console.log("Init completed successfully");
        
        // Ensure THREE-dependent variables are initialized
        if (angularVelocity === null && THREE) {
            angularVelocity = new THREE.Vector3(0, 0, 0);
            console.log("Initialized angularVelocity in startVisualization");
        }
        
        console.log("Calling initial resizeVisualization()...");
        resizeVisualization();
        console.log("Initial resize completed");
        
        // Set initialization flag to true after successful initialization
        initialized = true;
        
        // Clear loading timeout since initialization completed
        clearTimeout(loadingTimeout);
        
        // Ensure loading UI is cleared
        clearLoadingUI();
        
        // Force a render to make sure the scene appears
        if (renderer && scene && camera) {
            console.log("Forcing initial render");
            renderer.render(scene, camera);
        }
        
        // Schedule delayed resize attempts
        setTimeout(() => {
            console.log("First delayed resize");
            resizeVisualization();
            // Force render again after resize
            if (renderer && scene && camera) renderer.render(scene, camera);
        }, 100);
        
        setTimeout(() => {
            console.log("Second delayed resize");
            resizeVisualization();
            // Force render again after resize
            if (renderer && scene && camera) renderer.render(scene, camera);
        }, 500);
        
        setTimeout(() => {
            console.log("Final delayed resize");
            resizeVisualization();
            // Force render again after resize
            if (renderer && scene && camera) renderer.render(scene, camera);
        }, 1000);
        
        // Set up MutationObserver to detect DOM changes and resize accordingly
        const container = document.querySelector('.visualization-container');
        if (container) {
            console.log("Setting up MutationObserver for container size changes");
            const observer = new MutationObserver((mutations) => {
                let shouldResize = false;
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && 
                       (mutation.attributeName === 'style' || 
                        mutation.attributeName === 'class')) {
                        shouldResize = true;
                    }
                });
                
                if (shouldResize) {
                    console.log("Container attributes changed, resizing visualization");
                    resizeVisualization();
                    // Force render after resize
                    if (renderer && scene && camera) renderer.render(scene, camera);
                }
            });
            
            observer.observe(container, { 
                attributes: true,
                childList: false,
                subtree: false
            });
            
            // Also use ResizeObserver if available
            if (window.ResizeObserver) {
                console.log("Setting up ResizeObserver");
                const resizeObserver = new ResizeObserver((entries) => {
                    console.log("ResizeObserver detected size change");
                    resizeVisualization();
                    // Force render after resize
                    if (renderer && scene && camera) renderer.render(scene, camera);
                });
                resizeObserver.observe(container);
            }
        }
        
        // After all setup is done
        setTimeout(() => {
            // Create scroll indicator after everything is loaded
            createScrollIndicator();
            console.log("Added scroll indicator for spin controls");
        }, 1500);
    } catch (error) {
        console.error("Error in startVisualization:", error);
        clearTimeout(loadingTimeout);
        const container = document.getElementById('attitude-visualization');
        showError(container, `Initialization error: ${error.message}`);
        throw error; // Re-throw to allow the calling function to handle it
    }
}

function init(){
    console.log("Inside init()");
    const container = document.getElementById('attitude-visualization');
    console.log("Container:", container, "Width:", container.clientWidth, "Height:", container.clientHeight);
    
    // Initialize the scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Ensure we have valid dimensions before proceeding
    let width = container.clientWidth;
    let height = container.clientHeight;
    
    // Use responsive fallback dimensions if the container doesn't have proper size yet
    if (width <= 0) {
        // Use window width to calculate a responsive fallback size
        const windowWidth = window.innerWidth;
        // Use available width minus space for controls (on desktop)
        if (windowWidth > 768) {
            width = Math.min(windowWidth * 0.7, 1100); // 70% of window width, max 1100px
        } else {
            width = windowWidth - 40; // Almost full width on mobile
        }
        width = Math.max(width, 400); // Minimum width of 400px
        container.style.width = `${width}px`;
        console.log("Applied fallback width:", width);
    }
    
    if (height <= 0) {
        // Calculate appropriate height based on window height
        height = Math.max(window.innerHeight * 0.6, 400); 
        container.style.height = `${height}px`;
        console.log("Applied fallback height:", height);
    }
    
    const aspect = width / height || 1; // Prevent division by zero
    console.log("Calculated aspect:", aspect);
    
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(0,0,6);
    console.log("Camera created");

    // Create renderer with explicit WebGL1 context and error handling
    try {
        console.log("Creating WebGL renderer");
        // Create renderer with explicit parameters for better compatibility
        renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            canvas: document.createElement('canvas'),
            context: null, // Let THREE.js create the context
            precision: 'highp',
            powerPreference: 'default'
        });
        
        console.log("Renderer created successfully");
        console.log("Setting renderer size:", width, height);
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 1);
        // Check if sRGBEncoding is available before using it
        if (THREE.sRGBEncoding !== undefined) {
            renderer.outputEncoding = THREE.sRGBEncoding;
        } else {
            console.log("sRGBEncoding not available in this THREE.js version, using default encoding");
        }
        
        // Check if the renderer's WebGL context was created successfully
        if (!renderer.getContext()) {
            throw new Error("WebGL context creation failed");
        }
        
        // Prepare container for renderer
        container.style.position = 'relative';
        container.style.overflow = 'hidden';
        
        // Clear loading UI before appending renderer
        clearLoadingUI();
        
        // Ensure the canvas element is properly styled
        const canvas = renderer.domElement;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '1';
        
        container.appendChild(renderer.domElement);
        console.log("Renderer added to DOM");
        
        // Force a render immediately to ensure content is displayed
        renderer.render(scene, camera);
    } catch (error) {
        console.error("WebGL Renderer creation failed:", error);
        throw new Error(`Failed to create WebGL renderer: ${error.message}`);
    }

    // Add lights
    try {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5,5,5);
        scene.add(dirLight);
        console.log("Lights added");
    } catch (error) {
        console.error("Error adding lights:", error);
        // Continue anyway as lights aren't critical
    }

    try {
        createSputnik();
        console.log("Sputnik created");
    } catch (error) {
        console.error("Error creating Sputnik model:", error);
        throw new Error(`Failed to create Sputnik model: ${error.message}`);
    }

    try {
        addEventListeners(container);
        populateDCMInputs();
        updateDisplaysFromQuaternion(satellite.quaternion);
        console.log("Event listeners and inputs added");
    } catch (error) {
        console.error("Error setting up UI:", error);
        // Non-critical, continue anyway
    }

    window.addEventListener('resize', () => {
        console.log("Window resize event");
        resizeVisualization();
    });
    
    console.log("Starting animation loop");
    lastSpinTime = Date.now();
    animate();
}

// Add a function to create 3D text for axis labels
function createTextSprite(text, color) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 100;
    canvas.width = 256;
    canvas.height = 256;
    
    // Set transparent background
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw text
    context.font = `Bold ${fontSize}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Add white outline to make text pop against any background
    context.strokeStyle = 'white';
    context.lineWidth = 6;
    context.strokeText(text, canvas.width / 2, canvas.height / 2);
    
    // Fill text with color
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Canvas contents will be used for a texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.6, 0.6, 1); // Slightly larger scale
    
    return sprite;
}

// Modify the createSputnik function to add axis labels
function createSputnik(){
    satellite = new THREE.Group();
    
    // Main body sphere
    const bodyGeom = new THREE.SphereGeometry(0.6, 32, 32);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xC0C0C0, // Silver color, more accurate to Sputnik
        metalness: 0.8, 
        roughness: 0.2,
        emissive: 0x333333,
        emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    satellite.add(body);

    // Antennas: originate from front hemisphere and angle backwards
    const antennaLength = 5.0;
    const antennaGeom = new THREE.CylinderGeometry(0.013, 0.008, antennaLength, 10); // Taper the antennas slightly
    const antennaMat = new THREE.MeshStandardMaterial({
        color: 0xD0D0D0, // Slightly brighter silver for antennas
        metalness: 1.0, 
        roughness: 0.05,
        emissive: 0x444444,
        emissiveIntensity: 0.3
    });

    // Position parameters
    const sphereRadius = 0.6;
    
    // Define the 4 antenna positions and directions more precisely to match real Sputnik
    // Each antenna is defined by:
    // 1. Where it attaches to the sphere (attachment point)
    // 2. The direction it points (unit vector pointing outward)
    
    const antennaDefaults = [
        // Antenna positions are defined relative to sphere center
        // Format: [x, y, z, dirX, dirY, dirZ]
        // Four antennas arranged around front of sphere, pointing backward and slightly outward
        [0.3, -0.3, 0.4, -0.8, -0.4, 0.2],   // Front-right-down
        [0.3, -0.3, -0.4, -0.8, -0.4, -0.2],  // Front-left-down
        [0.3, 0.3, 0.4, -0.8, 0.4, 0.2],    // Front-right-up
        [0.3, 0.3, -0.4, -0.8, 0.4, -0.2]    // Front-left-up
    ];
    
    // Create each antenna
    antennaDefaults.forEach(([x, y, z, dirX, dirY, dirZ]) => {
        // Create normalized vectors for position and direction
        const attachPos = new THREE.Vector3(x, y, z).normalize();
        const antDir = new THREE.Vector3(dirX, dirY, dirZ).normalize();
        
        // Create the antenna mesh
        const ant = new THREE.Mesh(antennaGeom, antennaMat);
        
        // Set orientation - make the antenna point in the direction
        ant.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), antDir);
        
        // Position the antenna with one end at the sphere surface
        const attachPoint = attachPos.clone().multiplyScalar(sphereRadius);
        const centerPos = attachPoint.clone().add(
            antDir.clone().multiplyScalar(antennaLength/2)
        );
        
        ant.position.copy(centerPos);
        satellite.add(ant);
    });
    
    // Add coordinate axis indicators to make orientation clearer
    const axisLength = 1.0;
    const axisRadius = 0.03;
    
    // X-axis (red) - forward
    const xAxisGeom = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
    const xAxisMat = new THREE.MeshBasicMaterial({color: 0xff0000});
    const xAxis = new THREE.Mesh(xAxisGeom, xAxisMat);
    xAxis.position.set(axisLength/2, 0, 0);
    xAxis.rotation.z = Math.PI/2;
    satellite.add(xAxis);
    
    // Y-axis (green) - up
    const yAxisGeom = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
    const yAxisMat = new THREE.MeshBasicMaterial({color: 0x00ff00});
    const yAxis = new THREE.Mesh(yAxisGeom, yAxisMat);
    yAxis.position.set(0, axisLength/2, 0);
    satellite.add(yAxis);
    
    // Z-axis (blue) - right
    const zAxisGeom = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
    const zAxisMat = new THREE.MeshBasicMaterial({color: 0x0000ff});
    const zAxis = new THREE.Mesh(zAxisGeom, zAxisMat);
    zAxis.position.set(0, 0, axisLength/2);
    zAxis.rotation.x = Math.PI/2;
    satellite.add(zAxis);
    
    // Add axis labels
    // X-axis label (red)
    const xLabel = createTextSprite("X", "#ff0000");
    xLabel.position.set(axisLength + 1.2, 0, 0);
    satellite.add(xLabel);
    
    // Y-axis label (green)
    const yLabel = createTextSprite("Y", "#00ff00");
    yLabel.position.set(0, axisLength + 1.2, 0);
    satellite.add(yLabel);
    
    // Z-axis label (blue)
    const zLabel = createTextSprite("Z", "#0000ff");
    zLabel.position.set(0, 0, axisLength + 1.2);
    satellite.add(zLabel);

    scene.add(satellite);
}

// Create a shared button style function
function getUtilityButtonStyles(isSmall = true) {
    return {
        flex: '1',
        padding: isSmall ? '4px 6px' : '6px 10px',
        fontSize: isSmall ? '0.7rem' : '0.8rem',
        backgroundColor: '#e0e0e0',
        color: '#333333',
        border: '1px solid #bbbbbb',
        borderRadius: '4px',
        cursor: 'pointer',
        margin: '2px',
        fontWeight: isSmall ? 'normal' : 'bold',
        transition: 'background-color 0.2s'
    };
}

// Apply styles to an element
function applyStyles(element, styles) {
    Object.keys(styles).forEach(property => {
        element.style[property] = styles[property];
    });
}

function addEventListeners(dom){
    dom.addEventListener('pointerdown', (e)=>{
        isDragging=true;
        prevMouse.x = e.clientX;
        prevMouse.y = e.clientY;
    });
    window.addEventListener('pointermove', (e)=>{
        if(!isDragging) return;
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        prevMouse.x = e.clientX;
        prevMouse.y = e.clientY;

        const qx = new THREE.Quaternion();
        const qy = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0,1,0), dx*dragSensitivity);
        qy.setFromAxisAngle(new THREE.Vector3(1,0,0), dy*dragSensitivity);
        const dq = qx.multiply(qy);
        satellite.quaternion.premultiply(dq);
        updateDisplaysFromQuaternion(satellite.quaternion);
    });
    window.addEventListener('pointerup', ()=>{isDragging=false;});

    // Add buttons to the quaternion section
    const quatSection = document.querySelector('.quat-section');
    const quatButtonsDiv = document.createElement('div');
    quatButtonsDiv.className = 'button-group';
    quatButtonsDiv.style.display = 'flex';
    quatButtonsDiv.style.gap = '4px';
    quatButtonsDiv.style.marginTop = '6px';
    quatButtonsDiv.style.marginBottom = '6px';
    
    // Create zero quaternion button
    const zeroQuatButton = document.createElement('button');
    zeroQuatButton.textContent = 'Zero All';
    zeroQuatButton.className = 'utility-btn';
    applyStyles(zeroQuatButton, getUtilityButtonStyles(true));
    
    // Create identity quaternion button
    const identityQuatButton = document.createElement('button');
    identityQuatButton.textContent = 'Reset to Identity';
    identityQuatButton.className = 'utility-btn';
    applyStyles(identityQuatButton, getUtilityButtonStyles(true));
    
    // Add buttons to quaternion section
    quatButtonsDiv.appendChild(zeroQuatButton);
    quatButtonsDiv.appendChild(identityQuatButton);
    
    // Find the appropriate place to insert buttons (after the quat-grid, before the apply button)
    const quatGrid = quatSection.querySelector('.quat-grid');
    if (quatGrid && quatGrid.nextSibling) {
        quatSection.insertBefore(quatButtonsDiv, quatGrid.nextSibling);
    } else {
        quatSection.insertBefore(quatButtonsDiv, document.getElementById('apply-quat'));
    }
    
    // Add buttons to the DCM section
    const dcmSection = document.querySelector('.dcm-section');
    const dcmButtonsDiv = document.createElement('div');
    dcmButtonsDiv.className = 'button-group';
    dcmButtonsDiv.style.display = 'flex';
    dcmButtonsDiv.style.gap = '4px';
    dcmButtonsDiv.style.marginTop = '6px';
    dcmButtonsDiv.style.marginBottom = '6px';
    
    // Create zero DCM button
    const zeroDcmButton = document.createElement('button');
    zeroDcmButton.textContent = 'Zero All';
    zeroDcmButton.className = 'utility-btn';
    applyStyles(zeroDcmButton, getUtilityButtonStyles(true));
    
    // Create identity DCM button
    const identityDcmButton = document.createElement('button');
    identityDcmButton.textContent = 'Reset to Identity';
    identityDcmButton.className = 'utility-btn';
    applyStyles(identityDcmButton, getUtilityButtonStyles(true));
    
    // Add buttons to DCM section
    dcmButtonsDiv.appendChild(zeroDcmButton);
    dcmButtonsDiv.appendChild(identityDcmButton);
    
    // Find the appropriate place to insert buttons (after the dcm-grid, before the apply button)
    const dcmGrid = dcmSection.querySelector('#dcm-grid');
    if (dcmGrid && dcmGrid.nextSibling) {
        dcmSection.insertBefore(dcmButtonsDiv, dcmGrid.nextSibling);
    } else {
        dcmSection.insertBefore(dcmButtonsDiv, document.getElementById('apply-dcm'));
    }

    // Add hover effects
    const utilityButtons = document.querySelectorAll('.utility-btn');
    utilityButtons.forEach(button => {
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#d0d0d0';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#e0e0e0';
        });
        button.addEventListener('mousedown', () => {
            button.style.backgroundColor = '#c0c0c0';
        });
        button.addEventListener('mouseup', () => {
            button.style.backgroundColor = '#d0d0d0';
        });
    });

    // Add event listeners for the quaternion apply button
    document.getElementById('apply-quat').addEventListener('click', ()=>{
        const q0 = parseFloat(document.getElementById('q0').value);
        const q1 = parseFloat(document.getElementById('q1').value);
        const q2 = parseFloat(document.getElementById('q2').value);
        const q3 = parseFloat(document.getElementById('q3').value);
        const q = new THREE.Quaternion(q1,q2,q3,q0).normalize();
        satellite.quaternion.copy(q);
        updateDisplaysFromQuaternion(q);
        showFeedback('Quaternion applied!', 'apply-quat');
    });

    // Add event listeners for the DCM apply button
    document.getElementById('apply-dcm').addEventListener('click', ()=>{
        const m = [];
        for(let r=0;r<3;r++){
            for(let c=0;c<3;c++){
                const val = parseFloat(document.getElementById(`m${r}${c}`).value);
                m.push(val);
            }
        }
        // Convert to quaternion using THREE.Matrix4
        const mat4 = new THREE.Matrix4();
        mat4.set(
            m[0], m[1], m[2], 0,
            m[3], m[4], m[5], 0,
            m[6], m[7], m[8], 0,
            0,0,0,1
        );
        const q = new THREE.Quaternion().setFromRotationMatrix(mat4);
        satellite.quaternion.copy(q);
        updateDisplaysFromQuaternion(q);
        showFeedback('DCM applied!', 'apply-dcm');
    });
    
    // Add event listeners for the quaternion utility buttons
    zeroQuatButton.addEventListener('click', () => {
        document.getElementById('q0').value = '0';
        document.getElementById('q1').value = '0';
        document.getElementById('q2').value = '0';
        document.getElementById('q3').value = '0';
        showFeedback('Quaternion zeroed', zeroQuatButton);
    });
    
    identityQuatButton.addEventListener('click', () => {
        document.getElementById('q0').value = '1';
        document.getElementById('q1').value = '0';
        document.getElementById('q2').value = '0';
        document.getElementById('q3').value = '0';
        showFeedback('Quaternion reset to identity', identityQuatButton);
    });
    
    // Add event listeners for the DCM utility buttons
    zeroDcmButton.addEventListener('click', () => {
        for(let r=0; r<3; r++) {
            for(let c=0; c<3; c++) {
                document.getElementById(`m${r}${c}`).value = '0';
            }
        }
        showFeedback('DCM zeroed', zeroDcmButton);
    });
    
    identityDcmButton.addEventListener('click', () => {
        for(let r=0; r<3; r++) {
            for(let c=0; c<3; c++) {
                document.getElementById(`m${r}${c}`).value = r === c ? '1' : '0';
            }
        }
        showFeedback('DCM reset to identity', identityDcmButton);
    });

    // Add special DCM rotation options
    const dcmRotationDiv = document.createElement('div');
    dcmRotationDiv.className = 'dcm-rotation-options';
    dcmRotationDiv.style.marginTop = '10px';
    dcmRotationDiv.style.border = '1px solid #ccc';
    dcmRotationDiv.style.borderRadius = '5px';
    dcmRotationDiv.style.padding = '8px';
    dcmRotationDiv.style.backgroundColor = '#f9f9f9';
    
    // Add title for the section
    const rotationTitle = document.createElement('h3');
    rotationTitle.textContent = 'Generate Rotation DCM';
    rotationTitle.style.fontSize = '0.8rem';
    rotationTitle.style.marginTop = '0';
    rotationTitle.style.marginBottom = '8px';
    dcmRotationDiv.appendChild(rotationTitle);
    
    // Add angle input with label
    const angleContainer = document.createElement('div');
    angleContainer.style.display = 'flex';
    angleContainer.style.alignItems = 'center';
    angleContainer.style.marginBottom = '6px';
    
    const angleLabel = document.createElement('label');
    angleLabel.textContent = 'Angle (degrees): ';
    angleLabel.style.fontSize = '0.75rem';
    angleLabel.style.marginRight = '8px';
    
    const angleInput = document.createElement('input');
    angleInput.type = 'number';
    angleInput.id = 'rotation-angle';
    angleInput.value = '90';
    angleInput.min = '-180';
    angleInput.max = '180';
    angleInput.step = '5';
    angleInput.style.width = '60px';
    angleInput.style.padding = '2px 4px';
    angleInput.style.fontSize = '0.75rem';
    
    angleContainer.appendChild(angleLabel);
    angleContainer.appendChild(angleInput);
    dcmRotationDiv.appendChild(angleContainer);
    
    // Add rotation buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '5px';
    buttonContainer.style.marginTop = '8px';
    
    // Create rotation buttons for each axis
    const rotButtons = [];
    ['X-Axis', 'Y-Axis', 'Z-Axis'].forEach((axis, index) => {
        const button = document.createElement('button');
        button.textContent = `${axis} Rotation`;
        button.className = 'rotation-btn';
        button.id = `rotate-${axis.toLowerCase()}`;
        applyStyles(button, getUtilityButtonStyles(true));
        button.style.flex = '1';
        rotButtons.push(button);
        buttonContainer.appendChild(button);
    });
    
    dcmRotationDiv.appendChild(buttonContainer);
    
    // Insert the rotation options after the utility buttons
    const applyDcmButton = document.getElementById('apply-dcm');
    dcmSection.insertBefore(dcmRotationDiv, applyDcmButton);
    
    // Add event listeners for axis rotation buttons
    rotButtons[0].addEventListener('click', () => {
        const angle = parseFloat(document.getElementById('rotation-angle').value);
        const dcmValues = generateDCMForXRotation(angle);
        updateDCMInputs(dcmValues);
        showFeedback(`X-axis rotation of ${angle}° applied to DCM`, rotButtons[0]);
    });
    
    rotButtons[1].addEventListener('click', () => {
        const angle = parseFloat(document.getElementById('rotation-angle').value);
        const dcmValues = generateDCMForYRotation(angle);
        updateDCMInputs(dcmValues);
        showFeedback(`Y-axis rotation of ${angle}° applied to DCM`, rotButtons[1]);
    });
    
    rotButtons[2].addEventListener('click', () => {
        const angle = parseFloat(document.getElementById('rotation-angle').value);
        const dcmValues = generateDCMForZRotation(angle);
        updateDCMInputs(dcmValues);
        showFeedback(`Z-axis rotation of ${angle}° applied to DCM`, rotButtons[2]);
    });

    // Add the angular velocity input section
    const container = dom.closest('.visualization-container');
    const controlsOverlay = container.querySelector('.controls-overlay');
    
    // Create Angular Velocity section
    const angularVelocitySection = document.createElement('div');
    angularVelocitySection.className = 'angular-velocity-section';
    angularVelocitySection.style.marginTop = '20px';
    angularVelocitySection.style.borderTop = '1px solid #ddd';
    angularVelocitySection.style.paddingTop = '10px';
    
    // Add heading
    const heading = document.createElement('h3');
    heading.textContent = 'Angular Velocity (deg/s)';
    heading.style.fontSize = '0.9rem';
    heading.style.margin = '0.25rem 0';
    angularVelocitySection.appendChild(heading);
    
    // Create input grid for omega
    const omegaGrid = document.createElement('div');
    omegaGrid.className = 'omega-grid';
    omegaGrid.style.display = 'grid';
    omegaGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    omegaGrid.style.gap = '4px';
    omegaGrid.style.marginTop = '5px';
    
    // Create inputs for each component with labels
    const componentLabels = ['ωx', 'ωy', 'ωz'];
    const omegaInputs = [];
    
    componentLabels.forEach((label, index) => {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        
        const labelElem = document.createElement('label');
        labelElem.textContent = label;
        labelElem.style.fontSize = '0.8rem';
        
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `omega-${index}`;
        input.value = '0';
        input.min = '-180';
        input.max = '180';
        input.step = '5';
        input.style.width = '100%';
        input.style.padding = '4px';
        input.style.fontSize = '0.8rem';
        input.style.textAlign = 'center';
        
        container.appendChild(labelElem);
        container.appendChild(input);
        omegaGrid.appendChild(container);
        omegaInputs.push(input);
    });
    
    angularVelocitySection.appendChild(omegaGrid);
    
    // Add common angular velocity presets
    const presetsContainer = document.createElement('div');
    presetsContainer.style.marginTop = '10px';
    
    const presetsLabel = document.createElement('div');
    presetsLabel.textContent = 'Presets:';
    presetsLabel.style.fontSize = '0.75rem';
    presetsLabel.style.marginBottom = '5px';
    presetsContainer.appendChild(presetsLabel);
    
    const presetButtonsContainer = document.createElement('div');
    presetButtonsContainer.style.display = 'flex';
    presetButtonsContainer.style.flexWrap = 'wrap';
    presetButtonsContainer.style.gap = '5px';
    
    // Define some common rotation presets
    const presets = [
        { name: 'X Spin', values: [30, 0, 0] },
        { name: 'Y Spin', values: [0, 30, 0] },
        { name: 'Z Spin', values: [0, 0, 30] },
        { name: 'Slow 3D', values: [10, 15, 5] },
        { name: 'Fast 3D', values: [40, 30, 20] }
    ];
    
    presets.forEach(preset => {
        const button = document.createElement('button');
        button.textContent = preset.name;
        button.className = 'preset-btn';
        applyStyles(button, getUtilityButtonStyles(true));
        button.style.padding = '3px 6px';
        button.style.fontSize = '0.7rem';
        button.style.margin = '2px';
        
        button.addEventListener('click', () => {
            preset.values.forEach((value, index) => {
                omegaInputs[index].value = value;
            });
            showFeedback(`Set to ${preset.name}`, button);
        });
        
        presetButtonsContainer.appendChild(button);
    });
    
    presetsContainer.appendChild(presetButtonsContainer);
    angularVelocitySection.appendChild(presetsContainer);
    
    // Add buttons for starting and stopping spin
    const spinButtonsContainer = document.createElement('div');
    spinButtonsContainer.style.display = 'flex';
    spinButtonsContainer.style.gap = '10px';
    spinButtonsContainer.style.marginTop = '10px';
    
    const startSpinButton = document.createElement('button');
    startSpinButton.textContent = 'Start Spin';
    startSpinButton.id = 'start-spin';
    startSpinButton.className = 'apply-btn';
    startSpinButton.style.flex = '1';
    startSpinButton.style.backgroundColor = '#28a745';
    
    const stopSpinButton = document.createElement('button');
    stopSpinButton.textContent = 'Stop Spin';
    stopSpinButton.id = 'stop-spin';
    stopSpinButton.className = 'apply-btn';
    stopSpinButton.style.flex = '1';
    stopSpinButton.style.backgroundColor = '#dc3545';
    
    spinButtonsContainer.appendChild(startSpinButton);
    spinButtonsContainer.appendChild(stopSpinButton);
    angularVelocitySection.appendChild(spinButtonsContainer);
    
    // Add the section to the controls overlay
    controlsOverlay.appendChild(angularVelocitySection);
    
    // Add event listeners for start and stop buttons
    startSpinButton.addEventListener('click', () => {
        // Check if THREE is loaded and angularVelocity is created
        if (THREE === undefined || angularVelocity === null) {
            showFeedback('THREE.js not yet loaded. Please try again in a moment.', startSpinButton);
            return;
        }
        
        // Read values and validate
        const omegaX = validateAngularVelocity(parseFloat(omegaInputs[0].value));
        const omegaY = validateAngularVelocity(parseFloat(omegaInputs[1].value));
        const omegaZ = validateAngularVelocity(parseFloat(omegaInputs[2].value));
        
        // Update inputs with validated values
        omegaInputs[0].value = omegaX;
        omegaInputs[1].value = omegaY;
        omegaInputs[2].value = omegaZ;
        
        // Check if all values are zero
        if (omegaX === 0 && omegaY === 0 && omegaZ === 0) {
            showFeedback('Cannot spin with zero angular velocity', startSpinButton);
            return;
        }
        
        // Convert from deg/s to rad/s
        const omegaXRad = omegaX * Math.PI / 180;
        const omegaYRad = omegaY * Math.PI / 180;
        const omegaZRad = omegaZ * Math.PI / 180;
        
        // Set angular velocity
        angularVelocity.set(omegaXRad, omegaYRad, omegaZRad);
        
        // Start spinning
        isSpinning = true;
        lastSpinTime = Date.now();
        
        showFeedback('Spinning started', startSpinButton);
    });
    
    stopSpinButton.addEventListener('click', () => {
        // Stop spinning
        isSpinning = false;
        showFeedback('Spinning stopped', stopSpinButton);
    });
    
    // Add event listener to stop spinning on mouse interaction
    dom.addEventListener('pointerdown', () => {
        if (isSpinning) {
            isSpinning = false;
            showFeedback('Spinning stopped by user interaction', dom);
        }
        isDragging = true;
        prevMouse.x = event.clientX;
        prevMouse.y = event.clientY;
    });
}

function populateDCMInputs(){
    const grid = document.getElementById('dcm-grid');
    for(let r=0;r<3;r++){
        for(let c=0;c<3;c++){
            const input = document.createElement('input');
            input.type='number';
            input.step='any';
            input.id = `m${r}${c}`;
            input.value = r===c?1:0;
            grid.appendChild(input);
        }
    }
}

function updateDisplaysFromQuaternion(q){
    // update quaternion inputs
    document.getElementById('q0').value = q.w.toFixed(4);
    document.getElementById('q1').value = q.x.toFixed(4);
    document.getElementById('q2').value = q.y.toFixed(4);
    document.getElementById('q3').value = q.z.toFixed(4);

    // update DCM inputs
    const mat4 = new THREE.Matrix4().makeRotationFromQuaternion(q);
    const e = mat4.elements;
    // e is column-major 4x4, first 3x3 part is rotation matrix
    const m = [e[0],e[4],e[8], e[1],e[5],e[9], e[2],e[6],e[10]]; // row-major 3x3
    let idx=0;
    for(let r=0;r<3;r++){
        for(let c=0;c<3;c++){
            document.getElementById(`m${r}${c}`).value = m[idx++].toFixed(4);
        }
    }
}

function resizeVisualization(){
    console.log("Resize called");
    const container = document.querySelector('.visualization-container');
    const viz = document.getElementById('attitude-visualization');
    const controls = document.querySelector('.controls-overlay');
    console.log("Found elements:", container, viz, controls);

    // Get window and parent container dimensions
    let windowWidth = window.innerWidth;
    let containerWidth = container.parentElement ? container.parentElement.clientWidth : windowWidth;
    let width = containerWidth;
    let height = container.clientHeight;
    console.log("Initial dimensions:", width, height, "Window width:", windowWidth);

    if(window.innerWidth > 768){
        // On desktop, make visualization take up more space by using a smaller control panel
        controls.style.width = '250px';
        // Calculate width by subtracting the controls panel width
        width = width - controls.offsetWidth;
        // Ensure we have a minimum width but also try to fill available space
        width = Math.max(width, Math.min(800, windowWidth * 0.6));
    } else {
        // On mobile, ensure the visualization takes at least 70% of viewport height
        height = Math.max(window.innerHeight * 0.7, 400);
    }
    console.log("Adjusted dimensions:", width, height);

    // Set container to full width
    container.style.width = '100%';
    container.style.maxWidth = '1400px'; // Set a max width for very large screens
    container.style.margin = '0 auto'; // Center the container
    
    // Apply dimensions to visualization element
    viz.style.width = `${width}px`;
    viz.style.height = `${height}px`;
    console.log("Set element dimensions");

    if(renderer && camera){
        console.log("Adjusting renderer and camera");
        renderer.setSize(width, height);
        camera.aspect = width/height || 1; // Prevent division by zero
        camera.updateProjectionMatrix();
        
        // Force a render to update the view
        renderer.render(scene, camera);
    }
}

// Update the animate function to make text labels always face the camera
function animate() {
    try {
        // Request next animation frame immediately to keep loop going 
        // even if there's an error during rendering
        requestAnimationFrame(animate);
        
        // Handle spinning update
        if (isSpinning && angularVelocity !== null) {
            const currentTime = Date.now();
            const deltaTime = (currentTime - lastSpinTime) / 1000; // in seconds
            lastSpinTime = currentTime;
            
            // Create a quaternion for the rotation increment
            const angle = angularVelocity.length() * deltaTime;
            const axis = angularVelocity.clone().normalize();
            const spinIncrement = new THREE.Quaternion().setFromAxisAngle(axis, angle);
            
            // Apply the rotation
            satellite.quaternion.premultiply(spinIncrement);
            
            // Update displays
            updateDisplaysFromQuaternion(satellite.quaternion);
        } else {
            lastSpinTime = Date.now();
        }
        
        // Make text sprites always face the camera
        if (satellite && camera) {
            // Find all sprites in the satellite group and make them face the camera
            satellite.traverse((child) => {
                if (child instanceof THREE.Sprite) {
                    child.position.normalize();
                    const scale = camera.position.distanceTo(satellite.position) / 15;
                    child.scale.set(scale, scale, 1);
                }
            });
        }
        
        // Check if all rendering components are available
        if (renderer && scene && camera) {
            try {
                // Attempt to render the scene
                renderer.render(scene, camera);
            } catch (renderError) {
                console.error("Error during rendering:", renderError);
                // Only log once per second to avoid console spam
                if (!animate.lastErrorTime || (Date.now() - animate.lastErrorTime > 1000)) {
                    animate.lastErrorTime = Date.now();
                }
            }
        } else {
            // Only log missing components once per second
            if (!animate.lastWarnTime || (Date.now() - animate.lastWarnTime > 1000)) {
                console.warn("Skipping render - missing components:", 
                    !renderer ? "renderer" : "", 
                    !scene ? "scene" : "", 
                    !camera ? "camera" : "");
                animate.lastWarnTime = Date.now();
            }
        }
    } catch (loopError) {
        console.error("Critical animation loop error:", loopError);
        // Try to recover by restarting the animation loop
        if (!animate.recoveryAttempted) {
            animate.recoveryAttempted = true;
            console.log("Attempting to recover animation loop");
            setTimeout(() => {
                animate.recoveryAttempted = false;
                requestAnimationFrame(animate);
            }, 1000);
        }
    }
}

console.log("Bottom of script reached, loading THREE...");

// Start loading immediately
loadThreeJS();

// Also attempt on DOM ready just in case
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content loaded event fired");
    // If THREE isn't loaded yet, try again
    if (!THREE) {
        console.log("THREE not loaded by DOM ready, trying again");
        loadThreeJS();
    }
});

// Utility function to show loading message
function showLoading() {
    const container = document.getElementById('attitude-visualization');
    if (container) {
        container.innerHTML = `
            <div class="loading-container" style="display: flex; justify-content: center; align-items: center; height: 100%; color: white; background-color: #111;">
                <div style="text-align: center;">
                    <div style="font-size: 18px; margin-bottom: 10px;">Loading visualization...</div>
                    <div style="width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.3); 
                         border-radius: 50%; border-top-color: #fff; margin: 0 auto;
                         animation: spin 1s ease-in-out infinite;"></div>
                    <style>
                        @keyframes spin { to { transform: rotate(360deg); } }
                    </style>
                </div>
            </div>
        `;
    }
}

// Utility function to give feedback when values are applied
function showFeedback(message, targetId) {
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return;
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.position = 'absolute';
    feedback.style.color = '#00aa00';
    feedback.style.fontSize = '12px';
    feedback.style.fontWeight = 'bold';
    feedback.style.padding = '2px 5px';
    feedback.style.borderRadius = '3px';
    feedback.style.backgroundColor = 'rgba(255,255,255,0.8)';
    feedback.style.opacity = '0';
    feedback.style.transition = 'opacity 0.3s ease';
    
    const rect = targetElement.getBoundingClientRect();
    feedback.style.left = `${rect.left}px`;
    feedback.style.top = `${rect.top - 20}px`;
    
    // Append to body
    document.body.appendChild(feedback);
    
    // Display then fade out
    setTimeout(() => { 
        feedback.style.opacity = '1';
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(feedback);
            }, 300);
        }, 1500);
    }, 10);
}

// Add this function after showFeedback
function showError(container, errorMessage, canRetry = true) {
    if (!container) return;
    
    const errorHtml = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; 
                   height: 100%; color: white; padding: 20px; background-color: #111; text-align: center;">
            <div style="font-size: 18px; margin-bottom: 10px; color: #ff4444;">
                <div style="font-size: 40px; margin-bottom: 10px;">⚠️</div>
                Visualization Error
            </div>
            <div style="margin: 15px 0; max-width: 400px;">${errorMessage}</div>
            ${canRetry ? `
                <button id="retry-visualization" style="padding: 8px 16px; margin-top: 15px; 
                        background-color: #0071e3; color: white; border: none; 
                        border-radius: 5px; cursor: pointer; font-weight: bold;">
                    Retry Loading
                </button>
            ` : ''}
        </div>
    `;
    
    container.innerHTML = errorHtml;
    
    if (canRetry) {
        setTimeout(() => {
            const retryButton = document.getElementById('retry-visualization');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    showLoading();
                    setTimeout(() => {
                        // Reset the initialization flag
                        initialized = false;
                        loadThreeJS();
                    }, 100);
                });
            }
        }, 10);
    }
}

// Update the clearLoadingUI function to be more aggressive in fixing the display
function clearLoadingUI() {
    const container = document.getElementById('attitude-visualization');
    
    if (container) {
        // First, check if there's a loading container and remove it
        const loadingContainer = container.querySelector('.loading-container');
        if (loadingContainer) {
            container.removeChild(loadingContainer);
            console.log("Removed loading container");
        }
        
        // Next, cleanup any other child elements that aren't the THREE.js canvas
        // to ensure a clean state
        Array.from(container.children).forEach(child => {
            if (child.nodeName !== 'CANVAS') {
                container.removeChild(child);
                console.log("Removed non-canvas element:", child.nodeName);
            }
        });
        
        // Ensure canvas is positioned properly and visible
        const canvas = container.querySelector('canvas');
        if (canvas) {
            canvas.style.display = 'block';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.zIndex = '1';
            console.log("Ensured canvas is visible and properly positioned");
        } else {
            console.warn("No canvas found during loading UI cleanup");
        }
        
        // Make sure container is properly styled for canvas display
        container.style.position = 'relative';
        container.style.overflow = 'hidden';
        
        console.log("Cleared loading UI and fixed display");
    }
}

// Add new functions for generating DCM matrices
function generateDCMForXRotation(angleInDegrees) {
    const theta = angleInDegrees * Math.PI / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    
    return [
        1, 0, 0,
        0, cosTheta, sinTheta,
        0, -sinTheta, cosTheta
    ];
}

function generateDCMForYRotation(angleInDegrees) {
    const theta = angleInDegrees * Math.PI / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    
    return [
        cosTheta, 0, -sinTheta,
        0, 1, 0,
        sinTheta, 0, cosTheta
    ];
}

function generateDCMForZRotation(angleInDegrees) {
    const theta = angleInDegrees * Math.PI / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    
    return [
        cosTheta, sinTheta, 0,
        -sinTheta, cosTheta, 0,
        0, 0, 1
    ];
}

// Add helper function to update DCM inputs with given values
function updateDCMInputs(values) {
    if (values && values.length === 9) {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const index = r * 3 + c;
                const inputId = `m${r}${c}`;
                document.getElementById(inputId).value = values[index].toFixed(4);
            }
        }
    }
}

// Helper function to validate angular velocity
function validateAngularVelocity(value) {
    if (isNaN(value)) return 0;
    
    // Enforce minimum and maximum values for visualization
    const minRate = -180; // deg/s
    const maxRate = 180; // deg/s
    
    return Math.max(minRate, Math.min(maxRate, value));
}

// Add a function to create and manage the scroll indicator
function createScrollIndicator() {
    const controlsOverlay = document.querySelector('.controls-overlay');
    if (!controlsOverlay) return;
    
    // Create scroll indicator element
    const indicator = document.createElement('div');
    indicator.className = 'scroll-indicator';
    indicator.innerHTML = '<span>Scroll down for instructions and info on attitude dynamics!</span><i style="font-size:14px;" class="fas fa-arrow-down"></i>';
    indicator.style.position = 'absolute';
    indicator.style.bottom = '15px';
    indicator.style.right = '50%';
    indicator.style.transform = 'translateX(50%)';
    indicator.style.backgroundColor = 'rgba(0, 113, 227, 0.9)';
    indicator.style.color = 'white';
    indicator.style.padding = '8px 12px';
    indicator.style.borderRadius = '20px';
    indicator.style.fontSize = '12px';
    indicator.style.fontWeight = 'bold';
    indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    indicator.style.zIndex = '100';
    indicator.style.opacity = '0';
    indicator.style.transition = 'opacity 0.5s';
    indicator.style.pointerEvents = 'none'; // Prevents the indicator from blocking clicks
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: translateX(50%) scale(1); }
            50% { transform: translateX(50%) scale(1.05); }
            100% { transform: translateX(50%) scale(1); }
        }
        .scroll-indicator {
            animation: pulse 2s infinite;
        }
    `;
    document.head.appendChild(style);
    
    controlsOverlay.appendChild(indicator);
    
    // Function to check if controls need scrolling
    function checkScrollNeeded() {
        const controlsHeight = controlsOverlay.scrollHeight;
        const visibleHeight = controlsOverlay.clientHeight;
        
        // Show indicator if there's more content than visible area and angular velocity section exists
        const shouldShow = controlsHeight > visibleHeight && document.querySelector('.angular-velocity-section');
        
        indicator.style.opacity = shouldShow ? '1' : '0';
    }
    
    // Check initially and whenever window resizes
    setTimeout(checkScrollNeeded, 1000); // Delay initial check to ensure layout is settled
    window.addEventListener('resize', checkScrollNeeded);
    
    // Hide indicator when user scrolls
    controlsOverlay.addEventListener('scroll', () => {
        // If user has scrolled near the bottom, hide the indicator
        const scrollPosition = controlsOverlay.scrollTop + controlsOverlay.clientHeight;
        const scrollHeight = controlsOverlay.scrollHeight;
        
        if (scrollPosition > scrollHeight - 100) {
            indicator.style.opacity = '0';
        }
    });
    
    return indicator;
} 