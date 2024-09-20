console.log("Orbit visualization script loaded");

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

let scene, camera, renderer;
let orbit, centralBody, satellite;
let xAxis, yAxis, zAxis;
let centralBodyLabel, satelliteLabel;
let xyPlane, orbitalPlane, lineOfNodes;
let xyPlaneLabel, orbitalPlaneLabel, lineOfNodesLabel;
let periapsisLine, periapsisLabel;
let orbitParams = {
    a: 4.2,
    e: 0.10,
    i: 0,
    raan: 0,
    w: 0,
    nu: 0
};

let isAutopanning = true;
let cameraAngleHorizontal = 0;
let cameraAngleVertical = 0;

function init() {
    try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); // Set background to black
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        const visualizationElement = document.getElementById('orbit-visualization');
        renderer.setSize(visualizationElement.clientWidth, visualizationElement.clientHeight);
        visualizationElement.appendChild(renderer.domElement);

        const centralBodyGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const centralBodyMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        centralBody = new THREE.Mesh(centralBodyGeometry, centralBodyMaterial);
        scene.add(centralBody);

        // Add label for central body
        centralBodyLabel = createMainLabel("Central Body", 0xffff00);
        centralBodyLabel.position.set(0, -3, 0);
        scene.add(centralBodyLabel);

        const satelliteGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0xFF00FF }); // Magenta color
        satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
        scene.add(satellite);

        // Add label for satellite
        satelliteLabel = createMainLabel("Satellite", 0xFF00FF);
        scene.add(satelliteLabel);

        // Add inertial basis vectors
        const axisLength = 6; // Increased length for visibility
        const axisWidth = 0.1; // Width of the axis lines
        xAxis = createAxis(new THREE.Vector3(axisLength, 0, 0), 0xff0000, "X"); // Red
        yAxis = createAxis(new THREE.Vector3(0, axisLength, 0), 0x00ff00, "Y"); // Green
        zAxis = createAxis(new THREE.Vector3(0, 0, axisLength), 0x0000ff, "Z"); // Blue
        scene.add(xAxis);
        scene.add(yAxis);
        scene.add(zAxis);

        const aspect = visualizationElement.clientWidth / visualizationElement.clientHeight;
        const fov = aspect < 1 ? 90 : 60; // Wider FOV for mobile (portrait)
        camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);

        const cameraDistance = aspect < 1 ? 25 : 20; // Increased camera distance
        camera.position.z = cameraDistance;

        // Initialize slider values
        document.getElementById('semi-major-axis').value = orbitParams.a;
        document.getElementById('eccentricity').value = orbitParams.e;
        updateSliderValues();

        updateReferenceElements();
        updateOrbit();
        updatePeriapsisLine();
        addEventListeners();
        resizeVisualization();
        window.addEventListener('resize', resizeVisualization);
        animate();
    } catch (error) {
        console.error("Failed to initialize WebGL:", error);
        const visualizationElement = document.getElementById('orbit-visualization');
        visualizationElement.innerHTML = '<p>WebGL is not supported in your browser or hardware acceleration is disabled. Please try a different browser or enable hardware acceleration.</p>';
    }
}

function createMainLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.font = 'Bold 120px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    context.fillText(text, 512, 128);
    
    context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.lineWidth = 4;
    context.strokeText(text, 512, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ 
        map: texture,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.9
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(8, 2, 1);
    sprite.renderOrder = 1000;
    return sprite;
}

function createAxisLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.font = 'Bold 100px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    context.fillText(text, 64, 64);
    
    context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.lineWidth = 4;
    context.strokeText(text, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ 
        map: texture,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 1
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1, 1, 1);
    sprite.renderOrder = 2000;
    return sprite;
}

function createAxis(direction, color, label) {
    const group = new THREE.Group();

    // Create the axis line
    const geometry = new THREE.CylinderGeometry(0.05, 0.05, direction.length(), 32);
    const material = new THREE.MeshBasicMaterial({color: color});
    const cylinder = new THREE.Mesh(geometry, material);
    cylinder.position.copy(direction.clone().multiplyScalar(0.5));
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    group.add(cylinder);

    // Create the axis arrow
    const coneGeometry = new THREE.ConeGeometry(0.2, 0.5, 32);
    const coneMaterial = new THREE.MeshBasicMaterial({color: color});
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.copy(direction);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    group.add(cone);

    // Create the axis label
    const labelSprite = createAxisLabel(label, color);
    labelSprite.position.copy(direction.clone().multiplyScalar(1.1));
    group.add(labelSprite);

    return group;
}

function resizeVisualization() {
    const container = document.querySelector('.visualization-container');
    const visualization = document.getElementById('orbit-visualization');
    const aspectRatio = 16 / 9;

    let width = window.innerWidth;
    let height = width / aspectRatio;

    if (height > window.innerHeight) {
        height = window.innerHeight;
        width = height * aspectRatio;
    }

    container.style.width = `${width}px`;
    container.style.height = `${height}px`;

    // Update Three.js renderer and camera
    if (renderer && camera) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
}

function addEventListeners() {
    const sliders = ['semi-major-axis', 'eccentricity', 'inclination', 'raan', 'arg-periapsis', 'true-anomaly'];
    sliders.forEach(slider => {
        document.getElementById(slider).addEventListener('input', updateOrbitParams);
    });

    document.getElementById('autopan-toggle').addEventListener('change', toggleAutopan);
    document.getElementById('horizontal-angle').addEventListener('input', updateCameraPosition);
    document.getElementById('vertical-angle').addEventListener('input', updateCameraPosition);
}

function toggleAutopan(e) {
    isAutopanning = e.target.checked;
    if (!isAutopanning) {
        // Set default values when autopan is turned off
        document.getElementById('horizontal-angle').value = 62;
        document.getElementById('vertical-angle').value = -2;
        updateCameraPosition();
    }
}

function updateOrbitParams() {
    orbitParams.a = parseFloat(document.getElementById('semi-major-axis').value);
    orbitParams.e = parseFloat(document.getElementById('eccentricity').value);
    orbitParams.i = parseFloat(document.getElementById('inclination').value) * Math.PI / 180;
    orbitParams.raan = parseFloat(document.getElementById('raan').value) * Math.PI / 180;
    orbitParams.w = parseFloat(document.getElementById('arg-periapsis').value) * Math.PI / 180;
    orbitParams.nu = parseFloat(document.getElementById('true-anomaly').value) * Math.PI / 180;

    updateSliderValues();
    updateOrbit();
    updateReferenceElements();
    updateOrbitalPlaneLabel();
    updatePeriapsisLine();
}

function updateSliderValues() {
    document.getElementById('semi-major-axis-value').textContent = orbitParams.a.toFixed(1);
    document.getElementById('eccentricity-value').textContent = orbitParams.e.toFixed(2);
    document.getElementById('inclination-value').textContent = (orbitParams.i * 180 / Math.PI).toFixed(2);
    document.getElementById('raan-value').textContent = (orbitParams.raan * 180 / Math.PI).toFixed(2);
    document.getElementById('arg-periapsis-value').textContent = (orbitParams.w * 180 / Math.PI).toFixed(2);
    document.getElementById('true-anomaly-value').textContent = (orbitParams.nu * 180 / Math.PI).toFixed(2);
}

function updateOrbit() {
    if (orbit) scene.remove(orbit);

    const points = [];
    const segments = 200;

    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * 2 * Math.PI;
        const r = orbitParams.a * (1 - orbitParams.e * orbitParams.e) / (1 + orbitParams.e * Math.cos(theta));
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);

        const xRotated = x * (Math.cos(orbitParams.w) * Math.cos(orbitParams.raan) - Math.sin(orbitParams.w) * Math.cos(orbitParams.i) * Math.sin(orbitParams.raan)) -
                         y * (Math.sin(orbitParams.w) * Math.cos(orbitParams.raan) + Math.cos(orbitParams.w) * Math.cos(orbitParams.i) * Math.sin(orbitParams.raan));
        const yRotated = x * (Math.cos(orbitParams.w) * Math.sin(orbitParams.raan) + Math.sin(orbitParams.w) * Math.cos(orbitParams.i) * Math.cos(orbitParams.raan)) +
                         y * (Math.cos(orbitParams.w) * Math.cos(orbitParams.i) * Math.cos(orbitParams.raan) - Math.sin(orbitParams.w) * Math.sin(orbitParams.raan));
        const zRotated = x * Math.sin(orbitParams.w) * Math.sin(orbitParams.i) + y * Math.cos(orbitParams.w) * Math.sin(orbitParams.i);

        points.push(new THREE.Vector3(xRotated, yRotated, zRotated));
    }

    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x00FFFF }); // Cyan color
    orbit = new THREE.Line(orbitGeometry, orbitMaterial);
    scene.add(orbit);

    updateSatellitePosition();
    updateSliderValues();
}

function updateSatellitePosition() {
    const r = orbitParams.a * (1 - orbitParams.e * orbitParams.e) / (1 + orbitParams.e * Math.cos(orbitParams.nu));
    const x = r * Math.cos(orbitParams.nu);
    const y = r * Math.sin(orbitParams.nu);

    const xRotated = x * (Math.cos(orbitParams.w) * Math.cos(orbitParams.raan) - Math.sin(orbitParams.w) * Math.cos(orbitParams.i) * Math.sin(orbitParams.raan)) -
                     y * (Math.sin(orbitParams.w) * Math.cos(orbitParams.raan) + Math.cos(orbitParams.w) * Math.cos(orbitParams.i) * Math.sin(orbitParams.raan));
    const yRotated = x * (Math.cos(orbitParams.w) * Math.sin(orbitParams.raan) + Math.sin(orbitParams.w) * Math.cos(orbitParams.i) * Math.cos(orbitParams.raan)) +
                     y * (Math.cos(orbitParams.w) * Math.cos(orbitParams.i) * Math.cos(orbitParams.raan) - Math.sin(orbitParams.w) * Math.sin(orbitParams.raan));
    const zRotated = x * Math.sin(orbitParams.w) * Math.sin(orbitParams.i) + y * Math.cos(orbitParams.w) * Math.sin(orbitParams.i);

    satellite.position.set(xRotated, yRotated, zRotated);
    
    // Update satellite label position
    if (satelliteLabel) {
        satelliteLabel.position.set(xRotated, yRotated + 0.5, zRotated);
    }
}

function updateReferenceElements() {
    // Remove existing elements
    [xyPlane, orbitalPlane, lineOfNodes, xyPlaneLabel, orbitalPlaneLabel, lineOfNodesLabel].forEach(elem => {
        if (elem) scene.remove(elem);
    });

    // Create XY reference plane (semi-transparent light blue)
    const xyGeometry = new THREE.PlaneGeometry(12, 12);
    const xyMaterial = new THREE.MeshBasicMaterial({ color: 0xADD8E6, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
    xyPlane = new THREE.Mesh(xyGeometry, xyMaterial);
    xyPlane.renderOrder = -2;
    scene.add(xyPlane);

    // Create orbital plane (semi-transparent light orange)
    const orbitalGeometry = new THREE.PlaneGeometry(12, 12);
    const orbitalMaterial = new THREE.MeshBasicMaterial({ color: 0xFFDAB9, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
    orbitalPlane = new THREE.Mesh(orbitalGeometry, orbitalMaterial);
    updateOrbitalPlaneOrientation();
    orbitalPlane.renderOrder = -1;
    scene.add(orbitalPlane);

    // Create line of nodes only if planes are not coplanar
    const epsilon = 1e-6; // Threshold for considering planes coplanar
    if (Math.abs(Math.sin(orbitParams.i)) > epsilon) {
        // Calculate the direction of the line of nodes
        const lineDirection = new THREE.Vector3(
            Math.cos(orbitParams.raan),
            Math.sin(orbitParams.raan),
            0
        ).normalize();

        const lineLength = 12;
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3().addScaledVector(lineDirection, -lineLength/2),
            new THREE.Vector3().addScaledVector(lineDirection, lineLength/2)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x8A2BE2 });
        lineOfNodes = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(lineOfNodes);

        // Add line of nodes label
        lineOfNodesLabel = createMainLabel("Line of Nodes", 0x8A2BE2);
        lineOfNodesLabel.position.copy(lineDirection.multiplyScalar(lineLength/2 + 0.5));
        scene.add(lineOfNodesLabel);
    }

    // Update labels
    xyPlaneLabel = createMainLabel("Reference Plane", 0xADD8E6);
    xyPlaneLabel.position.set(8, -0.5, 0);
    scene.add(xyPlaneLabel);

    orbitalPlaneLabel = createMainLabel("Orbital Plane", 0xFFDAB9);
    updateOrbitalPlaneLabel();
    scene.add(orbitalPlaneLabel);
}

function updateOrbitalPlaneOrientation() {
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationZ(orbitParams.raan);
    rotationMatrix.multiply(new THREE.Matrix4().makeRotationX(orbitParams.i));
    orbitalPlane.setRotationFromMatrix(rotationMatrix);
}

function updateOrbitalPlaneLabel() {
    if (!orbitalPlaneLabel) return;

    const inclination = orbitParams.i;
    const raan = orbitParams.raan;
    
    // Calculate a point on the orbital plane
    const radius = 6; // Reduced radius to keep label closer to the center
    const x = -radius * Math.cos(raan); // Negated x to reflect across Y-axis
    const y = radius * Math.sin(inclination) + 2; // Added Y-offset of 2 units
    const z = radius * Math.sin(raan) * Math.cos(inclination);

    // Position the label slightly above the orbital plane
    const offset = 0.5; // Adjust this value to move the label closer to or further from the plane
    const normalVector = new THREE.Vector3(
        Math.sin(inclination) * Math.sin(raan),
        Math.cos(inclination),
        -Math.sin(inclination) * Math.cos(raan)
    ).normalize();

    orbitalPlaneLabel.position.set(
        x + normalVector.x * offset,
        y + normalVector.y * offset,
        z + normalVector.z * offset
    );

    // Ensure the label is always facing the camera
    orbitalPlaneLabel.quaternion.copy(camera.quaternion);
}

function updatePeriapsisLine() {
    // Remove existing line and label if they exist
    if (periapsisLine) scene.remove(periapsisLine);
    if (periapsisLabel) scene.remove(periapsisLabel);

    // Calculate periapsis position in the orbital plane
    const periapsisDistance = orbitParams.a * (1 - orbitParams.e);
    const periapsisPosition = new THREE.Vector3(
        periapsisDistance * Math.cos(orbitParams.w),
        periapsisDistance * Math.sin(orbitParams.w),
        0
    );

    // Rotate the periapsis position based on inclination and RAAN
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationZ(orbitParams.raan);
    rotationMatrix.multiply(new THREE.Matrix4().makeRotationX(orbitParams.i));
    periapsisPosition.applyMatrix4(rotationMatrix);

    // Create line geometry
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        periapsisPosition
    ]);

    // Create dashed line material
    const lineMaterial = new THREE.LineDashedMaterial({
        color: 0xFFFFFF,
        dashSize: 0.2,
        gapSize: 0.1,
    });

    // Create the line and compute line distances (required for dashed lines)
    periapsisLine = new THREE.Line(lineGeometry, lineMaterial);
    periapsisLine.computeLineDistances();
    scene.add(periapsisLine);

    // Create label for periapsis
    periapsisLabel = createMainLabel("Periapsis", 0xFFFFFF);
    
    // Position label above the dashed line and within the orbit ellipse
    const labelPosition = periapsisPosition.clone().multiplyScalar(0.8); // Adjust this factor to move the label
    const normalVector = new THREE.Vector3(
        Math.sin(orbitParams.i) * Math.sin(orbitParams.raan),
        -Math.sin(orbitParams.i) * Math.cos(orbitParams.raan),
        Math.cos(orbitParams.i)
    ).normalize();
    const offset = -0.5; // Adjust this value to move the label higher above the orbital plane
    labelPosition.add(normalVector.multiplyScalar(offset));

    // Additional downward shift
    labelPosition.y -= 0.5; // Adjust this value to shift the label higher

    periapsisLabel.position.copy(labelPosition);

    scene.add(periapsisLabel);
}

function updateCameraPosition() {
    if (!isAutopanning) {
        cameraAngleHorizontal = parseFloat(document.getElementById('horizontal-angle').value) * Math.PI / 180;
        cameraAngleVertical = parseFloat(document.getElementById('vertical-angle').value) * Math.PI / 180;

        const radius = 20; // Adjust this value to change the camera distance
        camera.position.x = radius * Math.cos(cameraAngleVertical) * Math.cos(cameraAngleHorizontal);
        camera.position.y = radius * Math.sin(cameraAngleVertical);
        camera.position.z = radius * Math.cos(cameraAngleVertical) * Math.sin(cameraAngleHorizontal);
        camera.lookAt(scene.position);

        document.getElementById('horizontal-angle-value').textContent = (cameraAngleHorizontal * 180 / Math.PI).toFixed(0);
        document.getElementById('vertical-angle-value').textContent = (cameraAngleVertical * 180 / Math.PI).toFixed(0);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (isAutopanning) {
        const time = Date.now() * 0.001;
        const radius = 20; // Keep this consistent with updateCameraPosition
        camera.position.x = radius * Math.cos(time * 0.1);
        camera.position.z = radius * Math.sin(time * 0.1);
        camera.lookAt(scene.position);
    } else {
        updateCameraPosition();
    }

    // Update orbital plane label position
    updateOrbitalPlaneLabel();

    // Update all labels
    const labels = [centralBodyLabel, satelliteLabel, xyPlaneLabel, orbitalPlaneLabel, lineOfNodesLabel, periapsisLabel];
    labels.forEach(label => {
        if (label) {
            label.material.rotation = 0;
            const distance = camera.position.distanceTo(label.position);
            const scale = Math.max(distance / 30, 0.3);
            label.scale.set(scale * 8, scale * 2, 1);
            label.renderOrder = 1000 + distance;
        }
    });

    // Update axis labels
    [xAxis, yAxis, zAxis].forEach(axis => {
        if (axis && axis.children[2]) {
            const label = axis.children[2];
            label.material.rotation = 0;
            const distance = camera.position.distanceTo(label.position);
            const scale = Math.max(distance / 20, 0.5);
            label.scale.set(scale, scale, 1);
            label.renderOrder = 2000 + distance;
        }
    });

    // Update satellite label position
    if (satelliteLabel && satellite) {
        satelliteLabel.position.copy(satellite.position).add(new THREE.Vector3(0, 0.5, 0));
    }

    renderer.render(scene, camera);
}

init();