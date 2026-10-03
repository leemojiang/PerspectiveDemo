const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the actual single-file app with a small DOM/Canvas substitute. Geometry
// stays private in production; only this test copy exposes it for assertions.
function loadDemo() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const nodes = new Map(), labels = [], calls = [];
  const context2d = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return text => ({ width: text.length * 7 });
      if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args) => {
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${key}: non-finite canvas coordinate`);
        if (key === 'fillText') labels.push(args[0]);
        if (key === 'arc') calls.push({ method: key, args });
      };
    }
  });
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    const element = {
      id, style: { setProperty() {} }, listeners: {}, dataset: {}, textContent: '',
      addEventListener(name, fn) { this.listeners[name] = fn; },
      setAttribute() {}, setPointerCapture() {},
      getContext: () => context2d,
      getBoundingClientRect: () => ({ width: 800, height: 500 }),
      querySelector: selector => nodes.get(selector.slice(1)),
      querySelectorAll: selector => selector === 'input[type="range"]' ? (element.inputs || []) : [],
      set innerHTML(value) {
        this.html = value;
        this.inputs = [];
        for (const match of value.matchAll(/<input\b[^>]*>/g)) {
          const attrs = Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
          delete attrs.style; // Keep the DOM-like style object when parsing inline CSS.
          const input = node(attrs.id);
          Object.assign(input, attrs);
          node(`${attrs.id}Value`);
          this.inputs.push(input);
        }
      },
      get innerHTML() { return this.html; }
    };
    nodes.set(id, element);
    return element;
  }
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) if (!match[1].includes('$')) node(match[1]);
  let tool;
  const document = {
    querySelector: selector => {
      const element = nodes.get(selector.slice(1));
      assert.ok(element, `Missing element ${selector}`);
      return element;
    },
    querySelectorAll: () => [],
    modelContext: { registerTool(value) { tool = value; } }
  };
  const sandbox = { document, window: { devicePixelRatio: 1 }, console, AbortController, ResizeObserver: class { observe() {} } };
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const exposed = script.replace(/\}\)\(\);\s*$/, 'globalThis.demo = {state,presets,project,projectionMatrix,viewMatrix,selectProjection,setObject,draw,drawVanishingPoints,isFaceVisible,cubeFaces,cubeVertices};})();');
  vm.runInNewContext(exposed, sandbox);
  return { ...sandbox.demo, nodes, labels, calls, get tool() { return tool; } };
}
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const multiply = (m, v) => m.map(row => row.reduce((sum, value, i) => sum + value * v[i], 0));

test('Z edges remain vertical; PV agrees with pixels throughout the supported angles', () => {
  const app = loadDemo();
  app.selectProjection('zParallel');
  for (let yaw = 0; yaw <= 360; yaw += 15) for (let pitch = -90; pitch <= 90; pitch += 15) for (const k of [0, .22, .28]) {
    Object.assign(app.state, { yaw: yaw * Math.PI / 180, pitch: pitch * Math.PI / 180, horizontalPerspective: k });
    const p = app.projectionMatrix(), v = app.viewMatrix();
    for (const x of [-1, .37, 1]) for (const y of [-1, .19, 1]) {
      const a = app.project({ x, y, z: -1 }), b = app.project({ x, y, z: 1 });
      near(a.x, b.x);
      if (Math.abs(pitch) === 90) near(a.y, b.y);
      else assert.ok(b.y < a.y, 'positive Z must point upward');
      const clip = multiply(p, multiply(v, [x, y, 1, 1]));
      near(b.x, 400 * (1 + clip[0] / clip[3]));
      near(b.y, 250 * (1 - clip[1] / clip[3]));
      assert.ok(clip[3] > 0);
    }
  }
});

test('straight segments and horizontal vanishing points agree with the projected edges', () => {
  const app = loadDemo();
  app.selectProjection('zParallel');
  Object.assign(app.state, { yaw: .8, pitch: .7, horizontalPerspective: .28 });
  const S = 500 * .185 * app.state.scale;
  const vanish = {
    x: { x: 400 - S * Math.cos(.8) / (.28 * Math.sin(.8)), y: 250 - S * Math.sin(.7) / .28 },
    y: { x: 400 + S * Math.sin(.8) / (.28 * Math.cos(.8)), y: 250 - S * Math.sin(.7) / .28 }
  };
  const area = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (const axis of ['x', 'y']) for (const z of [-1, 1]) {
    const a = { x: -.8, y: -.6, z }, b = { ...a, [axis]: 1 };
    const pa = app.project(a), pb = app.project(b);
    near(area(pa, pb, vanish[axis]), 0, 1e-7);
    const midpoint = Object.fromEntries(['x','y','z'].map(key => [key, (a[key] + b[key]) / 2]));
    near(area(pa, pb, app.project(midpoint)), 0, 1e-7);
  }
  const heightAt = d => app.project({x:0,y:d,z:-1}).y - app.project({x:0,y:d,z:1}).y;
  assert.ok(heightAt(1) > heightAt(-1), 'near verticals must be taller');
});

test('infinite vanishing points, zero strength and collapsed Z have accurate labels', () => {
  const app = loadDemo();
  app.tool.execute({ projection: 'zParallel', yawDegrees: 0, pitchDegrees: 30 });
  app.labels.length = 0;
  app.drawVanishingPoints();
  assert.ok(app.labels.includes('Vx → ∞'));
  assert.ok(app.labels.includes('Vz → ∞'));
  app.tool.execute({ horizontalPerspective: 0 });
  app.labels.length = 0;
  app.drawVanishingPoints();
  for (const axis of ['x','y','z']) assert.ok(app.labels.includes(`V${axis} → ∞`));
  for (const pitchDegrees of [-90, 90]) {
    app.tool.execute({ pitchDegrees, horizontalPerspective: .28 });
    app.labels.length = 0;
    app.drawVanishingPoints();
    assert.ok(!app.labels.some(label => label.startsWith('Vz')));
    assert.match(app.nodes.get('relationCopy').textContent, /两端重合/);
  }
});

test('opaque cube visibility uses its actual projection center and handles poles', () => {
  const app = loadDemo();
  app.selectProjection('zParallel');
  Object.assign(app.state, { yaw: 0, pitch: .1, horizontalPerspective: .28 });
  assert.equal(app.isFaceVisible(app.cubeFaces[1]), false, 'eye below top plane');
  app.state.pitch = .8;
  assert.equal(app.isFaceVisible(app.cubeFaces[1]), true);
  for (const [pitch, expected] of [[Math.PI / 2, 1], [-Math.PI / 2, 0]]) {
    app.state.pitch = pitch;
    const visible = Array.from(app.cubeFaces, (face, i) => app.isFaceVisible(face) ? i : -1).filter(i => i >= 0);
    assert.deepEqual(visible, [expected]);
  }
});

test('all presets and objects render finite coordinates, including both constrained modes', () => {
  const app = loadDemo();
  assert.equal(Object.keys(app.presets).length, 19);
  for (const preset of Object.keys(app.presets)) {
    app.selectProjection(preset);
    for (const object of ['cube','square','axes','sphere']) app.setObject(object);
  }
  for (const projection of ['zParallel', 'xyParallel']) {
    app.selectProjection(projection);
    for (const pitchDegrees of [-90, -42, 0, 42, 90]) for (const k of [0, .28]) {
      for (const object of ['cube','square','axes','sphere']) app.tool.execute({ object, pitchDegrees, horizontalPerspective: k, verticalPerspective: k, cubeOcclusion: true });
    }
  }
  app.nodes.get('resetButton').listeners.click();
  near(app.state.horizontalPerspective, .22);
  near(app.state.verticalPerspective, .22);
  near(app.state.pitch, .35);
  app.selectProjection('perspective');
  assert.equal(app.nodes.get('matrixViewHeading').textContent, '相机视图矩阵 V');
});

test('invalid tool parameters fail before changing the scene', () => {
  const app = loadDemo();
  assert.throws(() => app.tool.execute({ projection: 'zParallel', horizontalPerspective: .9 }));
  assert.equal(app.state.projection, 'perspective');
  assert.throws(() => app.tool.execute({ pitchDegrees: 90 }));
  app.tool.execute({ projection: 'zParallel', yawDegrees: 323, pitchDegrees: 42, horizontalPerspective: .28 });
  near(app.state.pitch, 42 * Math.PI / 180);
});

test('XY groups stay independently parallel at every angle and match the displayed matrices', () => {
  const app = loadDemo();
  app.selectProjection('xyParallel');
  for (let yaw = 0; yaw <= 360; yaw += 15) for (let pitch = -90; pitch <= 90; pitch += 15) for (const k of [0, .22, .28]) {
    Object.assign(app.state, { yaw: yaw * Math.PI / 180, pitch: pitch * Math.PI / 180, verticalPerspective: k });
    const p = app.projectionMatrix(), v = app.viewMatrix();
    for (const axis of ['x', 'y']) {
      let reference;
      for (const z of [-1, .27, 1]) for (const offset of [-1, .63]) {
        const a = { x: offset, y: offset, z }, b = { ...a, [axis]: a[axis] + .35 };
        const pa = app.project(a), pb = app.project(b);
        const delta = [pb.x - pa.x, pb.y - pa.y];
        if (reference) near(delta[0] * reference[1] - delta[1] * reference[0], 0, 1e-7);
        else reference = delta;
        const clip = multiply(p, multiply(v, [b.x, b.y, b.z, 1]));
        near(pb.x, 400 * (1 + clip[0] / clip[3]));
        near(pb.y, 250 * (1 - clip[1] / clip[3]));
        assert.ok(clip[3] > 0);
      }
    }
  }
});

test('all Z edge extensions meet the same finite point, including overhead views', () => {
  const app = loadDemo();
  app.selectProjection('xyParallel');
  const S = 500 * .185 * app.state.scale;
  for (let yaw = 0; yaw <= 360; yaw += 30) for (const pitch of [-90, -60, -30, 0, 30, 60, 90]) for (const k of [.01, .22, .28]) {
    Object.assign(app.state, { yaw: yaw * Math.PI / 180, pitch: pitch * Math.PI / 180, verticalPerspective: k });
    const vp = { x: 400, y: 250 + S * Math.cos(app.state.pitch) / k };
    for (const x of [-1, .31, 1]) for (const y of [-1, .19, 1]) {
      const a = app.project({ x, y, z: -1 }), b = app.project({ x, y, z: 1 });
      const dx = b.x - a.x, dy = b.y - a.y;
      const cross = dx * (vp.y - a.y) - dy * (vp.x - a.x);
      near(cross / Math.max(1, Math.hypot(dx, dy) * Math.hypot(vp.x - a.x, vp.y - a.y)), 0);
    }
  }
  Object.assign(app.state, { pitch: .7, verticalPerspective: .28 });
  const atHeight = z => {
    const a = app.project({x:0,y:0,z}), b = app.project({x:1,y:0,z});
    return Math.hypot(b.x-a.x,b.y-a.y);
  };
  near(atHeight(1) / atHeight(-1), 1.28 / .72);
});

test('XY mode draws two infinite labels and a correct Z point without inventing collapsed axes', () => {
  const app = loadDemo();
  app.tool.execute({ projection: 'xyParallel', yawDegrees: 323, pitchDegrees: 70, verticalPerspective: .28 });
  app.labels.length = app.calls.length = 0;
  app.drawVanishingPoints();
  assert.ok(app.labels.includes('Vx → ∞'));
  assert.ok(app.labels.includes('Vy → ∞'));
  assert.ok(app.labels.includes('Vz'));
  const vz = app.calls.at(-1).args;
  near(vz[0], 400);
  near(vz[1], 250 + 500 * .185 * app.state.scale * Math.cos(70 * Math.PI / 180) / .28);
  app.tool.execute({ pitchDegrees: 90 });
  app.calls.length = 0;
  app.drawVanishingPoints();
  near(app.calls.at(-1).args[0], 400);
  near(app.calls.at(-1).args[1], 250);
  app.tool.execute({ verticalPerspective: 0 });
  app.labels.length = 0;
  app.drawVanishingPoints();
  assert.ok(!app.labels.some(label => label.startsWith('Vz')), 'collapsed Z has no direction at infinity');
  app.tool.execute({ yawDegrees: 0, pitchDegrees: 0, verticalPerspective: .22 });
  app.labels.length = 0;
  app.drawVanishingPoints();
  assert.ok(!app.labels.some(label => label.startsWith('Vy')), 'end-on Y axis collapses');
  assert.match(app.nodes.get('relationCopy').textContent, /侧对画面/);
});

test('XY opaque faces follow projected winding across positive, negative and zero pitch', () => {
  const app = loadDemo();
  app.selectProjection('xyParallel');
  for (const yaw of [0, .5, Math.PI / 2, 2, 3, 5]) for (const pitch of [-Math.PI / 2, -.7, 0, .7, Math.PI / 2]) for (const k of [0, .28]) {
    Object.assign(app.state, { yaw, pitch, verticalPerspective: k });
    for (const face of app.cubeFaces) {
      const points = face.ids.map(i => app.project(app.cubeVertices[i]));
      const area = points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p.x * q.y - p.y * q.x;
      }, 0);
      assert.equal(app.isFaceVisible(face), area > 1e-6, `face winding at yaw ${yaw}, pitch ${pitch}, k ${k}`);
    }
  }
});

test('the two modes keep separate strengths and preserve angles when switching', () => {
  const app = loadDemo();
  app.tool.execute({ projection: 'zParallel', horizontalPerspective: .12, yawDegrees: 125, pitchDegrees: -42 });
  app.tool.execute({ projection: 'xyParallel', verticalPerspective: .28 });
  near(app.state.yaw, 125 * Math.PI / 180);
  near(app.state.pitch, -42 * Math.PI / 180);
  const input = app.nodes.get('verticalPerspective');
  input.value = '.17';
  input.listeners.input();
  near(app.state.verticalPerspective, .17);
  assert.equal(app.nodes.get('verticalPerspectiveValue').textContent, '0.17');
  app.selectProjection('zParallel');
  near(app.state.horizontalPerspective, .12);
  near(app.state.verticalPerspective, .17);
  near(app.state.pitch, -42 * Math.PI / 180);
  assert.throws(() => app.tool.execute({ projection: 'xyParallel', verticalPerspective: .5 }));
  assert.equal(app.state.projection, 'zParallel');
});
