import * as THREE from 'three';
import { ObjParser } from './json-parser/index';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

console.log(`three ${THREE.REVISION}`);

// setup renderer
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(new THREE.Color('#fff'));

export function getDomElement() { return renderer.domElement; }

// 2 meters
const interestArea = 2;

// setup camera and handle resize (renderer and camera)
const camera = new THREE.PerspectiveCamera();

camera.fov = 55;
camera.near = 0.1;
camera.far = 500;
camera.position.set(1600, 200, 0).normalize().multiplyScalar(interestArea);
camera.lookAt(0, 0, 0);

export function resize(width: number, height: number) {
    const size = renderer.getSize(new THREE.Vector2());
    if (Math.abs(size.x - width) > Number.EPSILON || Math.abs(size.y - height) > Number.EPSILON) {
        renderer.setSize(width, height, true);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
}

// setup scene and controls
const orbitControls = new OrbitControls(camera, renderer.domElement);
const scene = new THREE.Scene();
// const model = new ObjParser('/build/model.json', scene)
orbitControls.enablePan = false;
orbitControls.enableDamping = false;
orbitControls.dampingFactor = .1;
orbitControls.target.setScalar(0);
const ambient = new THREE.AmbientLight(0x000000, 1)
const light = new THREE.AmbientLight(0x404040, 5); // soft white light

scene.add(camera);
scene.add(ambient);
scene.add(light);

// define update loop
function update(timestamp: number) {
    requestAnimationFrame(update);

    orbitControls.update();
    renderer.render(scene, camera);
}

function debug() {
    const axesHelper = new THREE.AxesHelper();
    scene.add(axesHelper);
    const gridHelper = new THREE.GridHelper(2, 4);
    gridHelper.position.y = -1 / 1000; // -1mm
    scene.add(gridHelper);
}

export function createDemo() {
    debug();
    requestAnimationFrame(update);
}



window.addEventListener('load', () => {

    // const mod = model.returnMainModel()
    // mod?.scale.set(0.001, 0.001, 0.001)

    // if (mod) {
    //     scene.add(mod)
    // }


    const actualBtn = document.getElementById('actual-btn');

    const fileChosen = document.getElementById('file-chosen');

    if (!actualBtn) return
    if (!fileChosen) return

    actualBtn.addEventListener('change', function () {
        readURL(this as HTMLInputElement)
    })

    function readURL(input: HTMLInputElement) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();

            reader.onload = function (e) {
                // console.log(e.target.result)
                if (e.target && e.target.result) {
                    const modelPar = e.target.result as string
                    new ObjParser(modelPar, scene)
                }
            }

            reader.readAsDataURL(input.files[0]);
        }
    }


});