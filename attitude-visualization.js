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
    
    // Use fallback dimensions if the container doesn't have proper size yet
    if (width <= 0) {
        const containerParent = container.parentElement;
        width = containerParent ? (containerParent.clientWidth * 0.6) : 600;
        width = Math.max(width, 300); // Minimum width
        container.style.width = `${width}px`;
        console.log("Applied fallback width:", width);
    }
    
    if (height <= 0) {
        height = 500; // Fallback height
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
    animate();
}

function createSputnik(){
    satellite = new THREE.Group();
    
    // Main body sphere
    const bodyGeom = new THREE.SphereGeometry(0.6, 32, 32);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xbfbfbf, 
        metalness: 0.7, 
        roughness: 0.2,
        emissive: 0x333333, // Add slight emissive light to be more visible
        emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    satellite.add(body);

    // Four antennas
    const antennaLength = 5.0;
    const antennaGeom = new THREE.CylinderGeometry(0.013, 0.013, antennaLength, 10);
    const antennaMat = new THREE.MeshStandardMaterial({
        color: 0xe0e0e0, 
        metalness: 1.0, 
        roughness: 0.05,
        emissive: 0x444444, // Add slight emissive light to be more visible
        emissiveIntensity: 0.3
    });

    const offset = 0.25;
    const combos = [
        [ offset,  offset],
        [-offset,  offset],
        [-offset, -offset],
        [ offset, -offset]
    ];

    const sphereRadius = 0.6;
    combos.forEach(([dy,dz])=>{
        const baseDir = new THREE.Vector3(1, dy, dz).normalize(); // where antenna attaches
        const axisDir = baseDir.clone().multiplyScalar(-1);        // antenna points backward
        const ant = new THREE.Mesh(antennaGeom, antennaMat);
        ant.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), axisDir);
        const centerPos = baseDir.clone().multiplyScalar(sphereRadius).add(axisDir.clone().multiplyScalar(antennaLength/2));
        ant.position.copy(centerPos);
        satellite.add(ant);
    });
    
    // Add coordinate axis indicators to make orientation clearer
    const axisLength = 1.0;
    const axisRadius = 0.03;
    
    // X-axis (red)
    const xAxisGeom = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
    const xAxisMat = new THREE.MeshBasicMaterial({color: 0xff0000});
    const xAxis = new THREE.Mesh(xAxisGeom, xAxisMat);
    xAxis.position.set(axisLength/2, 0, 0);
    xAxis.rotation.z = Math.PI/2;
    satellite.add(xAxis);
    
    // Y-axis (green)
    const yAxisGeom = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
    const yAxisMat = new THREE.MeshBasicMaterial({color: 0x00ff00});
    const yAxis = new THREE.Mesh(yAxisGeom, yAxisMat);
    yAxis.position.set(0, axisLength/2, 0);
    satellite.add(yAxis);
    
    // Z-axis (blue)
    const zAxisGeom = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
    const zAxisMat = new THREE.MeshBasicMaterial({color: 0x0000ff});
    const zAxis = new THREE.Mesh(zAxisGeom, zAxisMat);
    zAxis.position.set(0, 0, axisLength/2);
    zAxis.rotation.x = Math.PI/2;
    satellite.add(zAxis);

    scene.add(satellite);
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

    let width = container.clientWidth;
    let height = container.clientHeight;
    console.log("Initial dimensions:", width, height);

    if(window.innerWidth > 768){
        // Calculate width by subtracting the controls panel width
        width = width - controls.offsetWidth;
        // Ensure we have a minimum width
        width = Math.max(width, 300);
    } else {
        height = window.innerHeight*0.5;
    }
    console.log("Adjusted dimensions:", width, height);

    viz.style.width = `${width}px`;
    viz.style.height = `${height}px`;
    console.log("Set element dimensions");

    if(renderer && camera){
        console.log("Adjusting renderer and camera");
        renderer.setSize(width, height);
        camera.aspect = width/height || 1; // Prevent division by zero
        camera.updateProjectionMatrix();
    }
}

// Update the animate function to be more robust
function animate() {
    try {
        // Request next animation frame immediately to keep loop going 
        // even if there's an error during rendering
        requestAnimationFrame(animate);
        
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