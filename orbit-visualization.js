console.log("Orbit visualization script loaded");

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

let scene, camera, renderer;
let orbit, centralBody, satellite;
let xAxis, yAxis, zAxis;
let centralBodyLabel, satelliteLabel;
let orbitParams = {
    a: 5,
    e: 0.5,
    i: 0,
    raan: 0,
    w: 0,
    nu: 0
};

let xyPlane, orbitalPlane, lineOfNodes;
let xyPlaneLabel, orbitalPlaneLabel, lineOfNodesLabel;

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
        centralBodyLabel = createLabel("Central Body", 0xffff00, true);
        centralBodyLabel.position.set(0, -3.5, 0); // Moved further down
        scene.add(centralBodyLabel);

        const satelliteGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0xFF00FF }); // Magenta color
        satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
        scene.add(satellite);

        // Add label for satellite
        satelliteLabel = createLabel("Satellite", 0xFF00FF);
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

        updateOrbit();
        updateReferenceElements();
        addEventListeners();
        animate();

        window.addEventListener('resize', onWindowResize);
    } catch (error) {
        console.error("Failed to initialize WebGL:", error);
        const visualizationElement = document.getElementById('orbit-visualization');
        visualizationElement.innerHTML = '<p>WebGL is not supported in your browser or hardware acceleration is disabled. Please try a different browser or enable hardware acceleration.</p>';
    }
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

    // Create the axis label using the createLabel function
    const labelSprite = createLabel(label, color);
    labelSprite.position.copy(direction.clone().multiplyScalar(1.3)); // Moved label further out
    labelSprite.scale.set(1, 0.5, 1); // Increased size
    group.add(labelSprite);

    return group;
}

function createLabel(text, color, isVertical = false) {
    const canvas = document.createElement('canvas');
    canvas.width = isVertical ? 512 : 1024;  // Doubled canvas size
    canvas.height = isVertical ? 1024 : 512;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.font = isVertical ? 'Bold 160px Arial' : 'Bold 240px Arial';  // Doubled font size
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    if (isVertical) {
        const words = text.split(' ');
        words.forEach((word, index) => {
            context.fillText(word, 256, 256 + (index - 0.5) * 280);  // Adjusted positioning
        });
    } else {
        context.fillText(text, 512, 256);
    }
    
    context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.lineWidth = 16;  // Doubled line width
    
    if (isVertical) {
        const words = text.split(' ');
        words.forEach((word, index) => {
            context.strokeText(word, 256, 256 + (index - 0.5) * 280);  // Adjusted positioning
        });
    } else {
        context.strokeText(text, 512, 256);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(isVertical ? 6 : 12, isVertical ? 12 : 6, 1);  // Doubled initial scale
    sprite.renderOrder = 1;
    return sprite;
}

function onWindowResize() {
    const visualizationElement = document.getElementById('orbit-visualization');
    const aspect = visualizationElement.clientWidth / visualizationElement.clientHeight;
    const fov = aspect < 1 ? 90 : 60;
    camera.fov = fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(visualizationElement.clientWidth, visualizationElement.clientHeight);

    const cameraDistance = aspect < 1 ? 25 : 20;
    camera.position.z = cameraDistance;
}

function addEventListeners() {
    const sliders = ['semi-major-axis', 'eccentricity', 'inclination', 'raan', 'arg-periapsis', 'true-anomaly'];
    sliders.forEach(slider => {
        document.getElementById(slider).addEventListener('input', updateOrbitParams);
    });
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
    updateOrbitalPlaneOrientation();
    updateReferenceElements();
    updateOrbitalPlaneLabel();
}

function updateSliderValues() {
    document.getElementById('semi-major-axis-value').textContent = orbitParams.a.toFixed(2);
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
    satelliteLabel.position.set(xRotated, yRotated + 0.5, zRotated); // Moved closer to satellite
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
        const lineOfNodesDirection = new THREE.Vector3(Math.cos(orbitParams.raan), 0, -Math.sin(orbitParams.raan));
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3().addScaledVector(lineOfNodesDirection, -6),
            new THREE.Vector3().addScaledVector(lineOfNodesDirection, 6)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x8A2BE2 });
        lineOfNodes = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(lineOfNodes);

        // Add line of nodes label
        lineOfNodesLabel = createLabel("Line of Nodes", 0x8A2BE2);
        lineOfNodesLabel.position.copy(lineOfNodesDirection.multiplyScalar(6.5));
        scene.add(lineOfNodesLabel);
    }

    // Add other labels
    xyPlaneLabel = createLabel("XY Plane", 0xADD8E6);
    xyPlaneLabel.position.set(6, -1, 0);
    scene.add(xyPlaneLabel);

    orbitalPlaneLabel = createLabel("Orbital Plane", 0xFFDAB9);
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
    const inclination = orbitParams.i;
    const raan = orbitParams.raan;
    const x = 6.5 * Math.cos(raan);
    const y = 6.5 * Math.sin(inclination);
    const z = -6.5 * Math.sin(raan) * Math.cos(inclination);
    orbitalPlaneLabel.position.set(x, y, z);
}

function animate() {
    if (!renderer) return;

    requestAnimationFrame(animate);
    
    // Rotate camera around the scene
    const time = Date.now() * 0.001;
    const radius = 15;
    camera.position.x = Math.cos(time * 0.1) * radius;
    camera.position.z = Math.sin(time * 0.1) * radius;
    camera.lookAt(scene.position);

    // Update orientations for all labels
    xAxis.children[2].lookAt(camera.position);
    yAxis.children[2].lookAt(camera.position);
    zAxis.children[2].lookAt(camera.position);
    centralBodyLabel.lookAt(camera.position);
    satelliteLabel.lookAt(camera.position);
    xyPlaneLabel.lookAt(camera.position);
    orbitalPlaneLabel.lookAt(camera.position);
    lineOfNodesLabel.lookAt(camera.position);

    // Ensure labels are always upright
    const upVector = new THREE.Vector3(0, 1, 0);
    xAxis.children[2].up.copy(upVector);
    yAxis.children[2].up.copy(upVector);
    zAxis.children[2].up.copy(upVector);
    centralBodyLabel.up.copy(upVector);
    satelliteLabel.up.copy(upVector);
    xyPlaneLabel.up.copy(upVector);
    orbitalPlaneLabel.up.copy(upVector);
    lineOfNodesLabel.up.copy(upVector);

    // Scale all labels based on distance to camera
    const labelScale = camera.position.length() / 15;
    xAxis.children[2].scale.set(labelScale, labelScale / 2, 1);
    yAxis.children[2].scale.set(labelScale, labelScale / 2, 1);
    zAxis.children[2].scale.set(labelScale, labelScale / 2, 1);
    centralBodyLabel.scale.set(labelScale / 2, labelScale, 1);
    satelliteLabel.scale.set(labelScale, labelScale / 2, 1);
    xyPlaneLabel.scale.set(labelScale, labelScale / 2, 1);
    orbitalPlaneLabel.scale.set(labelScale, labelScale / 2, 1);
    lineOfNodesLabel.scale.set(labelScale, labelScale / 2, 1);

    // Ensure labels are always on top
    xyPlaneLabel.renderOrder = 1;
    orbitalPlaneLabel.renderOrder = 1;
    lineOfNodesLabel.renderOrder = 1;
    centralBodyLabel.renderOrder = 1;
    satelliteLabel.renderOrder = 1;

    renderer.render(scene, camera);
}

init();