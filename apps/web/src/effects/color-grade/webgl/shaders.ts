// GLSL ES 3.00 (WebGL2). One combined pass for the operations that genuinely
// need per-pixel / neighborhood math (unlike the tonal overlays in
// ../render.ts, which stay on the native Canvas2D filter/composite path).
// Order inside main() mirrors the documented color pipeline: noise
// reduction -> sharpen -> clarity -> HSL selective -> curves -> 3D LUT.

export const GRADE_VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const GRADE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler3D;

uniform sampler2D uSource;
uniform sampler2D uCurveLut;
uniform sampler3D uLut3D;
uniform vec2 uTexelSize;

uniform float uSharpness;
uniform float uClarity;
uniform float uNoiseReduction;

uniform float uHueCenters[8];
uniform float uHslHueShift[8];
uniform float uHslSat[8];
uniform float uHslLight[8];

uniform bool uHasHsl;
uniform bool uHasCurves;
uniform bool uHasLut;
uniform float uLutIntensity;

in vec2 vUv;
out vec4 outColor;

vec3 rgb2hsl(vec3 c) {
  float maxC = max(max(c.r, c.g), c.b);
  float minC = min(min(c.r, c.g), c.b);
  float l = (maxC + minC) * 0.5;
  float d = maxC - minC;
  float h = 0.0;
  float s = 0.0;
  if (d > 0.00001) {
    s = d / (1.0 - abs(2.0 * l - 1.0) + 0.00001);
    if (maxC == c.r) {
      h = mod((c.g - c.b) / d, 6.0);
    } else if (maxC == c.g) {
      h = (c.b - c.r) / d + 2.0;
    } else {
      h = (c.r - c.g) / d + 4.0;
    }
    h /= 6.0;
    if (h < 0.0) h += 1.0;
  }
  return vec3(h, s, l);
}

float hueToRgbChannel(float p, float q, float t) {
  float tt = t;
  if (tt < 0.0) tt += 1.0;
  if (tt > 1.0) tt -= 1.0;
  if (tt < 1.0 / 6.0) return p + (q - p) * 6.0 * tt;
  if (tt < 1.0 / 2.0) return q;
  if (tt < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - tt) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  if (s <= 0.00001) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hueToRgbChannel(p, q, h + 1.0 / 3.0),
    hueToRgbChannel(p, q, h),
    hueToRgbChannel(p, q, h - 1.0 / 3.0)
  );
}

vec3 sampleBox3x3() {
  vec3 sum = vec3(0.0);
  for (int dx = -1; dx <= 1; dx++) {
    for (int dy = -1; dy <= 1; dy++) {
      sum += texture(uSource, vUv + vec2(float(dx), float(dy)) * uTexelSize).rgb;
    }
  }
  return sum / 9.0;
}

vec3 sampleWideBox() {
  vec3 sum = vec3(0.0);
  float taps = 0.0;
  for (int dx = -2; dx <= 2; dx += 2) {
    for (int dy = -2; dy <= 2; dy += 2) {
      sum += texture(uSource, vUv + vec2(float(dx), float(dy)) * uTexelSize * 2.0).rgb;
      taps += 1.0;
    }
  }
  return sum / taps;
}

void main() {
  vec4 src = texture(uSource, vUv);
  vec3 color = src.rgb;

  if (uNoiseReduction > 0.0) {
    color = mix(color, sampleBox3x3(), uNoiseReduction);
  }

  if (uSharpness > 0.0) {
    vec3 blurred = sampleBox3x3();
    color = color + (color - blurred) * uSharpness * 2.0;
  }

  if (abs(uClarity) > 0.0001) {
    vec3 local = sampleWideBox();
    color = color + (color - local) * uClarity;
  }

  color = clamp(color, 0.0, 1.0);

  if (uHasHsl) {
    vec3 hsl = rgb2hsl(color);
    float hueDeg = hsl.x * 360.0;
    float hueShiftSum = 0.0;
    float satShiftSum = 0.0;
    float lightShiftSum = 0.0;
    for (int i = 0; i < 8; i++) {
      float dist = abs(hueDeg - uHueCenters[i]);
      dist = min(dist, 360.0 - dist);
      float weight = 1.0 - smoothstep(0.0, 45.0, dist);
      hueShiftSum += uHslHueShift[i] * weight;
      satShiftSum += uHslSat[i] * weight;
      lightShiftSum += uHslLight[i] * weight;
    }
    hsl.x = fract(hsl.x + hueShiftSum / 360.0 + 1.0);
    hsl.y = clamp(hsl.y + satShiftSum, 0.0, 1.0);
    hsl.z = clamp(hsl.z + lightShiftSum, 0.0, 1.0);
    color = hsl2rgb(hsl);
  }

  if (uHasCurves) {
    color = clamp(color, 0.0, 1.0);
    color.r = texture(uCurveLut, vec2(color.r, 0.5)).r;
    color.g = texture(uCurveLut, vec2(color.g, 0.5)).g;
    color.b = texture(uCurveLut, vec2(color.b, 0.5)).b;
  }

  if (uHasLut) {
    vec3 lutColor = texture(uLut3D, clamp(color, 0.0, 1.0)).rgb;
    color = mix(color, lutColor, uLutIntensity);
  }

  outColor = vec4(clamp(color, 0.0, 1.0), src.a);
}
`;
