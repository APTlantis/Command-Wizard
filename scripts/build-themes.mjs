// Explicit refresh only. Normal app builds consume the checked-in bundled themes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const resourceRoot = process.argv[2] || 'C:/Users/Administrator/Desktop/MD';
const output = new URL('../src/themes/', import.meta.url);
fs.mkdirSync(new URL('sources/', output), { recursive: true });
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fromHex(hex) {
  const [r,g,b] = hex.match(/\w\w/g).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  const l = Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b), m = Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b), s = Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  const L = .2104542553*l+.793617785*m-.0040720468*s, a = 1.9779984951*l-2.428592205*m+.4505937099*s, c = .0259040371*l+.7827717662*m-.808675766*s;
  return [L, Math.hypot(a,c), (Math.atan2(c,a)*180/Math.PI+360)%360];
}
const sourceCss = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const oldColors = Object.fromEntries([...sourceCss.matchAll(/--color-atl-([\w-]+): (#[\da-f]{6});/g)].map(m => [m[1], fromHex(m[2])]));
const blueMap = { canvas:'void', background:'deep', panel:'abyss', elevated:'slate', accentSurface:'navy', border:'ridge', muted:'frost', secondaryText:'silver', text:'archive', primary:'cyan', focus:'cyan-bright', secondary:'teal', warning:'brass', error:'amber', success:'green', info:'indigo', keyword:'violet', string:'green', number:'cyan-bright', function:'cyan', operator:'silver', selection:'navy', selectionText:'archive' };
const themes = [{ schemaVersion:1, id:'blue-slate', name:'Blue Slate', mode:'dark', colors:Object.fromEntries(Object.entries(blueMap).map(([r,k]) => [r,oldColors[k]])) }];
const map = { canvas:'background', background:'background', panel:'panel', elevated:'elevated', accentSurface:'panel', border:'border', muted:'muted', secondaryText:'foreground', text:'foreground', primary:'primary', focus:'primary', secondary:'secondary', warning:'warning', error:'error', success:'success', info:'info', keyword:'keyword', string:'string', number:'number', function:'function', operator:'operator', selection:'selection', selectionText:'selection_text' };
for (const family of ['Ada','BlackGold','Clojure','Crystal','Factor','Nim','Swift']) {
  const folder = family === 'Ada' ? 'website' : 'typora';
  const source = `apt-${family}/${folder}/tokens.json`;
  const bytes = fs.readFileSync(path.join(resourceRoot, source));
  const tokens = JSON.parse(bytes).tokens;
  fs.writeFileSync(new URL(`sources/apt-${family}.tokens.json`,output), bytes);
  themes.push({schemaVersion:1, id:`apt-${family.toLowerCase()}`, name:`Aptlantis ${family}`, mode:'dark', colors:Object.fromEntries(Object.entries(map).map(([r,k]) => [r,tokens[k].oklch])), provenance:{source,sha256:hash(bytes),mapping:'commandwizard-md-v1'}});
}
fs.writeFileSync(new URL('bundled.json', output), JSON.stringify(themes,null,2)+'\n');
const portable = new URL('../public/themes/', import.meta.url);
fs.mkdirSync(portable, { recursive: true });
for (const theme of themes) fs.writeFileSync(new URL(`${theme.id}.theme.json`, portable), JSON.stringify(theme,null,2)+'\n');
fs.writeFileSync(new URL('mapping.json', output), JSON.stringify({schemaVersion:1,resources:map,blueSlate:blueMap,blueSlateSource:'Existing CommandWizard src/styles.css @theme palette (preserved exact sRGB)',sourceRoot:resourceRoot},null,2)+'\n');
console.log(`Built ${themes.length} themes; original resources unchanged.`);
