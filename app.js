import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.161.0/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';

const container = document.body;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);

const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.0);
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(0.5, 1, 0.3);
scene.add(directionalLight);

const loader = new GLTFLoader();
const modelConfigs = [
  {
    name: 'stoneBuddha',
    url: 'https://raw.githubusercontent.com/ThinukaVinjaya/vesakmodels/main/stone_buddha_statue.glb',
    scale: 0.6,
    position: [0.0, 0.0, -0.2],
    rotation: [0, Math.PI, 0]
  },
  {
    name: 'buddha',
    url: 'https://raw.githubusercontent.com/ThinukaVinjaya/vesakmodels/main/budha_statue.glb',
    scale: 0.55,
    position: [-0.65, 0.0, -0.25],
    rotation: [0, Math.PI / 1.8, 0]
  },
  {
    name: 'lotus1',
    url: 'https://raw.githubusercontent.com/ThinukaVinjaya/vesakmodels/main/lotus1.glb',
    scale: 0.12,
    position: [0.3, 0.0, 0.05],
    rotation: [0, 0, 0]
  },
  {
    name: 'lotus2',
    url: 'https://raw.githubusercontent.com/ThinukaVinjaya/vesakmodels/main/lotus_flower2.glb',
    scale: 0.12,
    position: [-0.35, 0.0, 0.15],
    rotation: [0, Math.PI / 2, 0]
  },
  {
    name: 'lotusLantern',
    url: 'https://raw.githubusercontent.com/ThinukaVinjaya/vesakmodels/main/lotus_lanttern.glb',
    scale: 0.1,
    position: [0.5, 0.05, -0.3],
    rotation: [0, -Math.PI / 4, 0]
  },
  {
    name: 'vesakLantern',
    url: 'https://raw.githubusercontent.com/ThinukaVinjaya/vesakmodels/main/vesak_lanterns.glb',
    scale: 0.1,
    position: [-0.55, 0.05, -0.35],
    rotation: [0, Math.PI / 6, 0]
  },
  {
    name: 'sthupa',
    url: 'https://raw.githubusercontent.com/ThinukaVinjaya/vesakmodels/main/sthupa_srilanka.glb',
    scale: 0.35,
    position: [0.0, 0.0, 0.9],
    rotation: [0, Math.PI, 0]
  }
];

const instructions = document.getElementById('message');
const buttonContainer = document.getElementById('buttonContainer');

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.15, 0.22, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x00ffcc, opacity: 0.75, transparent: true })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

let hitTestSource = null;
let localSpace = null;
let placedGroup = null;
let isPlaced = false;

function createARButton() {
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
      if (supported) {
        const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
        buttonContainer.appendChild(arButton);
      } else {
        instructions.textContent = 'WebXR immersive-ar not available on this device. Use a compatible browser on mobile with AR support.';
      }
    });
  } else {
    instructions.textContent = 'WebXR is not available in this browser. Use Chrome/Edge on a compatible AR-capable device.';
  }
}

function onSessionStart() {
  const session = renderer.xr.getSession();
  session.addEventListener('select', onSelect);

  session.requestReferenceSpace('viewer').then((referenceSpace) => {
    session.requestHitTestSource({ space: referenceSpace }).then((source) => {
      hitTestSource = source;
    });
  });

  session.requestReferenceSpace('local').then((referenceSpace) => {
    localSpace = referenceSpace;
  });

  session.addEventListener('end', () => {
    hitTestSource = null;
    localSpace = null;
    reticle.visible = false;
    isPlaced = false;
    if (placedGroup) {
      scene.remove(placedGroup);
      placedGroup = null;
    }
    instructions.textContent = 'Tap the button to start AR, then tap the real-world surface to place the Vesak scene.';
  });
}

function onSelect() {
  if (!reticle.visible || isPlaced) return;

  placedGroup = new THREE.Group();
  placedGroup.position.setFromMatrixPosition(reticle.matrix);
  placedGroup.quaternion.setFromRotationMatrix(reticle.matrix);

  modelConfigs.forEach((config) => {
    if (config.scene) {
      const clone = config.scene.clone(true);
      clone.scale.setScalar(config.scale);
      clone.position.set(...config.position);
      clone.rotation.set(...config.rotation);
      placedGroup.add(clone);
    }
  });

  scene.add(placedGroup);
  isPlaced = true;
  reticle.visible = false;
  instructions.textContent = 'Vesak scene placed. Move around to view the fixed AR shrine.';
}

function loadModels() {
  const promises = modelConfigs.map((config) =>
    loader.loadAsync(config.url).then((gltf) => {
      config.scene = gltf.scene;
      config.scene.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          if (!node.material.emissive) node.material.emissive = new THREE.Color(0x000000);
        }
      });
    }).catch((error) => {
      console.warn(`Failed to load ${config.name}:`, error);
    })
  );

  return Promise.all(promises);
}

function animate(timestamp, frame) {
  if (frame && hitTestSource && localSpace) {
    const hitTestResults = frame.getHitTestResults(hitTestSource);

    if (hitTestResults.length > 0 && !isPlaced) {
      const hit = hitTestResults[0];
      const pose = hit.getPose(localSpace);
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      instructions.textContent = 'Tap anywhere on the screen to place the Vesak models at this fixed location.';
    } else if (!isPlaced) {
      reticle.visible = false;
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

loadModels().then(() => {
  createARButton();
  instructions.textContent = 'Ready for AR. Use the button below to start the session.';
});

renderer.xr.addEventListener('sessionstart', onSessionStart);
renderer.setAnimationLoop(animate);
