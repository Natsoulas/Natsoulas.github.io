console.log("Attitude visualization script loaded");

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

let scene, camera, renderer;
let satellite; // group representing Sputnik
let isDragging = false;
let prevMouse = {x:0, y:0};
const dragSensitivity = 0.01;

function init(){
    const container = document.getElementById('attitude-visualization');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const aspect = container.clientWidth/container.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(0,0,6);

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5,5,5);
    scene.add(dirLight);

    createSputnik();

    addEventListeners(container);
    populateDCMInputs();
    updateDisplaysFromQuaternion(satellite.quaternion);

    window.addEventListener('resize', resizeVisualization);
    resizeVisualization();

    animate();
}

function createSputnik(){
    satellite = new THREE.Group();
    // main body sphere
    const bodyGeom = new THREE.SphereGeometry(0.6, 32, 32);
    const bodyMat = new THREE.MeshStandardMaterial({color:0xbfbfbf, metalness:0.7, roughness:0.2});
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    satellite.add(body);

    // four antennas
    const antennaLength = 5.0;
    const antennaGeom = new THREE.CylinderGeometry(0.013,0.013,antennaLength,10);
    const antennaMat = new THREE.MeshStandardMaterial({color:0xe0e0e0, metalness:1.0, roughness:0.05});

    const offset = 0.3;
    const directions = [
        new THREE.Vector3(-1,  offset,  0),
        new THREE.Vector3(-1, -offset,  0),
        new THREE.Vector3(-1,   0,   offset),
        new THREE.Vector3(-1,   0,  -offset)
    ];

    const sphereRadius = 0.6;
    directions.forEach(dir=>{
        const ant = new THREE.Mesh(antennaGeom, antennaMat);
        // orient cylinder (default along +Y) to dir
        ant.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
        // place so that one end touches sphere surface
        ant.position.copy(dir.clone().normalize().multiplyScalar(sphereRadius + antennaLength/2));
        satellite.add(ant);
    });

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
    const container = document.querySelector('.visualization-container');
    const viz = document.getElementById('attitude-visualization');
    const controls = document.querySelector('.controls-overlay');

    let width = container.clientWidth;
    let height = container.clientHeight;

    if(window.innerWidth > 768){
        width -= controls.offsetWidth;
    } else {
        height = window.innerHeight*0.5;
    }

    viz.style.width = `${width}px`;
    viz.style.height = `${height}px`;

    if(renderer && camera){
        renderer.setSize(width,height);
        camera.aspect = width/height;
        camera.updateProjectionMatrix();
    }
}

function onWindowResize(){
    resizeVisualization();
}

function animate(){
    requestAnimationFrame(animate);
    renderer.render(scene,camera);
}

// kick off
init(); 