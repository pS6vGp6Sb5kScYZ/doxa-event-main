const fs = require('fs');
const path = require('path');

function oklchToSrgb(L, C, hDegrees) {
  const h = (hDegrees * Math.PI) / 180;
  const a = Math.cos(h) * C;
  const b = Math.sin(h) * C;

  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;

  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let b_ = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  function linearToSRGB(u) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    if (u <= 0.0031308) return 12.92 * u;
    return 1.055 * Math.pow(u, 1 / 2.4) - 0.055;
  }

  r = linearToSRGB(r);
  g = linearToSRGB(g);
  b_ = linearToSRGB(b_);

  // clamp
  r = Math.min(1, Math.max(0, r));
  g = Math.min(1, Math.max(0, g));
  b_ = Math.min(1, Math.max(0, b_));

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b_ * 255)];
}

function replaceInFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');

  // regex accepts spaces or underscores between numbers, optional alpha after slash
  const re = /oklch\(\s*([0-9]*\.?[0-9]+)[ _]+([0-9]*\.?[0-9]+)[ _]+([0-9]*\.?[0-9]+)(?:[ _]*\/[ _]*([0-9]*\.?[0-9]+))?\s*\)/g;

  src = src.replace(re, (match, Ls, Cs, hs, alphas) => {
    const L = parseFloat(Ls);
    const C = parseFloat(Cs);
    const h = parseFloat(hs);
    const alpha = alphas !== undefined ? parseFloat(alphas) : null;
    // CSS L/C in oklch are in range 0-1 for L and C? Typically L in 0..1, C small. Provided values seem like 0.9 etc.
    // They appear already in 0..1 for L and C. Use as-is.

    const [r, g, b] = oklchToSrgb(L, C, h);
    if (alpha === null || isNaN(alpha)) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  });

  fs.writeFileSync(filePath, src, 'utf8');
  console.log('Updated', filePath);
}

const target = path.resolve(__dirname, '..', 'src', 'index.css');
replaceInFile(target);
console.log('Conversion complete.');
