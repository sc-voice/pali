import should from "should";
import fs from 'fs';
const fsp = fs.promises;
import path from 'path';
import util from 'util';
import * as url from 'url';
import { DBG } from '../src/defines.mjs';
const M = "test.SqlDpd:";
import * as Pali from '../src/pali.mjs';
import { default as SqlDpd } from '../scripts/js/sql-dpd.mjs';
const DIRNAME = import.meta.dirname;

let msg = M;

typeof describe==="function" && describe("sql-dpd", function() {
  before(()=>{
    console.log(msg, "before");
    let dataDir = path.join(`${DIRNAME}/../local/data`);
    fs.mkdirSync(dataDir, {recursive:true});
  });
  it("ctor", async()=>{
    let eCaught;
    try {
      let sqlDpd = new SqlDpd();
    } catch(e) {
      eCaught = e;
    }

    should(eCaught.message).match(/use SqlDpd.create/);
  });
  it("create() default", async()=>{
    let sqlDpd = await SqlDpd.create();
    should(sqlDpd).properties({
      dbg: DBG.SQL_DPD > 1 ? 1 : 0,
      rowLimit: 0,
      dataDir: path.join(import.meta.dirname, '../local/data'),
      paliMap: undefined,
      verboseRows: 3,
    });

    let { dpdHeadwords } = sqlDpd;
    let hwIds = Object.keys(dpdHeadwords);
    should(hwIds.length).above(70000); // no paliMap filter
  });
  it("create() paliMap, dataDir, verboseRows, dbg", async()=>{
    const msg = `${M}@37:`;
    let paliMap = {devi:1};
    let verboseRows = 0;
    let dataDir = path.join(import.meta.dirname, '../local/data');
    let dbg = 1;

    let sqlDpd = await SqlDpd.create({
      paliMap, verboseRows, dataDir, dbg,
    });
    should(sqlDpd).properties({
      dbg,
      rowLimit: 0,
      dataDir,
      paliMap,
      verboseRows,
    });

    let { dpdLookup, dpdHeadwords } = sqlDpd;
    let lookupKeys = Object.keys(dpdLookup);
    should(lookupKeys.length).equal(1); // devi

    should.deepEqual(sqlDpd.dpdLookup.devi, [34161, 34162])
    should(dpdHeadwords[34161]).properties({
      pattern: "ī fem",
      pos: "fem",
      id: 34161,
      meaning_1: "queen",
      meaning_2: "queen",
    });
    should(dpdHeadwords[34162]).properties({
      pattern: "ī fem",
      pos: "fem",
      id: 34162,
      meaning_1: "goddess",
      meaning_2: "goddess",
    });
    let hwIds = Object.keys(dpdHeadwords);
    should(hwIds.length).equal(2); // devi
  });
  it("create() headwordPatterns", async()=>{
    const msg = `${M}@37:`;
    let paliMap = { devi:1, deva:1 }; // test words
    let headwordPatterns = ['ī fem'];
    let verboseRows = 0;
    let dataDir = path.join(import.meta.dirname, '../local/data');
    let dbg = 1;

    // DEPRECATED: headwordPatterns
    // Restricts headwords to the specified patterns.
    // Restricting dictionary output by part of speech
    // during ongoing development should happen at 
    // a higher level since headword ids are permanent.
    let sqlDpd = await SqlDpd.create({
      paliMap, verboseRows, dataDir, dbg, headwordPatterns,
    });
    should(sqlDpd).properties({
      dbg,
      rowLimit: 0,
      dataDir,
      paliMap,
      verboseRows,
    });

    let { dictWords, dpdLookup, dpdHeadwords } = sqlDpd;
    should(dictWords.length).equal(2); // devi, deva
    let lookupKeys = Object.keys(dpdLookup);
    should.deepEqual(dictWords, [ 'deva', 'devi' ]);
    should.deepEqual(lookupKeys, dictWords);

    should.deepEqual(sqlDpd.dpdLookup.devi, [34161, 34162])
    should.deepEqual(sqlDpd.dpdLookup.deva, [34018, 34019, 34020, 34021])
    should(dpdHeadwords[34018]).equal(undefined);
    should(dpdHeadwords[34161]).properties({
      pattern: "ī fem",
      pos: "fem",
      id: 34161,
      meaning_1: "queen",
      meaning_2: "queen",
    });
    should(dpdHeadwords[34162]).properties({
      pattern: "ī fem",
      pos: "fem",
      id: 34162,
      meaning_1: "goddess",
      meaning_2: "goddess",
    });
    let hwIds = Object.keys(dpdHeadwords);
    should(hwIds.length).equal(2); // devi
  });
  it("build()", async()=>{
    let paliMap = { devi:1, deva:1 }; // test words
    let sqlDpd = await SqlDpd.create({paliMap});
    await sqlDpd.build();
    let { hwIdMap, defPali, defLang, defMap } = sqlDpd;

    should.deepEqual(hwIdMap, {
      34018: 2,
      34019: 3,
      34020: 4,
      34021: 5,
      34161: 6,
      34162: 7,
    });

    should(defLang[0])
    .equal('deity; god||');
    should(defPali[0])
    .equal('a masc|masc|√div > dev+*a');
    should(defLang[1])
    .equal('king; lord||');
    should(defPali[1])
    .equal('a masc|masc|√div > dev+*a');
    should(defLang[2])
    .equal('rain cloud||');
    should(defPali[2])
    .equal('a masc|masc|√div > dev+*a');
    should(defLang[3])
    .equal('sky||');
    should(defPali[3])
    .equal('a masc|masc|√div > dev+*a');
    should(defLang[4])
    .equal('queen||');
    should(defPali[4])
    .equal('ī fem|fem|√div > dev+*a+ī\ndeva+ī');
    should(defLang[5])
    .equal('goddess||');
    should(defPali[5])
    .equal('ī fem|fem|√div > dev+*a+ī\ndeva+ī');

    // defMap maps pali word to file line number,
    // which is 2+array index
    should.deepEqual(defMap, {
      deva: '2,3,4,5', // i.e., [0,1,2,3] in definition array
      devi: '6,7',      // i.e., [4,5] in definition array
    });
  });
});
