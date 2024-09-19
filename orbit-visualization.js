import * as THREE from 'https://unpkg.com/three@0.134.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.134.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let orbit, centralBody, satellite;
let orbitParams = {
    a: 5,
    e: 0.5,
    i: 0,
    raan: 0,
    w: 0,
    nu: 0
};

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth * 0.6, 400);
    document.getElementById('orbit-visualization').appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);

    const centralBodyGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const centralBodyMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    centralBody = new THREE.Mesh(centralBodyGeometry, centralBodyMaterial);
    scene.add(centralBody);

    const satelliteGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
    scene.add(satellite);

    camera.position.z = 15;

    updateOrbit();
    addEventListeners();
    animate();
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
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();