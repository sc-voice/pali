import fs from 'fs';
const fsp = fs.promises;
import path from 'path';
import util from 'util';
import * as url from 'url';
import child_process from 'child_process';
const exec = util.promisify(child_process.exec);
import { DBG } from '../../src/defines.mjs';
const msg = "SqlDpd:";
import * as Pali from '../../src/pali.mjs';
const VERBOSE_ROWS = 3;
const DIRNAME = import.meta.dirname;

const DPD_HEADWORD_COLS = [
  'id',
  'pos',
  'pattern',
  'meaning_1',
  'meaning_2',
  'meaning_lit',
  'construction',
];
const HEADWORD_PATTERNS = [
  ...('aāiī'.split('').reduce((a,l)=>{
    a.push(`${l} masc`);
    a.push(`${l} fem`);
    a.push(`${l} nt`);
    return a;
  }, [])),
];

/* Load DPD SQL database and build compact representation 
 * of information useful for Voice. The DPD has a massive amount
 * of information that is not immediately useful to Voice,
 * so the build process strips away such information and
 * stores it more efficiently for Voice:
 *
 * * Voice only deals with Mahāsaṅgīti text, so Pali words
 *   used elsewhere are ignored.
 * * Voice generates HTML, so there's no need for DPD HTML
 * * Voice does process Sinhala or Sansktrit
 */
export default class SqlDpd {
  static #privateCtor = false;
  constructor(opts={}) {
    const msg = "SqlDpd.ctor:";
    if (!SqlDpd.#privateCtor) {
      throw new Error('use SqlDpd.create()');
    }
    let {
      dataDir = path.join(`${DIRNAME}/../../local/data`),
      dbg = DBG.SQL_DPD,
      maxBuffer = 10 * 1024 * 1024,
      mode = 'json',
      paliMap,
      rowLimit = 0,
      verboseRows = VERBOSE_ROWS,
      headwordPatterns,
    } = opts;
    console.error(msg, '[1]paliMap filtering:', paliMap
      ? Object.keys(paliMap).length
      : 'none');
    dataDir = path.resolve(dataDir);

    Object.assign(this, {
      dbg,
      mode,
      rowLimit,
      dataDir,
      verboseRows,
      headwordPatterns,
    });

    // Non-enumerable properties
    Object.defineProperty(this, "dpdHeadwords", {
      writable: true,
      value: undefined,
    });
    Object.defineProperty(this, "dpdLookup", {
      writable: true,
      value: undefined,
    });
    Object.defineProperty(this, "paliMap", {
      value: paliMap,
    });
    Object.defineProperty(this, "headwordUsage", {
      value: {},
    });
    Object.defineProperty(this, "hwIdMap", {
      writable: true,
      value: {},
    });
    Object.defineProperty(this, "defLines", {
      writable: true,
      value: [],
    });
    console.log(msg, '[2]this', JSON.stringify(this));
  }

  static async create(opts={}) {
    const msg = "SqlDpd.create:";
    let {
      verboseRows = VERBOSE_ROWS,
    } = opts;

    SqlDpd.#privateCtor = true;
    let sqlDpd = new SqlDpd(opts);
    SqlDpd.#privateCtor = false;

    await sqlDpd.#loadLookup();
    await sqlDpd.#loadHeadwords();

    return sqlDpd;
  }

  async #loadLookup() {
    const msg = `SqlDpd.#loadLookup:`;
    let {
      dbg,
      dataDir,
      rowLimit,
      paliMap,
      headwordUsage,
      verboseRows,
    } = this;
    let wAccept = 0; // DPD words used in paliMap
    let wReject = 0; // DPD words not used in paliMap
    let paliWords = paliMap &&  
      Object.keys(paliMap).sort(Pali.compareRoman);
    let wPali = paliWords && paliWords.length || 0;
    let wUndefined = wPali; // paliMap words not defined in DPD
    let sql = [
      'select lookup_key word, headwords ',
      'from lookup T1',
      'where',
      "T1.headwords is not ''",
      'AND',
      "T1.grammar is not ''",
      rowLimit ? `limit ${rowLimit}` : '',
    ].join(' ');
    let {stdout, stderr} = await this.bashSql(sql);
    let lookupJson = JSON.parse(stdout);
    dbg>1 && console.error(msg, '[0.1]lookupJson', lookupJson);
    if (dbg) {
      let nWords = paliWords && paliWords.length || 'all';
      console.error(msg, '[0.2]paliWords', nWords);
    }
    // Filter out words not in paliMap
    let dpdLookup = lookupJson.reduce((a,row,i)=>{
      let { word, headwords } = row;
      try {
        word = word.replace('ṃ', 'ṁ');
      } catch(e) {
        console.error(msg, {row}, e);
        throw e;
      }
      if (!paliMap || paliMap[word]) {
        let hwrds = JSON.parse(headwords);
        a[word] = hwrds;
        for (let ihw=0; ihw<hwrds.length; ihw++) {
          let hw = hwrds[ihw];
          headwordUsage[hw] = (headwordUsage[hw]||0)+1;
        }
        wAccept++;
        wUndefined--;
      } else {
        dbg>1 && console.error(msg, '[0.3]reject', word);
        wReject++;
      }
      return a;
    }, {});

    let lookupKeys = Object.keys(dpdLookup).sort(Pali.compareRoman);
    let lookupMap = lookupKeys.reduce((a,w)=>{
      a[w] = `{h:${JSON.stringify(dpdLookup[w])}}`;
      return a;
    }, {});

    dbg && console.error(msg, '[0.4]lookupMap.devi', 
      lookupMap.devi, 
      paliWords 
        ? paliWords.slice(0, verboseRows)
        : ''
    );
    dbg && console.error(msg, '[0.5]', {wAccept, wReject});

    let lookupOut = JSON.stringify(lookupMap, null, 1);
    let lookupPath = path.join(dataDir, 'lookup.mjs');
    await fs.promises.writeFile(lookupPath, lookupOut);
    let paliKeys = paliMap ? Object.keys(paliMap).length : [];
    console.error(msg, '[1]', lookupPath, lookupOut.length, 
      {wAccept, paliKeys});

    this.dpdLookup = dpdLookup;
  }

  async build() {
    const msg = "SqlDpd.build:";
    let dbg = DBG.SQL_DPD_BUILD || this.dbg;
    let {
      headwordUsage,
      paliMap,
      verboseRows,
    } = this;

    await this.#buildHeadwords();

    /*
    let {
      lookupMap, wAccept, wReject, wUndefined, wPali,
    } = await this.#buildLookup({paliMap, headwordUsage});
    let dbgLookupMap = Object.keys(lookupMap).slice(0,verboseRows)
      .reduce((a,k)=>{
        let v = lookupMap[k];
        v && v.length && (a[k] = v);
        return a;
      }, {});
    console.error(msg, '[4]lookup', {
      lookupMap: dbgLookupMap,
      wAccept,
      wReject,
      wPali,
      wUndefined,
    });
    */
  }

  async bashSql(sql, opts={}) {
    const msg = `SqlDpd.bashSql()`;
    let {
      dbg = this.dbg,
      mode = this.mode,
      maxBuffer = this.maxBuffer,
    } = opts;
    try {
      dbg && console.error(msg, '[1]sql', sql);
      let cmd = [
        'sqlite3 --batch local/dpd.db',
        mode ? `".mode ${mode}"` : '',
        `"${sql}"`,
      ].join(' ');
      dbg && console.error(msg, '[2]cmd', cmd);
      let res = await exec(cmd, {maxBuffer});
      dbg>1 && console.error(msg, '[2]res', res);
      let {stdout, stderr} = res;
      dbg>1 && console.error(msg, '[3]stdout', stdout);
      if (stderr) {
        console.error(msg, '[4]stderr', stderr);
      }
      return {stdout, stderr};
    } catch(e) { 
      console.error(msg, '[5]catch', e);
      throw e;
    }
  }

  async #fetchHeadwords(opts={}) {
    const msg = `SqlDpd.#fetchHeadwords()`;
    const {
      dbg = this.dbg,
      rowLimit = this.rowLimit,
      headwordPatterns = this.headwordPatterns,
    } = opts;
    let where = headwordPatterns
      ?  `where T1.pattern in ('${headwordPatterns.join("','")}')`
      : '';
    let sql = [
      'select',
      DPD_HEADWORD_COLS.join(','),
      'from dpd_headwords T1',
      where,
      `order by id`,
      rowLimit ? `limit ${rowLimit}` : '',
    ].join(' ');
    let {stdout, stderr} = await this.bashSql(sql, opts);
    console.error(msg, '[1]stdout,stderr', stdout?.length, stderr?.length);
    return {stdout, stderr};
  }

  async #loadHeadwords() {
    const msg = 'SqlDpd.#loadHeadwords:';

    let headwords;
    let headwordMap;
    try {
      let {
        dbg,
        verboseRows,
        headwordUsage,
      } = this;
      let {stdout,stderr} = await this.#fetchHeadwords();
      console.error(msg, '[0.1]stdout', stdout.length);
      headwords = JSON.parse(stdout);
      console.error(msg, '[1]headwords', headwords.length);
      headwordMap = headwords.reduce((a,hw,i)=>{
        let {
          id, pattern, meaning_1, meaning_2, meaning_lit,
          pos, source_1, construction,
        } = hw;
        if (headwordUsage[id] > 0) {
          a[id] = {
            id, pattern, meaning_1, meaning_2, meaning_lit,
            pos, source_1, construction,
          };
        }
        return a;
      }, {});
      if (dbg && verboseRows) {
        for (let i=0; i<verboseRows; i++) {
          let hwi = JSON.stringify(headwords[i], (k,v)=>v||undefined);
          console.error(' ', hwi);
        }
        console.error('  ...');
      }
    } catch(e) {
      console.error(msg, e);
      throw e;
    }
    return (this.dpdHeadwords = headwordMap);
  }

  async loadPatterns(opts={}) {
    const msg = `SqlDpd.loadPatterns()`;
    let { 
      dbg = this.dbg,
    } = opts;
    let sql = [
      'select pattern,count(*) count',
      'from dpd_headwords T1',
      'group by pattern',
      'order by count',
    ].join(' ');
    dbg && console.error(msg, '[1]sql', sql);
    let {stdout, stderr} = await this.bashSql(sql, opts);
    let json = JSON.parse(stdout);
    return json;
  }

  async #buildHeadwords() {
    const msg = `SqlDpd.#buildHeadwords:`;
    let dbg = DBG.SQL_DPD_BUILD || this.dbg;
    let { 
      dataDir,
      dpdHeadwords,
      verboseRows,
      headwordUsage,
    } = this;
    let hwKeys = Object.keys(headwordUsage).sort((a,b)=>{
      // Sort headwords with high usage to top,
      // then sort by existing index as a coarse proxy for
      // time of authorship as a crude metric for similarity
      // between adjacent definitions authored at the same time.
      // In theory, this adjacency should benefit translators
      // by grouping related definitions
      return (headwordUsage[b] - headwordUsage[a]) || (a-b);
    });

    // Build map from headword-id to definition-line-number.
    // Definitions lines are stored in a JSON array for
    // ease of translation;
    const FIRST_DEFINITION_LINE = 2;
    let hwIdMap = hwKeys.reduce((a,k,i)=>{
      // transform headword id => definition headword line number
      let hwLine = i+FIRST_DEFINITION_LINE; 
      a[k] = hwLine;
      if (dbg && i < verboseRows) {
        console.error(msg, `[0.1] hwIdMap[${k}]:`, hwLine);
      }
      return a;
    }, {});
    let hwIdJson = JSON.stringify(hwIdMap, null, 1);
    let fnMap = 'headword-id-map.mjs';
    let hwIdPath = path.join(dataDir, fnMap);
    await fs.promises.writeFile(hwIdPath, hwIdJson);
    console.error(msg, `[1]${fnMap}`, hwKeys.length+2);
    this.hwIdMap = hwIdMap;

    // Write out definition lines
    let defLines = hwKeys.map(k=>{
      let {
        id, pattern, meaning_1, meaning_2, meaning_lit, pos,
        construction,
      } = dpdHeadwords[k];
      return [
        pattern,
        pos,
        meaning_1,
        meaning_1.startsWith(meaning_2) ? '' : meaning_2,
        meaning_lit,
        construction,
        id,
      ].join('|');
    });

    let defLinesJson = JSON.stringify(defLines, null, 1);
    let fnLines = 'definition-lines.mjs';
    let defLinesPath = path.join(dataDir, fnLines);
    await fs.promises.writeFile(defLinesPath, defLinesJson);
    console.error(msg, `[1]${fnLines}`, defLines.length+2);

    this.defLines = defLines;
  }

  async #buildLookup() {
    const msg = `SqlDpd.#buildLookup:`;
    /*
    let {
      dbg,
      dataDir,
      rowLimit,
      paliMap,
      headwordUsage,
      dpdLookup,
    } = this;
    let paliWords = Object.keys(paliMap).sort(Pali.compareRoman);
    let lookupKeys = Object.keys(dpdLookup).sort(Pali.compareRoman);
    let lookupMap = lookupKeys.reduce((a,w)=>{
      a[w] = `{h:${JSON.stringify(dpdLookup[w])}}`;
      return a;
    }, {});

    dbg && console.error(msg, '[0.4]lookupMap', lookupMap, 
      paliWords.slice(0, verboseRows));
    dbg && console.error(msg, '[0.5]', {wAccept, wReject});

    let lookupOut = JSON.stringify(lookupMap, null, 1);
    let lookupPath = path.join(dataDir, 'lookup.mjs');
    await fs.promises.writeFile(lookupPath, lookupOut);
    console.error(msg, '[1]', lookupPath, lookupOut.length);

    this.dpdLookup = dpdLookup;

    return {
      lookupMap,
      wAccept,
      wReject,
      wPali,
      wUndefined,
    }
    */
  }

  async deprecated_buildLookup() {
    const msg = `SqlDpddeprecated_buildLookup:`;
    let {
      headwordUsage, // optional map of headword id's
      paliMap, // optional object map of allowed Pali words 
      rowLimit = this.rowLimit,
    } = opts;
    let {
      dbg,
      dataDir,
    } = this;
    let wAccept = 0; // DPD words used in paliMap
    let wReject = 0; // DPD words not used in paliMap
    let paliWords = Object.keys(paliMap).sort(Pali.compareRoman);
    let wPali = paliWords && paliWords.length || 0;
    let wUndefined = wPali; // paliMap words not defined in DPD
    let sql = [
      'select lookup_key word, headwords ',
      'from lookup T1',
      'where',
      "T1.headwords is not ''",
      'AND',
      "T1.grammar is not ''",
      rowLimit ? `limit ${rowLimit}` : '',
    ].join(' ');
    let {stdout, stderr} = await this.bashSql(sql);
    let lookupJson = JSON.parse(stdout);
    dbg>1 && console.error(msg, '[0.1]lookupJson', lookupJson);
    if (dbg) {
      let nWords = paliWords && paliWords.length || 'all';
      console.error(msg, '[0.2]paliWords', nWords);
    }
    // Filter out non-Mahāsaṅgīti words
    let dpdLookup = lookupJson.reduce((a,row,i)=>{
      let { word, headwords } = row;
      try {
        word = word.replace('ṃ', 'ṁ');
      } catch(e) {
        console.error(msg, {row}, e);
        throw e;
      }
      if (paliMap && paliMap[word]) {
        let hwrds = JSON.parse(headwords);
        a[word] = hwrds;
        if (headwordUsage) {
          for (let ihw=0; ihw<hwrds.length; ihw++) {
            let hw = hwrds[ihw];
            headwordUsage[hw] = (headwordUsage[hw]||0)+1;
          }
        }
        wAccept++;
        wUndefined--;
      } else {
        dbg>1 && console.error(msg, '[0.3]reject', word);
        wReject++;
      }
      return a;
    }, {});

    let lookupKeys = Object.keys(dpdLookup).sort(Pali.compareRoman);
    let lookupMap = lookupKeys.reduce((a,w)=>{
      a[w] = `{h:${JSON.stringify(dpdLookup[w])}}`;
      return a;
    }, {});

    dbg && console.error(msg, '[0.4]lookupMap', lookupMap, 
      paliWords.slice(0, verboseRows));
    dbg && console.error(msg, '[0.5]', {wAccept, wReject});

    let lookupOut = JSON.stringify(lookupMap, null, 1);
    let lookupPath = path.join(dataDir, 'lookup.mjs');
    await fs.promises.writeFile(lookupPath, lookupOut);
    console.error(msg, '[1]', lookupPath, lookupOut.length);

    this.dpdLookup = dpdLookup;

    return {
      lookupMap,
      wAccept,
      wReject,
      wPali,
      wUndefined,
    }
  }

}
