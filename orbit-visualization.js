console.log("Orbit visualization script loaded");

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

let scene, camera, renderer;
let orbit, centralBody, satellite;
let xAxis, yAxis, zAxis;  // New variables for the basis vectors
let orbitParams = {
    a: 5,
    e: 0.5,
    i: 0,
    raan: 0,
    w: 0,
    nu: 0
};

function init() {
    try {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        const visualizationElement = document.getElementById('orbit-visualization');
        renderer.setSize(visualizationElement.clientWidth, visualizationElement.clientHeight);
        visualizationElement.appendChild(renderer.domElement);

        const centralBodyGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const centralBodyMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        centralBody = new THREE.Mesh(centralBodyGeometry, centralBodyMaterial);
        scene.add(centralBody);

        const satelliteGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
        scene.add(satellite);

        // Add inertial basis vectors
        const arrowLength = 2;
        const arrowColor = 0xff0000;  // Red color for the arrows
        xAxis = createArrow(new THREE.Vector3(arrowLength, 0, 0), arrowColor);
        yAxis = createArrow(new THREE.Vector3(0, arrowLength, 0), arrowColor);
        zAxis = createArrow(new THREE.Vector3(0, 0, arrowLength), arrowColor);
        scene.add(xAxis);
        scene.add(yAxis);
        scene.add(zAxis);

        camera.position.z = 15;

        updateOrbit();
        addEventListeners();
        animate();

        window.addEventListener('resize', onWindowResize);
    } catch (error) {
        console.error("Failed to initialize WebGL:", error);
        const visualizationElement = document.getElementById('orbit-visualization');
        visualizationElement.innerHTML = '<p>WebGL is not supported in your browser or hardware acceleration is disabled. Please try a different browser or enable hardware acceleration.</p>';
    }
}

function createArrow(direction, color) {
    const arrowHelper = new THREE.ArrowHelper(
        direction.normalize(),
        new THREE.Vector3(0, 0, 0),
        direction.length(),
        color,
        0.2,  // Head length
        0.1   // Head width
    );
    return arrowHelper;
}

function onWindowResize() {
    const visualizationElement = document.getElementById('orbit-visualization');
    camera.aspect = visualizationElement.clientWidth / visualizationElement.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(visualizationElement.clientWidth, visualizationElement.clientHeight);
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
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
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
}

function animate() {
    if (!renderer) return;  // Exit if renderer wasn't created successfully

    requestAnimationFrame(animate);
    
    // Rotate camera around the scene
    const time = Date.now() * 0.001;
    const radius = 15;
    camera.position.x = Math.cos(time * 0.1) * radius;
    camera.position.z = Math.sin(time * 0.1) * radius;
    camera.lookAt(scene.position);

    // Update the orientation of the basis vectors to always face the camera
    xAxis.lookAt(camera.position);
    yAxis.lookAt(camera.position);
    zAxis.lookAt(camera.position);

    renderer.render(scene, camera);
}

init();