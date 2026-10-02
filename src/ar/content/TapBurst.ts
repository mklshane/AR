import * as THREE from 'three'
import { starShape } from './shapes'

const COUNT = 16
const LIFE = 1.1

interface Particle {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  spin: number
  age: number
}

/** Pooled burst of little stars fired from a tap point, in anchor space. */
export class TapBurst {
  readonly object = new THREE.Group()
  private particles: Particle[] = []
  private geo = new THREE.ShapeGeometry(starShape(0.018))
  private materials: THREE.MeshBasicMaterial[]

  constructor(colors: string[]) {
    this.materials = colors.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, side: THREE.DoubleSide }))
  }

  fire(at: THREE.Vector3) {
    for (let i = 0; i < COUNT; i++) {
      let p = this.particles.find((q) => q.age >= LIFE)
      if (!p) {
        if (this.particles.length >= COUNT * 3) return
        const mesh = new THREE.Mesh(this.geo, this.materials[0].clone())
        p = { mesh, vel: new THREE.Vector3(), spin: 0, age: LIFE }
        this.particles.push(p)
        this.object.add(mesh)
      }
      const a = (i / COUNT) * Math.PI * 2 + Math.random() * 0.4
      const speed = 0.25 + Math.random() * 0.25
      p.vel.set(Math.cos(a) * speed, Math.sin(a) * speed, 0.25 + Math.random() * 0.3)
      p.spin = (Math.random() - 0.5) * 12
      p.age = 0
      p.mesh.position.copy(at)
      const mat = p.mesh.material as THREE.MeshBasicMaterial
      mat.color.copy(this.materials[i % this.materials.length].color)
      p.mesh.visible = true
    }
  }

  update(dt: number) {
    for (const p of this.particles) {
      if (p.age >= LIFE) continue
      p.age += dt
      p.vel.multiplyScalar(1 - 2.2 * dt)
      p.vel.z -= 0.6 * dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.mesh.rotation.z += p.spin * dt
      const life = 1 - p.age / LIFE
      p.mesh.scale.setScalar(0.4 + life)
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, life)
      if (p.age >= LIFE) p.mesh.visible = false
    }
  }

  dispose() {
    this.geo.dispose()
    this.materials.forEach((m) => m.dispose())
    this.particles.forEach((p) => (p.mesh.material as THREE.Material).dispose())
  }
}
