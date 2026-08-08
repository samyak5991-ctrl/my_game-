import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as CANNON from 'cannon-es'

// Basic app scaffold: scene, renderer, camera
const canvasContainer = document.getElementById('app')!

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x88ccee)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 6, 10)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
canvasContainer.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1.5, 0)
controls.update()

// Lighting
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0)
hemi.position.set(0, 50, 0)
scene.add(hemi)
const dir = new THREE.DirectionalLight(0xffffff, 0.8)
dir.position.set(10, 20, 10)
scene.add(dir)

// Physics world
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
world.broadphase = new CANNON.NaiveBroadphase()
world.solver.iterations = 6

// Ground
const groundMat = new THREE.MeshStandardMaterial({ color: 0x556655 })
const groundGeo = new THREE.PlaneGeometry(200, 200)
const groundMesh = new THREE.Mesh(groundGeo, groundMat)
groundMesh.rotation.x = -Math.PI / 2
scene.add(groundMesh)

const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: new CANNON.Material() })
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
world.addBody(groundBody)

// Simple environment obstacles
function addBox(x: number, y: number, z: number, sx=2, sy=2, sz=2) {
  const geo = new THREE.BoxGeometry(sx, sy, sz)
  const mat = new THREE.MeshStandardMaterial({ color: 0x884444 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  scene.add(mesh)

  const shape = new CANNON.Box(new CANNON.Vec3(sx/2, sy/2, sz/2))
  const body = new CANNON.Body({ mass: 0, shape })
  body.position.set(x, y, z)
  world.addBody(body)
}

addBox( -10, 1, -5, 4, 2, 10)
addBox( 10, 1, 5, 4, 2, 10)
addBox( 0, 1, -25, 20, 2, 4)

// Simple car (box) with physics body
const carSize = { x: 2, y: 0.8, z: 4 }
const carGeo = new THREE.BoxGeometry(carSize.x, carSize.y, carSize.z)
const carMat = new THREE.MeshStandardMaterial({ color: 0x00aaee })
const carMesh = new THREE.Mesh(carGeo, carMat)
carMesh.position.set(0, 1, 0)
scene.add(carMesh)

const carShape = new CANNON.Box(new CANNON.Vec3(carSize.x/2, carSize.y/2, carSize.z/2))
const carBody = new CANNON.Body({ mass: 1200 })
carBody.addShape(carShape)
carBody.position.set(0, 1, 0)
carBody.linearDamping = 0.2
carBody.angularDamping = 0.5
world.addBody(carBody)

// Simple "many cars" - spawn a few AI static cars as obstacles
const otherCars: THREE.Mesh[] = []
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(carGeo, new THREE.MeshStandardMaterial({ color: Math.random()*0xffffff }))
  m.position.set((Math.random()-0.5)*50, 1, (Math.random()-0.5)*50)
  scene.add(m)
  otherCars.push(m)
  const b = new CANNON.Body({ mass: 0 })
  b.addShape(carShape)
  b.position.set(m.position.x, m.position.y, m.position.z)
  world.addBody(b)
}

// Player state
let inCar = true
let damage = 0 // 0..100
let speed = 0
let maxSpeed = 30

// Controls
const keys: Record<string, boolean> = {}
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key === 'm') toggleModMenu() })
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false })

// Touch detection for mobile
const isMobile = /Mobi|Android/i.test(navigator.userAgent)
if (isMobile) {
  document.getElementById('touch-controls')!.classList.remove('hidden')
}

// Damage handling via collision
carBody.addEventListener('collide', (e: any) => {
  // try to get impact; fall back to relative velocity magnitude
  let impact = 0
  try {
    if (e.contact && typeof e.contact.getImpactVelocityAlongNormal === 'function') {
      impact = Math.abs(e.contact.getImpactVelocityAlongNormal())
    } else if (e.contact) {
      const vi = e.contact.bi.velocity
      const vj = e.contact.bj.velocity
      const rel = vi.vsub(vj)
      impact = rel.length()
    }
  } catch (err) {
    impact = carBody.velocity.length()
  }
  if (impact > 1.0) {
    const added = Math.min(impact * 3, 20)
    damage = Math.min(100, damage + added)
    // visual: flash tint and dent
    carMat.color.offsetHSL(-0.02, -0.2, -0.1)
    // reduce performance based on damage
    maxSpeed = Math.max(8, 30 * (1 - damage / 120))
    // spawn smoke when heavy damage
    if (damage > 60) spawnSmoke(carMesh.position)
  }
})

// Simple smoke particle (placeholder)
function spawnSmoke(pos: THREE.Vector3) {
  const geo = new THREE.SphereGeometry(0.1, 8, 8)
  const mat = new THREE.MeshStandardMaterial({ color: 0x333333, transparent: true, opacity: 0.8 })
  const m = new THREE.Mesh(geo, mat)
  m.position.copy(pos)
  scene.add(m)
  let t = 0
  const int = setInterval(() => {
    t += 0.1
    m.position.y += 0.02
    m.scale.multiplyScalar(1.05)
    m.material.opacity *= 0.96
    if (t > 2) { scene.remove(m); clearInterval(int) }
  }, 100)
}

// Simple speed/damage HUD update
function updateHUD() {
  const speedEl = document.getElementById('speed')!
  const dmgEl = document.getElementById('damage')!
  speedEl.textContent = `Speed: ${Math.round(speed)} km/h`
  dmgEl.textContent = `Damage: ${Math.round(damage)}%`
}

// Enter/exit car
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'e') toggleEnterExit()
})

function toggleEnterExit() {
  inCar = !inCar
  if (!inCar) {
    // spawn a simple player box
    const pGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6)
    const pMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 })
    const p = new THREE.Mesh(pGeo, pMat)
    p.position.copy(carMesh.position).add(new THREE.Vector3(1.5, 0, 0))
    scene.add(p)
  } else {
    // remove player mesh in a simple way (not tracking in this prototype)
  }
}

// Mod menu
const modMenu = document.getElementById('mod-menu')!
const toggleFly = document.getElementById('toggle-fly') as HTMLInputElement
const toggleNoclip = document.getElementById('toggle-noclip') as HTMLInputElement
const closeMod = document.getElementById('close-mod')!

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') { modMenu.classList.toggle('hidden') }
})
closeMod.addEventListener('click', () => modMenu.classList.add('hidden'))

let flyEnabled = false
let noclipEnabled = false

toggleFly.addEventListener('change', () => {
  flyEnabled = toggleFly.checked
  if (flyEnabled) {
    carBody.gravityScale = 0
  }
})

toggleNoclip.addEventListener('change', () => {
  noclipEnabled = toggleNoclip.checked
  if (noclipEnabled) {
    // disable collisions by setting collisionFilterMask to 0
    carBody.collisionFilterMask = 0
  } else {
    carBody.collisionFilterMask = -1
  }
})

// Main loop and simple driving model
let lastTime = performance.now()
function animate() {
  requestAnimationFrame(animate)
  const now = performance.now()
  const dt = Math.min(1/30, (now - lastTime) / 1000)
  lastTime = now

  // basic input mapping
  let forward = 0
  let turn = 0
  if (keys['w'] || keys['arrowup']) forward = 1
  if (keys['s'] || keys['arrowdown']) forward = -1
  if (keys['a'] || keys['arrowleft']) turn = 1
  if (keys['d'] || keys['arrowright']) turn = -1

  // current forward velocity along car's forward
  const quaternion = new THREE.Quaternion(carBody.quaternion.x, carBody.quaternion.y, carBody.quaternion.z, carBody.quaternion.w)
  const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion)
  const vel = new THREE.Vector3(carBody.velocity.x, carBody.velocity.y, carBody.velocity.z)
  const localForwardVel = vel.dot(forwardVec)
  speed = localForwardVel * 3.6 // convert m/s to km/h roughly

  // simple throttle/brake
  const accel = 40 * (1 - damage/150)
  const brake = 80
  if (forward > 0) {
    const force = forwardVec.multiplyScalar(accel)
    carBody.applyForce(new CANNON.Vec3(force.x, force.y, force.z), carBody.position)
  } else if (forward < 0) {
    const force = forwardVec.multiplyScalar(-brake)
    carBody.applyForce(new CANNON.Vec3(force.x, force.y, force.z), carBody.position)
  }

  // steering torque
  if (Math.abs(localForwardVel) > 0.5) {
    const steerAmt = turn * 0.04 * (1 - damage/200)
    carBody.angularVelocity.y += steerAmt
  }

  // clamp speed
  const currentSpeed = carBody.velocity.length()
  if (currentSpeed > maxSpeed / 3.6) {
    carBody.velocity.scale((maxSpeed / 3.6) / currentSpeed, carBody.velocity)
  }

  // fly / noclip handling
  if (flyEnabled) {
    // allow vertical control with space / shift
    if (keys[' ']) carBody.applyForce(new CANNON.Vec3(0, 200, 0), carBody.position)
    if (keys['shift']) carBody.applyForce(new CANNON.Vec3(0, -200, 0), carBody.position)
  }

  world.step(1/60, dt)

  // sync meshes
  carMesh.position.set(carBody.position.x, carBody.position.y - 0.4, carBody.position.z)
  carMesh.quaternion.set(carBody.quaternion.x, carBody.quaternion.y, carBody.quaternion.z, carBody.quaternion.w)

  // update camera to follow car (third-person)
  const camTarget = new THREE.Vector3().copy(carMesh.position)
  camTarget.y += 1.5
  const camPos = carMesh.position.clone().add(new THREE.Vector3(0, 4, 10).applyQuaternion(carMesh.quaternion))
  camera.position.lerp(camPos, 0.08)
  camera.lookAt(camTarget)

  renderer.render(scene, camera)
  updateHUD()
}

animate()

// Simple README-style asset credits loader (not using external glTF models yet)
console.log('Prototype running. Free assets will be listed in README.')
