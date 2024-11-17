import { DBG } from './defines.mjs';
import Pali from "./pali.mjs";
import Inflection from "./inflection.mjs";

import { ABBREVIATIONS } from '../data/en/abbreviations.mjs';
import { DPD } from '../data/en/dpd.mjs';
import { DPD_TEXTS } from '../data/en/dpd-text.mjs';

export default class _Dictionary {
  static #CREATE = false;
  static #DPD; // cache

  constructor(opts={}) {
    if (!_Dictionary.#CREATE) {
      throw new Error(`Use Dictionary.create()`);
    }

    Object.assign(this, opts);
  }

  static get ABBREVIATIONS() {
    return ABBREVIATIONS;
  }

  static isAccented(word) {
    return !/^[a-z]+$/i.test(word);
  }

  static prefixOf(...strings) {
    const msg = '_Dictionary.prefixOf()';
    strings = strings.flat();

    let prefix = strings.reduce((a,s)=>{
      while (a && !s.startsWith(a)) {
        a = a.substring(0, a.length-1);
      }
      return a;
    }, strings[0] || '');

    return prefix;
  }

  static normalizePattern(pattern) {
    pattern = pattern.toLowerCase();
    pattern = pattern.replace(/[^a-zA-zāḍīḷṁṃṅñṇṭū]/, '');
    return pattern;
  }

  static unaccentedPattern(pattern) {
    return this.normalizePattern(pattern)
      .replace(/a/iug, '(a|ā)')
      .replace(/i/iug, '(i|ī)')
      .replace(/u/iug, '(u|ū)')
      .replace(/m/iug, '(m|ṁ|ṃ)')
      .replace(/d/iug, '(d|ḍ)')
      .replace(/n/iug, '(n|ṅ|ñ|ṇ)')
      .replace(/l/iug, '(l|ḷ)')
      .replace(/t/iug, '(t|ṭ)')
      ;
  }

  static async create(opts={}) {
    const msg = '_Dictionary.create()';
    const dbg = DBG.DICTIONARY_CREATE;
    try {
      let { 
        lang='en',
        dpd=_Dictionary.#DPD,
        dpdTexts,
      } = opts;
      _Dictionary.#CREATE = true;
      if (dpd == null) {
        let keys = Object.keys(DPD);
        dpd = keys.reduce((a,word)=>{
          let rawEntry = DPD[word];
          a[word] = typeof rawEntry === 'string'
            ? JSON.parse(rawEntry) 
            : rawEntry;
          return a;
        }, DPD); // overwrite imported DPD;
        _Dictionary.#DPD = dpd;
        dbg && console.log(msg, '[1]DPD', {
          metadata: dpd?.__metadata, 
          keys: keys.length,
        });
      } else {
        dbg && console.log(msg, '[2]dpd');
      }
      if (dpdTexts == null) {
        dpdTexts = DPD_TEXTS;
        dbg && console.log(msg, '[3]dpdTexts', dpdTexts.length); 
      }
      let dict = new _Dictionary({
        lang,
        dpd,
        dpdTexts,
      });

      return dict;
    } catch (e) {
      throw e;
    } finally {
      _Dictionary.#CREATE = false;
    }
  }

  entryOf(word) {
    const msg = "_Dictionary.entryOf()";
    const dbg = DBG.ENTRY_OF;
    let { dpd, dpdTexts } = this;
    word = word.toLowerCase();
    let rawEntry = dpd[word];
    if (rawEntry == null) {
      return null;
    }
    let { d } = rawEntry;
    let definition = d.map(id=>dpdTexts[id]);
    return Object.assign({word}, {definition});
  }

  wordsWithPrefix(prefix, opts={}) {
    const msg = "_Dictionary.autocompleteWords()";
    let { dpd } = this;
    let { 
      limit=0,
      strict=false,
    } = opts;
    let keys = Object.keys(dpd);
    let matching;
    let matchLen = prefix.length+1;
    if (strict) {
      matching = keys.filter(word=>word.startsWith(prefix));
    } else if (_Dictionary.isAccented(prefix)) {
      let normPrefix = _Dictionary.normalizePattern(prefix);
      let re = new RegExp(`^${normPrefix}`, 'i');
      let map = keys.reduce((a,word)=>{
        if (re.test(word)) {
          let key = word.length > matchLen
            ? word.slice(0, matchLen)+"\u2026"
            : word;
          a[key] = 1;
        }
        return a;
      }, {});
      matching = Object.keys(map);
    } else {
      let pat = _Dictionary.unaccentedPattern(prefix);
      let re = new RegExp(`^${pat}`, 'i');
      let map = keys.reduce((a,word)=>{
        if (re.test(word)) {
          let key = word.length > matchLen
            ? word.slice(0, matchLen)+"\u2026"
            : word;
          a[key] = 1;
        }
        return a;
      }, {});
      matching = Object.keys(map);
    }
    limit && (matching.slice(0,limit));

    return matching.sort((a,b)=>{
      let cmp = a.length - b.length;
      return cmp || Pali.compareRoman(a,b);
    });;
  }

  relatedEntries(word, opts={}) {
    const msg = "_Dictionary.relatedEntries()";
    const dbg = DBG.RELATED_ENTRIES;
    let { dpd } = this;
    let { 
      overlap: minOverlap=0.1,
    } = opts;
    let stem = Pali.wordStem(word);
    let keys = Object.keys(dpd)
    let maxLen = word.length + Pali.ENDING_MAX_LEN;
    let stemKeys = keys.filter(k=>{
      return k.startsWith(stem) && k.length<=maxLen;
    });
    //dbg && console.log(msg, '[1]', {word, stemKeys});
    let entry = this.entryOf(word);
    if (entry == null) {
      return undefined;
    }
    let { definition } = entry;
    let map = {};
    definition.forEach(line=>(map[line]=true));
    let overlapBasis = definition.length || 1;

    let entries = stemKeys.reduce((entries,key)=>{
      let entry = this.entryOf(key);
      let intersection = entry.definition.reduce((aDef,line)=>{
        if (map[line] != null) {
          aDef++;
        }
        return aDef;
      }, 0);
      let overlap = intersection/overlapBasis;
      if ( minOverlap <= overlap ) {
        let decoratedEntry = Object.assign({overlap}, entry);
        entries.push(decoratedEntry);
      }

      return entries;
    }, []);
    dbg && console.log(msg, '[2]', entries.map(e=>e.word));

    return entries;
  }

  findWords(defPat) {
    const msg="_Dictionary.findWords()";
    const dbg = DBG.FIND_WORDS;
    let { dpd, dpdTexts } = this;
    let re = defPat instanceof RegExp 
      ? defPat 
      : new RegExp(`\\b${defPat}`, 'i');
    dbg && console.log(msg, '[1]re', re);
    let textMap = {};
    let dpdKeys = Object.keys(dpd);
    let idMatch = dpdTexts.reduce((a,text,i)=>{
      if (re.test(text)) {
        a[i] = text;
        textMap[text] = i;
      }
      return a;
    }, {});
    let dpdEntries = Object.entries(dpd);
    let defWords = dpdEntries.reduce((a,entry,i) =>{
      let [ word, info ] = entry;
      (info.d instanceof Array) && info.d.forEach(id=>{
        if (idMatch[id]) {
          let defText = dpdTexts[id];
          let words = a[id] || [];
          words.push(word);
          a[id] = words;
        }
      });
      return a;
    }, {});
    let matches = Object.entries(defWords).map(entry=>{
      let [id, words] = entry;
      let d = dpdTexts[id];
      return {
        definition:d,
        words,
      }
    });
    dbg && console.log(msg, matches);
    return matches;
  }

  parseDefinition(d='type?|meaning?|literal?|construction?') {
    if (d instanceof Array) {
      return d.map(line=>this.parseDefinition(line));
    }
    if (typeof d === 'string') {
      let [ type, meaning, literal, construction ] = d.split('|');
      return { type, meaning, literal, construction };
    }

    return undefined; 
  }

  findDefinition(pattern) {
    const msg = "_Dictionary.findDefinition()";
    const dbg = DBG.FIND_DEFINITION;
    let result;
    let rows = this.findWords(pattern);
    let data = rows.reduce((a,row)=>{
      dbg && console.log(msg, '[1]', row);
      let { definition, words } = row;
      let parsed = this.parseDefinition(definition);
      words.forEach(word=>{
        let resultRow = Object.assign({}, parsed, {word});
        dbg && console.log(msg, '[2]', resultRow);
        a.push(resultRow);
      });
      return a;
    }, []);

    if (data.length) {
      result = { data, pattern, method: 'definition', };
      dbg && console.log(msg, '[3]result', result);
    } else {
      dbg && console.log(msg, '[4]data?', {pattern});
    }

    return result;
  }

  findAltAnusvara(pattern, opts) {
    let msg = '_Dictionary.findAltAnusvara:';
    const dbg = DBG.FIND;
    let altPat = pattern.replace(/n’ti/, 'ṁ');
    let res;
    if (altPat !== pattern) {
      res = this.findMethod(altPat, opts);
      dbg && console.log(msg, '[1]', altPat, !!res);
    }

    return res;
  }

  find(pattern, opts={}) {
    let res = this.findMethod(pattern, opts);

    if (res == null) { // try anusvara rule
      res = this.findAltAnusvara(pattern, opts);
    }

    return res;
  }

  findMethod(pattern, opts={}) {
    const msg = "_Dictionary,find()";
    const dbg = DBG.FIND;
    let { dpd } = this;
    let {
      method,
    } = opts;
    if (typeof pattern === 'string') {
      let words = pattern.split(' ').filter(w=>{
        if (w.startsWith("-")) {
          switch (w) {
            case "-mu": 
              method = "unaccented";
              break;
            case "-me":
              method = "entry";
              break;
            case "-md":
              method = "definition";
              break;
          }
          return false;
        }
        return true;
      });
      pattern = words.join(' ');
    }

    let result;
    if (!result && (!method || method==='entry')) {
      let entry = this.entryOf(pattern);
      if (entry) {
        let data = entry.definition.map(def=>{
          let parsed = this.parseDefinition(def);
          let row = Object.assign(parsed, {word: pattern});
          return row;
        });
        result = { data, pattern, method: 'entry', }
      }
    } 
    if (!result && (!method || method==='unaccented')) {
      let rpattern = _Dictionary.unaccentedPattern(pattern);
      let re = new RegExp(`^${rpattern}\$`);
      let data = Object.keys(dpd).reduce((a,word)=>{
        if (re.test(word)) {
          let entry = this.entryOf(word);
          entry && entry.definition.forEach(def=>{
            let parsed = this.parseDefinition(def);
            let row = Object.assign(parsed, {word: entry.word});
            a.push(row);
          });
        }
        return a;
      }, []);
      if (data.length) {
        result = { data, pattern:rpattern, method: 'unaccented', };
      }
    }
    if (!result && (!method || method==='definition')) {
      result = this.findDefinition(pattern);
    }
    
    if (dbg) {
      if (result) {
        result.data.forEach(row=>console.log(msg, '[1]',
          row.word,
          row.construction,
          row.type, 
          row.meaning, 
          row.literal, 
        ));
      } else {
        console.log(msg, "result?", {pattern, method});
      }
    }

    return result;
  }

  wordInflections(word, opts={}) { 
    const msg = '_Dictionary.wordInflections()';
    const dbg = 0 || DBG.WORD_INFLECTIONS;
    const dbgv = dbg && DBG.VERBOSE;
    let {
      overlap=0.5,
      nbr,
    } = opts;
    let entry = this.find(word);
    let entries = this.relatedEntries(word, {overlap});
    let stem = _Dictionary.prefixOf(entries.map(e=>e.word));
    let w = word;
    dbg && console.log(msg);
    dbg & console.log(entries.map(e=>e.word).join('\n'));

    let tblMatch = Inflection.TABLE.filter(inf=>{
      for (let ie=0; ie<entries.length; ie++) {
        let e = entries[ie];
        if (inf.matchesWord(e.word, {stem, nbr})) {
          return true;
        }
      }
      return false;
    });
    let title = `${word} matching inflections`;
    dbgv && console.log(tblMatch.format({title}));

    let tblLike = tblMatch.groupBy(['like'], [
      {id:'id', aggregate:'count'},
    ]);
    title = `${word} grouped by like`;
    dbgv && console.log(tblLike.format({title}));
    //return tblMatch;

    let likeMap = tblLike.rows.reduce((a,row)=>{
      a[row.like] = true;
      return a;
    }, {});
    let { like } = tblLike.rows[0] || {};
    let tblLikeOnly =  Inflection.TABLE.filter(inf=>{
      return likeMap[inf.like];
    });

    let tblResult = tblLikeOnly;
    tblResult.rows = tblResult.rows.map(row=>
      new Inflection(Object.assign({word:stem+row.sfx}, row)));
    tblResult.addHeader({id:'word'});
    tblResult.sort(Inflection.compare);
    dbg && console.log(tblResult.format({
      title:`tblResult ${word} group by:${Object.keys(likeMap)}`}));
    return tblResult;
  }
}