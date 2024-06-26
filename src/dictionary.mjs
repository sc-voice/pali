import { DBG } from './defines.mjs';
import { default as Pali } from "./pali.mjs";

import { DPD } from '../data/en/dpd.mjs';
import { DPD_TEXTS } from '../data/en/dpd-text.mjs';

export default class Dictionary {
  static #CREATE = false;

  constructor(opts={}) {
    if (!Dictionary.#CREATE) {
      throw new Error(`Use Dictionary.create()`);
    }

    Object.assign(this, opts);
  }

  static async create(opts={}) {
    const msg = 'Dictionary.#loadDpd()';
    const dbg = DBG.DICTIONARY;
    try {
      let { 
        lang='en',
        dpd,
        dpdTexts,
      } = opts;
      Dictionary.#CREATE = true;
      if (dpd == null) {
        dpd = DPD;
        let keys = Object.keys(dpd);
        dbg && console.log(msg, '[2]loaded', {
          metadata: dpd?.__metadata, 
          keys: keys.length,
        });
      }
      if (dpdTexts == null) {
        dpdTexts = DPD_TEXTS;
        dbg && console.log(msg, '[3]dpdTexts', dpdTexts.length); 
      }
      let dict = new Dictionary({
        lang,
        dpd,
        dpdTexts,
      });

      return dict;
    } catch (e) {
      throw e;
    } finally {
      Dictionary.#CREATE = false;
    }
  }

  _entryOf(word) {
    const msg = "Dictionary._entryOf()";
    const dbg = DBG.ENTRY_OF;
    let { dpd, dpdTexts } = this;
    word = word.toLowerCase();
    let entry = dpd[word];
    if (entry == null) {
      return null;
    }

    if (typeof entry === 'string') {
      let result = JSON.parse(entry);
      let { d } = result;
      let definition = d.map(code=>dpdTexts[code]);
      entry = {
        definition, 
      }
      dpd[word] = entry;
      //dbg && console.log(msg, '[1]word');
    } else {
      //dbg && console.log(msg, '[2]word');
    }

    return entry
  }

  entryOf(word) {
    let entry = this._entryOf(word);
    if (entry == null) {
      return null;
    }
    return Object.assign({word}, entry);
  }

  relatedEntries(word, opts={}) {
    const msg = "Dictionary.relatedEntries()";
    let { dpd } = this;
    let { 
      overlapThreshold=0,
    } = opts;
    let stem = Pali.wordStem(word);
    let keys = Object.keys(dpd)
    let maxLen = word.length + Pali.ENDING_MAX_LEN;
    let stemKeys = keys.filter(k=>{
      return k.startsWith(stem) && k.length<=maxLen;
    });
    let entry = this.entryOf(word);
    if (entry == null) {
      return undefined;
    }
    let { definition } = entry;
    let map = {};
    definition.forEach(line=>map[line]=true);
    let overlapBasis = definition.length;
    //console.log(msg, {map});

    let entries = stemKeys.reduce((entries,key)=>{
      let entry = this.entryOf(key);
      let intersection = entry.definition.reduce((aDef,line)=>{
        if (map[line] != null) {
          aDef++;
        }
        return aDef;
      }, 0);
      let overlap = intersection/overlapBasis;
      if (overlap>overlapThreshold) {
        let decoratedEntry = Object.assign({overlap}, entry);
        entries.push(decoratedEntry);
      }

      return entries;
    }, []);

    return entries;
  }

}
