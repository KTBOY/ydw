// mushies/pages/index/physics.js
// 圆体位置约束（PBD）物理解算器，纯 JS、无依赖。
// 原工程是 Godot RigidBody2D + 轮廓凸分解，小程序侧没有等价物，这里用等效力半径的圆体近似。
// 选型说明：不做逐对冲量累积求解（圆体链式堆叠下摩擦会持续注入能量、堆体自旋散架），
// 改为「位置约束 + 由位移反推速度」，与休闲合成类通用做法一致，稳定优先、弹性单独补。

const SLEEP_STILL_TIME = 0.45;
const SLEEP_LINEAR = 18;
const SLEEP_ANGULAR = 0.9;
const SLEEP_WAKE = 70;
const RESTITUTION_MIN = 40; // 低于此接近速度不做弹性回弹，避免静止堆持续微弹
// PBD 由位移反推速度：深重叠时一次推开就可能产生巨大速度，需要上下两道护栏
const SETTLE_SPEED = 30; // 慢速抖动直接压掉，让堆体能真正静止
const MAX_SPEED = 2600;

class Body {
  constructor(x, y, r, opts) {
    const o = opts || {};
    this.x = x;
    this.y = y;
    this.r = r;
    this.vx = o.vx || 0;
    this.vy = o.vy || 0;
    this.angle = o.angle || 0;
    this.angular = o.angular || 0;
    this.restitution = o.restitution === undefined ? 0.46 : o.restitution;
    this.friction = o.friction === undefined ? 0.68 : o.friction;
    this.linearDamp = o.linearDamp === undefined ? 0.32 : o.linearDamp;
    this.angularDamp = o.angularDamp === undefined ? 1.2 : o.angularDamp;
    this.gravityScale = o.gravityScale === undefined ? 1 : o.gravityScale;
    this.static = !!o.static;
    this.mass = this.static ? Infinity : o.mass || 1;
    this.invMass = this.static ? 0 : 1 / this.mass;
    this.still = 0;
    this.sleeping = false;
    this.tag = o.tag || null;
    this.removed = false;
  }

  wake() {
    this.sleeping = false;
    this.still = 0;
  }
}

class World {
  constructor(opts) {
    const o = opts || {};
    this.gravity = o.gravity === undefined ? 820 : o.gravity;
    this.iterations = o.iterations || 4;
    this.substeps = o.substeps || 2;
    // bounds: { left, right, floor } 逻辑像素；墙体在位置迭代内约束，
    // 这样第 3 步「位移反推速度」才能带上墙的反作用
    this.bounds = o.bounds || null;
    this.bodies = [];
    this.impacts = [];
    this.wallImpacts = [];
  }

  add(body) {
    this.bodies.push(body);
    return body;
  }

  remove(body) {
    body.removed = true;
    // 支撑物消失后压在上面的休眠体会悬空，统一唤醒重算
    for (let i = 0; i < this.bodies.length; i++) this.bodies[i].wake();
  }

  // 位置约束：把重叠的两体按质量比例推开，返回法向与接近速度
  solvePair(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const sum = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= sum * sum) return null;
    const d = Math.sqrt(d2);
    const nx = d < 1e-6 ? 0 : dx / d;
    const ny = d < 1e-6 ? -1 : dy / d;
    const depth = sum - d;
    const invSum = a.invMass + b.invMass;
    if (invSum > 0) {
      a.x -= nx * depth * (a.invMass / invSum);
      a.y -= ny * depth * (a.invMass / invSum);
      b.x += nx * depth * (b.invMass / invSum);
      b.y += ny * depth * (b.invMass / invSum);
    }
    return { nx, ny };
  }

  // 墙体约束：n 指向柜内，approach 为撞墙接近速度（正值）
  applyBounds(list, record) {
    const bd = this.bounds;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.static || b.removed || b.sleeping) continue;
      if (b.x - b.r < bd.left) {
        b.x = bd.left + b.r;
        if (record) record.push({ body: b, nx: 1, ny: 0, approach: -b.vx, side: 'left' });
      } else if (b.x + b.r > bd.right) {
        b.x = bd.right - b.r;
        if (record) record.push({ body: b, nx: -1, ny: 0, approach: b.vx, side: 'right' });
      }
      if (b.y + b.r > bd.floor) {
        b.y = bd.floor - b.r;
        if (record) record.push({ body: b, nx: 0, ny: -1, approach: b.vy, side: 'floor' });
      }
    }
  }

  step(dt) {
    const h = dt / this.substeps;
    const list = this.bodies;
    this.impacts = [];
    this.wallImpacts = [];
    for (let s = 0; s < this.substeps; s++) {
      // 1) 积分
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.static || b.removed || b.sleeping) continue;
        b.vy += this.gravity * b.gravityScale * h;
        b.vx /= 1 + b.linearDamp * h;
        b.vy /= 1 + b.linearDamp * h;
        b.angular /= 1 + b.angularDamp * h;
        b.px = b.x;
        b.py = b.y;
        b.x += b.vx * h;
        b.y += b.vy * h;
        b.angle += b.angular * h;
      }
      // 2) 位置约束迭代，记录每对首次接近速度用于弹性与音效
      const hits = [];
      const wallHits = [];
      for (let it = 0; it < this.iterations; it++) {
        for (let i = 0; i < list.length; i++) {
          const a = list[i];
          if (a.removed) continue;
          for (let j = i + 1; j < list.length; j++) {
            const b = list[j];
            if (b.removed || (a.static && b.static)) continue;
            if (a.sleeping && b.sleeping) continue;
            if (a.sleeping) {
              if (!this.isMoving(b)) continue;
              a.wake();
            } else if (b.sleeping) {
              if (!this.isMoving(a)) continue;
              b.wake();
            }
            const before = it === 0 ? this.approachSpeed(a, b) : 0;
            const res = this.solvePair(a, b);
            if (!res) continue;
            if (it === 0) hits.push({ a, b, nx: res.nx, ny: res.ny, approach: before });
          }
        }
        if (this.bounds) this.applyBounds(list, it === 0 ? wallHits : null);
      }
      // 3) 由位移反推速度：位置约束的分离效果天然进入速度，不会再注入能量
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.static || b.removed || b.sleeping) continue;
        b.vx = (b.x - b.px) / h;
        b.vy = (b.y - b.py) / h;
        const speed2 = b.vx * b.vx + b.vy * b.vy;
        if (speed2 < SETTLE_SPEED * SETTLE_SPEED) {
          b.vx *= 0.5;
          b.vy *= 0.5;
          b.angular *= 0.5;
        } else if (speed2 > MAX_SPEED * MAX_SPEED) {
          const k = MAX_SPEED / Math.sqrt(speed2);
          b.vx *= k;
          b.vy *= k;
        }
      }
      // 4) 弹性与摩擦：各施加一次，按接近速度而不是累积冲量
      for (let k = 0; k < hits.length; k++) {
        const hit = hits[k];
        if (hit.approach > RESTITUTION_MIN) {
          const e = Math.max(hit.a.restitution, hit.b.restitution);
          const push = (hit.approach * e) / 2;
          hit.a.vx -= hit.nx * push;
          hit.a.vy -= hit.ny * push;
          hit.b.vx += hit.nx * push;
          hit.b.vy += hit.ny * push;
          this.impacts.push({ a: hit.a, b: hit.b, impulse: hit.approach });
        }
        this.applyFriction(hit.a, hit.b, hit.nx, hit.ny);
      }
      for (let k = 0; k < wallHits.length; k++) {
        const hit = wallHits[k];
        if (hit.approach <= RESTITUTION_MIN) continue;
        const e = hit.body.restitution;
        hit.body.vx += hit.nx * hit.approach * e;
        hit.body.vy += hit.ny * hit.approach * e;
        this.wallImpacts.push(hit);
      }
    }
    this.updateSleep(dt, list);
    const kept = [];
    for (let i = 0; i < list.length; i++) {
      if (!list[i].removed) kept.push(list[i]);
    }
    this.bodies = kept;
  }

  // 约束前的相对接近速度（正值表示正在互相靠近）
  approachSpeed(a, b) {
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    return -((rvx * dx + rvy * dy) / d);
  }

  // 切向：把相对切向速度按摩擦系数衰减，并换算成滚转，不引入额外能量
  applyFriction(a, b, nx, ny) {
    const tx = -ny;
    const ty = nx;
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const vt = rvx * tx + rvy * ty;
    const mu = Math.min(1, Math.sqrt(a.friction * b.friction) * 0.5);
    const dvt = vt * mu;
    const invSum = a.invMass + b.invMass;
    if (invSum <= 0) return;
    a.vx += tx * dvt * (a.invMass / invSum);
    a.vy += ty * dvt * (a.invMass / invSum);
    b.vx -= tx * dvt * (b.invMass / invSum);
    b.vy -= ty * dvt * (b.invMass / invSum);
    a.angular += (dvt / a.r) * 0.35;
    b.angular -= (dvt / b.r) * 0.35;
  }

  isMoving(body) {
    return !body.static && Math.abs(body.vx) + Math.abs(body.vy) > SLEEP_WAKE;
  }

  updateSleep(dt, list) {
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.static || b.removed) continue;
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (b.sleeping) {
        if (speed > SLEEP_WAKE) b.sleeping = false;
        continue;
      }
      if (speed < SLEEP_LINEAR && Math.abs(b.angular) < SLEEP_ANGULAR) {
        b.still += dt;
        if (b.still > SLEEP_STILL_TIME) {
          b.sleeping = true;
          b.vx = 0;
          b.vy = 0;
          b.angular = 0;
        }
      } else {
        b.still = 0;
      }
    }
  }
}

export { Body, World };
