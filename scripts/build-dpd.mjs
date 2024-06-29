#!/usr/bin/env node
import path from "path";
import fs from "fs";
const { promises: fsp } = fs;
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { default as Compress } from "../src/compress.mjs";

const msg = `${__filename}`;
const textMap = {};

let APIURL = 'https://suttacentral.net/api';
let url = `${APIURL}/dictionaries/lookup?from=pli&to=en`;
let res = await fetch(url);
let data = await res.json();
let dataMap = {
  __metadata: {
    license: "https://digitalpalidictionary.github.io/titlepage.html",
    version: "1.0.0",
  }
}

let cmprs = new Compress();

for (let i = 0; i < data.length; i++) {
  let di = data[i];
  let key = di.entry;
  let { definition } = di;

  if (definition) {
    for (let j=0; j<definition.length; j++) {
      let line = definition[j];
      textMap[line] = null;
    }
  }
}
let texts = Object.keys(textMap).sort();
for (let i=0; i<texts.length; i++) {
  let line = texts[i];
  textMap[line] = i;
}

for (let i = 0; i < data.length; i++) {
  let di = data[i];
  let key = di.entry;
  let { definition } = di;

  if (definition) {
    definition = definition.map(d=>textMap[d]);
    let info = JSON.stringify({ d:definition });
    if (0) {
      let infoCompress = await cmprs.lzwCompress(info);
      dataMap[key] = infoCompress;
    } else {
      dataMap[key] = info;
    }
  }
}
let textPath = `${__dirname}/../data/en/dpd-text.mjs`;
texts = texts.map(line=>{
  let [ type, meaning, construction ] = line.split(/ *<.?b> */);
  type = type.replace(/\.$/, '');
  construction = construction
    .replace(/[\[\]]/g, '')
    .replace(/ \+ /g, '\u02d6');
  return [type, meaning, construction].join('|');
});
let textJson = JSON.stringify(texts, null,1);
let textOut = `export const DPD_TEXTS=${textJson}`;
fs.writeFileSync(textPath, textOut);

let outPath = `${__dirname}/../data/en/dpd.mjs`;
let out = JSON.stringify(dataMap,null,1);
out = `export const DPD=${out}`;
let keys = Object.keys(dataMap);
fs.writeFileSync(outPath, out);

console.log(msg, 'DPD dictionary updated', {
  bytes: out.length*2,
  keys: keys.length, 
  outPath,
});
