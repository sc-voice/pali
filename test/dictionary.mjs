import path from "path";
import fs from "fs";
const { promises: fsp } = fs;
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import should from "should";
import { DBG } from '../src/defines.mjs';
import {
  Pali,
  Dictionary,
} from '../main.mjs';

const dbg = 0;

async function testDeclensions({word, infExpected, nbr}) {
  const msg = "test.dictionary.testDeclensions()";
  const dbg = 1;
  dbg && console.log(msg, '[1]word', word);
  let dict = await Dictionary.create();
  let infTable = dict.wordInflections(word, {nbr});
  dbg && console.log(infTable.format({title:`${msg} infTable ${word}`}));

  for (let i=0; i<infExpected.length; i++) {
    let infA = infTable.rows[i];
    let infE = infExpected[i];
    let eMsg = (prop=> [
      `rows[${i}] ${infE?.word} (${prop}) =>`, 
      `${infA && infA[prop]}!=${infE && infE[prop]}`,
    ].join(' '));
    try {
      should(infA?.word).equal(infE?.word, eMsg('word'));
      should(infA?.nbr).equal(infE?.nbr, eMsg('nbr'));
      should(infA?.gdr).equal(infE?.gdr, eMsg('gdr'));
      should(infA?.case).equal(infE?.case, eMsg('case'));
    } catch(e) {
      console.log(msg, "ERROR", e.message, {infA, infE});
      throw e;
    }
  }
}

typeof describe === "function" && 
  describe("dictionary", function () 
{
  it("default ctor", async() => {
    let eCaught;
    try {
      let dict = new Dictionary();
    } catch(e) {
      eCaught = e;
    }
    should(eCaught?.message).match(/Use Dictionary.create/);
  });
  it("create()", async()=>{
    let dict = await Dictionary.create();
    should(dict.lang).equal('en');
    should(Dictionary.LICENSE).match(/digitalpalidictionary/);
    should(Dictionary.DEFINITION_KEYS.length).above(55000).below(60000);
  });
  it("TESTTESTentryOf() dhamma", async()=>{
    const msg = "test.dictionary@62";
    let dict = await Dictionary.create();
    let dhamma = dict.entryOf("dhamma");
    should(dhamma).properties(["word", "definition"]);
    should(dhamma.word).equal("dhamma");

    let def0 = dict.parseDefinition(dhamma.definition[0]);
    should(def0).properties({ // Pali properties
      pos: 'masc',
      pattern: 'a masc',
      construction: '√dhar+ma', 
      key: '90U',
    });
    should(def0).properties({ // Language properties
      meaning_1: 'nature; character',
      meaning_2: '',
      meaning_lit: '',
    });
    should(def0).properties({ // Legacy properties
      type: 'masc',
      meaning: 'nature; character',
      literal: '',
    });

    //console.log(msg, 'DHAMA', dhamma.definition.map((d,i)=>d));
    let defAlt = dict.parseDefinition(dhamma.definition[11]);
    should(defAlt).properties({ // Pali properties
      pos: 'nt',
      pattern: 'a nt',
      construction: '√dhar+ma', 
      key: '90f',
    });
    should(defAlt).properties({ // Language properties
      meaning_1: 'teaching; discourse; doctrine',
      meaning_2: '',
      meaning_lit: '',
    });
    //  .match(/nt.*teaching; discourse;/);
    let dhamma2 = dict.entryOf("dhamma");
    should.deepEqual(dhamma2, dhamma);
  });
  it("entryOf() no entry", async()=>{
    let dict = await Dictionary.create();

    // No entry
    let asdf = dict.entryOf("asdf");
    should(asdf).equal(null);
  });
  it("entryOf() misc", async()=>{
    let dict = await Dictionary.create();
    let dhamma = dict.entryOf("dhamma");
    // dhammo (similar definition)
    let dhammo = dict.entryOf("dhammo");
    should(dhammo.word).equal("dhammo");
    should.deepEqual(
      dhamma.definition.slice(0,11),
      dhammo.definition.slice(0,11));
    should.deepEqual(
      dhamma.definition.slice(12,16),
      dhammo.definition.slice(11));

    // dhammaṁ (anusvāra)
    let dhammam = dict.entryOf("dhammaṁ");
    should.deepEqual(dhammam.definition, dhamma.definition);

    // giddhe (literal)
    let giddhe = dict.entryOf("giddhe");
    should(giddhe.word).equal("giddhe");
    should(giddhe.definition[0])
      .match(/pp/)
      .match(/greedy.*\|become greedy/)
      .match(/\|√gidh\+ta/);
  });
  it("relatedEntries()", async()=>{
    const msg = 'test.dictionary@73';
    let dict = await Dictionary.create();
    let entries = dict.relatedEntries("dhamma");
    //console.log(msg, entries);
    should(entries.length).equal(16);
    let dhammaya = entries.find(e=>e.word === 'dhammāya');
    should(dhammaya.overlap).equal(1);
    should(dhammaya.definition.length).equal(17);
    let dhammani = entries.find(e=>e.word === 'dhammāni');
    should(dhammani.definition.length).equal(3);
  });
  it("parseDefinition()", async()=>{
    let dict = await Dictionary.create();
    let entry = dict.entryOf("dhamma");
    let parsed =  dict.parseDefinition(entry.definition[0]);
    should(parsed).properties({
      type: 'masc',
      meaning: 'nature; character',
      literal: '',
      construction: '√dhar+ma',
    });
  });
  it("TESTTESTfindWords()", async()=>{
    const msg = 'test.dictionary@153';
    let dict = await Dictionary.create();
    let matches = dict.findWords(/\bthe root of/i);
    should(matches.length).equal(6);

    { // matches multiple words
      let re = /the root of the boil/;
      let [def] = matches.filter(m=>re.test(m.definition));
      should.deepEqual(def.words, ['gaṇḍamūlaṁ', 'gaṇḍamūlo']);
    }

    { // matches single word
      let { definition, words } = matches[2];
      should.deepEqual(words, ['aññāṇamūlappabhavā']);
      should(definition).match(/born from the root of ignorance/);
    }
  });
  it("find() moral behaviour (definition)", async()=>{
    let dict = await Dictionary.create();
    let word1
    let pattern = 'moral behaviour'; 
    let res = dict.find(pattern);
    should(res.method).equal('definition');
    should(res.pattern).equal(pattern);
    for (let i=0; i<res.data.length; i++) {
      let { meaning } = res.data[i];
      should(meaning).match(new RegExp(`\\b${pattern}`, 'i'));
    }
    should(res.data.length).equal(30);
  });
  it("find() something abides (not in dictionary)", async()=>{
    let dict = await Dictionary.create();

    // words are in dictionary
    let patterns = [
      'something', // actual definition word
      'abides', // actual definition word
    ];
    should(dict.find(patterns[0])).not.equal(undefined);
    should(dict.find(patterns[1])).not.equal(undefined);

    // phrase is NOT in dictionary
    should(dict.find(patterns.join(' '))).equal(undefined);
  });
  it("find() dhamma (entry)", async()=>{
    let dict = await Dictionary.create();
    let dhamma = dict.find("dhamma");
    should(dhamma).properties(['pattern', 'method', 'data' ]);
    should(dhamma.method).equal('entry');
    should(dhamma.pattern).equal('dhamma');
    should(dhamma.data[0]).properties([
      "word", "type", "meaning", "literal", "construction"
    ]);
    should(dhamma.data[0]).properties({
      word: 'dhamma',
      type: 'masc',
      literal: '',
      construction: '√dhar+ma',
      meaning: 'nature; character',
    });
  });
  it("normalizePattern()", ()=>{
    let good = "abcdefghijklmnopqrstuvwxyz";
    let accented = [ 
      'ā', 'ī', 'ū', 'ṁ', 'ṃ', 'ḍ', 'ṅ', 'ñ', 'ṇ', 'ḷ', 'ṭ',
    ].join('');
    should(Dictionary.normalizePattern(good)).equal(good);
    should(Dictionary.normalizePattern(accented)).equal(accented);
  });
  it("find() unaccented", async()=>{
    let dict = await Dictionary.create();
    let dhamma = dict.find("dhamma");
    let dhamma_rom = dict.find("dhamma", {method:'unaccented'});
    should(dhamma_rom).properties(['pattern', 'method', 'data' ]);
    should(dhamma_rom.method).equal('unaccented');
    should(dhamma_rom.pattern).equal('(d|ḍ)h(a|ā)(m|ṁ|ṃ)(m|ṁ|ṃ)(a|ā)');
    should(dhamma_rom.data.length).equal(34);
    should(dhamma_rom.data[0]).properties( { // same as "dhamma"
      word: 'dhamma',
      type: 'masc',
      literal: '',
      construction: '√dhar+ma',
      meaning: 'nature; character',
    });
    should(dhamma_rom.data[17]).properties( { // almost like "dhamma"
      word: 'dhammā', 
      type: 'masc',
      literal: '',
      construction: '√dhar+ma',
      meaning: 'nature; character',
    });
  });
  it("find() definition superior virtue", async()=>{
    let dict = await Dictionary.create();
    let virtue = dict.find("superior virtue", {method:'definition'});
    should(virtue).properties(['pattern', 'method', 'data' ]);
    should(virtue.method).equal('definition');
    should(virtue.pattern).equal('superior virtue');
    should(virtue.data.length).equal(2);
    should(virtue.data[0]).properties( {
      word: 'sīlagga',
      type: 'nt',
      literal: '',
      meaning: 'the highest ethical conduct; superior virtue',
      construction: 'sīla+agga',
    });
  });
  it("find() virtue; moral behaviour", async()=>{
    const msg = 'test.dictionary@262';
    let dict = await Dictionary.create();
    let pattern = 'virtue; moral behaviour';
    let virtue = dict.find(pattern, {method: 'definition'});
    should(virtue).properties(['pattern', 'method', 'data' ]);
    should(virtue.method).equal('definition');
    should(virtue.pattern).equal(pattern);
    dbg && console.log(msg, {data:virtue.data.map(d=>d.word)});
    should(virtue.data.length).equal(14); // exclude dhammāna
    should(virtue.data[0]).properties({
      word: 'dhamma',
      type: 'masc',
      literal: '',
      meaning: 'virtue; moral behaviour',
      construction: '√dhar+ma',
    });
    should(virtue.data[1]).properties({
      word: 'dhammasmiṁ',
      type: 'masc',
      literal: '',
      meaning: 'virtue; moral behaviour',
      construction: '√dhar+ma',
    });
  });
  it("isAccented()", ()=>{
    should(Dictionary.isAccented("samvega")).equal(false);
    should(Dictionary.isAccented("saṁvega")).equal(true);
  });
  it("TESTTESTwordsWithPrefix()", async ()=>{
    let msg = 'test.dictionary@295';
    let dict = await Dictionary.create();

    // When strict is false (default), the output may have ellipses:
    should.deepEqual(dict.wordsWithPrefix("sam").slice(0,22), [
      "saṁ",  // 3-letter exact
      "sama", // 4-letter exact
      "samā", // 4-letter exact
      "same", // 4-letter exact
      "sami", // 4-letter exact
      "samī", // 4-letter exact
      "samo", // 4-letter exact
      "samū", // 4-letter exact
      "sāma", // 4-letter exact
      "sāmā", // 4-letter exact
      "sāme", // 4-letter exact
      "sāmi", // 4-letter exact
      "sāmī", // 4-letter exact
      "sāmo", // 4-letter exact
      "sama\u2026", // 4-letter prefix
      "samā\u2026", // 4-letter prefix
      "samb\u2026", // 4-letter prefix
      "same\u2026", // 4-letter prefix
      "samh\u2026", // 4-letter prefix
      "sami\u2026", // 4-letter prefix
      "samī\u2026", // 4-letter prefix
      "samm\u2026", // 4-letter prefix
    ]);

    // When strict is false, unaccented patterns are used
    should.deepEqual(dict.wordsWithPrefix("samvega"), [
      "saṁvega",
      "saṁvegā",
      "saṁvegaj\u2026",
      "saṁvegam\u2026",
      "saṁvegāy\u2026",
    ]);
  });
  it("wordsWithPrefix() strict", async ()=>{
    let dict = await Dictionary.create();
    let opts = { strict: true };
    should.deepEqual(dict.wordsWithPrefix("samvega", opts), [
      // there is no samvega
    ]);
    let sam = dict.wordsWithPrefix("saṁ", opts);
    should(sam[0]).equal("saṁ"); // exact match
    should(sam.length).above(460).below(500);
  });
  it("ABBREVIATIONS", ()=>{
    should(Dictionary.ABBREVIATIONS).properties({
      pr: {
        meaning: "present"
      }
    });
  });
  it("find() -mu", async()=>{
    let dict = await Dictionary.create();
    let dhamma = dict.find("dhamma -mu");
    should(dhamma.data.length).equal(34); // dhamma + dhammā
  });
  it("wordInflections dhamma", async()=>{
    const infExpected = [
      { gdr:'nt', case:'nom', nbr:'sg', word:'dhammaṁ' },
      { gdr:'nt', case:'acc', nbr:'sg', word:'dhammaṁ' },
      { gdr:'nt', case:'instr', nbr:'sg', word:'dhammā' },
      { gdr:'nt', case:'instr', nbr:'sg', word:'dhammena' },
      { gdr:'nt', case:'dat', nbr:'sg', word:'dhammassa' },
      { gdr:'nt', case:'dat', nbr:'sg', word:'dhammāya' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'dhammato' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'dhammamhā' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'dhammasmā' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'dhammā' },
      { gdr:'nt', case:'gen', nbr:'sg', word:'dhammassa' },
      { gdr:'nt', case:'loc', nbr:'sg', word:'dhammamhi' },
      { gdr:'nt', case:'loc', nbr:'sg', word:'dhammasmiṁ' },
      { gdr:'nt', case:'loc', nbr:'sg', word:'dhamme' },
      { gdr:'nt', case:'voc', nbr:'sg', word:'dhamma' },
      { gdr:'nt', case:'voc', nbr:'sg', word:'dhammaṁ' },
      { gdr:'nt', case:'voc', nbr:'sg', word:'dhammā' },
      { gdr:'nt', case:'nom', nbr:'pl', word:'dhammā' },
      { gdr:'nt', case:'nom', nbr:'pl', word:'dhammāni' },
      { gdr:'nt', case:'acc', nbr:'pl', word:'dhammāni' },
      { gdr:'nt', case:'acc', nbr:'pl', word:'dhamme' },
      { gdr:'nt', case:'instr', nbr:'pl', word:'dhammebhi' },
      { gdr:'nt', case:'instr', nbr:'pl', word:'dhammehi' },
      { gdr:'nt', case:'dat', nbr:'pl', word:'dhammānaṁ' },
      { gdr:'nt', case:'abl', nbr:'pl', word:'dhammebhi' },
      { gdr:'nt', case:'abl', nbr:'pl', word:'dhammehi' },
      { gdr:'nt', case:'gen', nbr:'pl', word:'dhammāna' },
      { gdr:'nt', case:'gen', nbr:'pl', word:'dhammānaṁ' },
      { gdr:'nt', case:'loc', nbr:'pl', word:'dhammesu' },
      { gdr:'nt', case:'voc', nbr:'pl', word:'dhammā' },
      { gdr:'nt', case:'voc', nbr:'pl', word:'dhammāni' },
      { gdr:'masc', case:'nom', nbr:'sg', word:'dhammo' },
      { gdr:'masc', case:'acc', nbr:'sg', word:'dhammaṁ' },
      { gdr:'masc', case:'instr', nbr:'sg', word:'dhammā' },
      { gdr:'masc', case:'instr', nbr:'sg', word:'dhammena' },
      { gdr:'masc', case:'dat', nbr:'sg', word:'dhammassa' },
      { gdr:'masc', case:'dat', nbr:'sg', word:'dhammāya' },
      { gdr:'masc', case:'abl', nbr:'sg', word:'dhammato' },
      { gdr:'masc', case:'abl', nbr:'sg', word:'dhammamhā' },
      { gdr:'masc', case:'abl', nbr:'sg', word:'dhammasmā' },
      { gdr:'masc', case:'abl', nbr:'sg', word:'dhammā' },
      { gdr:'masc', case:'gen', nbr:'sg', word:'dhammassa' },
      { gdr:'masc', case:'loc', nbr:'sg', word:'dhammamhi' },
      { gdr:'masc', case:'loc', nbr:'sg', word:'dhammasmiṁ' },
      { gdr:'masc', case:'loc', nbr:'sg', word:'dhamme' },
      { gdr:'masc', case:'voc', nbr:'sg', word:'dhamma' },
      { gdr:'masc', case:'voc', nbr:'sg', word:'dhammā' },
      { gdr:'masc', case:'nom', nbr:'pl', word:'dhammā' },
      { gdr:'masc', case:'nom', nbr:'pl', word:'dhammāse' },
      { gdr:'masc', case:'acc', nbr:'pl', word:'dhamme' },
      { gdr:'masc', case:'instr', nbr:'pl', word:'dhammebhi' },
      { gdr:'masc', case:'instr', nbr:'pl', word:'dhammehi' },
      { gdr:'masc', case:'dat', nbr:'pl', word:'dhammānaṁ' },
      { gdr:'masc', case:'abl', nbr:'pl', word:'dhammato' },
      { gdr:'masc', case:'abl', nbr:'pl', word:'dhammebhi' },
      { gdr:'masc', case:'abl', nbr:'pl', word:'dhammehi' },
      { gdr:'masc', case:'gen', nbr:'pl', word:'dhammāna' },
      { gdr:'masc', case:'gen', nbr:'pl', word:'dhammānaṁ' },
      { gdr:'masc', case:'loc', nbr:'pl', word:'dhammesu' },
      { gdr:'masc', case:'voc', nbr:'pl', word:'dhammā' },
      { gdr:'fem', case:'nom', nbr:'sg', word:'dhammā' },
      { gdr:'fem', case:'acc', nbr:'sg', word:'dhammaṁ' },
      { gdr:'fem', case:'instr', nbr:'sg', word:'dhammā' },
      { gdr:'fem', case:'instr', nbr:'sg', word:'dhammāya' },
      { gdr:'fem', case:'dat', nbr:'sg', word:'dhammāya' },
      { gdr:'fem', case:'abl', nbr:'sg', word:'dhammato' },
      { gdr:'fem', case:'abl', nbr:'sg', word:'dhammāto' },
      { gdr:'fem', case:'abl', nbr:'sg', word:'dhammāya' },
      { gdr:'fem', case:'gen', nbr:'sg', word:'dhammāya' },
      { gdr:'fem', case:'loc', nbr:'sg', word:'dhammāya' },
      { gdr:'fem', case:'loc', nbr:'sg', word:'dhammāyaṁ' },
      { gdr:'fem', case:'voc', nbr:'sg', word:'dhamma' },
      { gdr:'fem', case:'voc', nbr:'sg', word:'dhamme' },
      { gdr:'fem', case:'nom', nbr:'pl', word:'dhammā' },
      { gdr:'fem', case:'nom', nbr:'pl', word:'dhammāyo' },
      { gdr:'fem', case:'acc', nbr:'pl', word:'dhammā' },
      { gdr:'fem', case:'acc', nbr:'pl', word:'dhammāyo' },
      { gdr:'fem', case:'instr', nbr:'pl', word:'dhammābhi' },
      { gdr:'fem', case:'instr', nbr:'pl', word:'dhammāhi' },
      { gdr:'fem', case:'dat', nbr:'pl', word:'dhammānaṁ' },
      { gdr:'fem', case:'abl', nbr:'pl', word:'dhammābhi' },
      { gdr:'fem', case:'abl', nbr:'pl', word:'dhammāhi' },
      { gdr:'fem', case:'gen', nbr:'pl', word:'dhammānaṁ' },
      { gdr:'fem', case:'loc', nbr:'pl', word:'dhammāsu' },
      { gdr:'fem', case:'voc', nbr:'pl', word:'dhammā' },
      { gdr:'fem', case:'voc', nbr:'pl', word:'dhammāyo' },
    {}];
    await testDeclensions({word:'dhamma', infExpected});
  });
  it("wordInflections devī", async()=>{ 
    const msg = 'test.dictionary@447';
    const infExpected = [
      { gdr:'fem', case:'nom', nbr:'sg', word:'devī' }, 
      { gdr:'fem', case:'acc', nbr:'sg', word:'deviṁ' },
      { gdr:'fem', case:'instr', nbr:'sg', word:'deviyā' }, 
      { gdr:'fem', case:'dat', nbr:'sg', word:'deviyā' },
      { gdr:'fem', case:'abl', nbr:'sg', word:'deviyā' },
      { gdr:'fem', case:'gen', nbr:'sg', word:'deviyā' },
      { gdr:'fem', case:'loc', nbr:'sg', word:'deviyā' },
      { gdr:'fem', case:'voc', nbr:'sg', word:'devi' },
      { gdr:'fem', case:'voc', nbr:'sg', word:'devī' },

      { gdr:'fem', case:'nom', nbr:'pl', word:'deviyo' },
      { gdr:'fem', case:'nom', nbr:'pl', word:'devī' }, 
      { gdr:'fem', case:'acc', nbr:'pl', word:'deviyo' },
      { gdr:'fem', case:'acc', nbr:'pl', word:'devī' }, 
      { gdr:'fem', case:'voc', nbr:'pl', word:'deviyo' },
      { gdr:'fem', case:'voc', nbr:'pl', word:'devī' },
    ];
    await testDeclensions({word:'devī', infExpected, });
  });
  it("TBDTESTTESTwordInflections aggi", async()=>{
    const msg = 'test.dictionary@429';
    DBG.TBD && console.log(msg, 'TBD'); return;
    const infExpected = [
      { gdr:'nt', case:'nom', nbr:'sg', word:'aggi' }, 
      { gdr:'nt', case:'acc', nbr:'sg', word:'aggiṁ' }, 
      { gdr:'nt', case:'instr', nbr:'sg', word:'agginā' }, 
      { gdr:'nt', case:'dat', nbr:'sg', word:'aggino' },
      { gdr:'nt', case:'dat', nbr:'sg', word:'aggissa' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'aggito' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'agginā' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'aggimhā' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'aggismā' },
      { gdr:'nt', case:'gen', nbr:'sg', word:'aggino' }, 
      { gdr:'nt', case:'gen', nbr:'sg', word:'aggissa' }, 
      { gdr:'nt', case:'loc', nbr:'sg', word:'aggini' }, 
      { gdr:'nt', case:'loc', nbr:'sg', word:'aggimhi' }, 
      { gdr:'nt', case:'loc', nbr:'sg', word:'aggismiṁ' }, 
      { gdr:'nt', case:'voc', nbr:'sg', word:'aggi' }, 

      { gdr:'nt', case:'nom', nbr:'pl', word:'aggī' }, 
      { gdr:'nt', case:'nom', nbr:'pl', word:'aggīni' }, 
      { gdr:'nt', case:'acc', nbr:'pl', word:'aggī' }, 
      { gdr:'nt', case:'acc', nbr:'pl', word:'aggīni' }, 
      { gdr:'nt', case:'instr', nbr:'pl', word:'aggibhi' }, 
      { gdr:'nt', case:'instr', nbr:'pl', word:'aggīhi' }, 
      { gdr:'nt', case:'dat', nbr:'pl', word:'aggīnaṁ' }, 
      { gdr:'nt', case:'abl', nbr:'pl', word:'aggibhi' }, 
      { gdr:'nt', case:'abl', nbr:'pl', word:'aggīhi' }, 
      { gdr:'nt', case:'gen', nbr:'pl', word:'aggīnaṁ' }, 
      { gdr:'nt', case:'loc', nbr:'pl', word:'aggisu' }, 
      { gdr:'nt', case:'loc', nbr:'pl', word:'aggīsu' }, 
      { gdr:'nt', case:'voc', nbr:'pl', word:'aggī' }, 
      { gdr:'nt', case:'voc', nbr:'pl', word:'aggīni' }, 
    {}];
    await testDeclensions({word:'aggi', infExpected});
  });
  it("TBDTESTTESTwordInflections akkhi", async()=>{
    const msg = 'test.dictionary@467';
    DBG.TBD && console.log(msg, 'TBD'); return;
    const infExpected = [
      { gdr:'nt', case:'nom', nbr:'sg', word:'akkhi' }, 
      { gdr:'nt', case:'acc', nbr:'sg', word:'akkhiṁ' }, 
      { gdr:'nt', case:'instr', nbr:'sg', word:'akkhinā' }, 
      { gdr:'nt', case:'dat', nbr:'sg', word:'akkhino' },
      { gdr:'nt', case:'dat', nbr:'sg', word:'akkhissa' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'akkhito' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'akkhinā' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'akkhimhā' },
      { gdr:'nt', case:'abl', nbr:'sg', word:'akkhismā' },
      { gdr:'nt', case:'gen', nbr:'sg', word:'akkhino' }, 
      { gdr:'nt', case:'gen', nbr:'sg', word:'akkhissa' }, 
      { gdr:'nt', case:'loc', nbr:'sg', word:'akkhini' }, 
      { gdr:'nt', case:'loc', nbr:'sg', word:'akkhimhi' }, 
      { gdr:'nt', case:'loc', nbr:'sg', word:'akkhismiṁ' }, 
      { gdr:'nt', case:'voc', nbr:'sg', word:'akkhi' }, 

      { gdr:'nt', case:'nom', nbr:'pl', word:'akkhī' }, 
      { gdr:'nt', case:'nom', nbr:'pl', word:'akkhīni' }, 
      { gdr:'nt', case:'acc', nbr:'pl', word:'akkhī' }, 
      { gdr:'nt', case:'acc', nbr:'pl', word:'akkhīni' }, 
      { gdr:'nt', case:'instr', nbr:'pl', word:'akkhibhi' }, 
      { gdr:'nt', case:'instr', nbr:'pl', word:'akkhīhi' }, 
      { gdr:'nt', case:'dat', nbr:'pl', word:'akkhīnaṁ' }, 
      { gdr:'nt', case:'abl', nbr:'pl', word:'akkhibhi' }, 
      { gdr:'nt', case:'abl', nbr:'pl', word:'akkhīhi' }, 
      { gdr:'nt', case:'gen', nbr:'pl', word:'akkhīnaṁ' }, 
      { gdr:'nt', case:'loc', nbr:'pl', word:'akkhisu' }, 
      { gdr:'nt', case:'loc', nbr:'pl', word:'akkhīsu' }, 
      { gdr:'nt', case:'voc', nbr:'pl', word:'akkhī' }, 
      { gdr:'nt', case:'voc', nbr:'pl', word:'akkhīni' }, 
    {}];
    await testDeclensions({word:'akkhi', infExpected});
  });
  it("prefixOf()", ()=>{
    should(Dictionary.prefixOf('')).equal('');
    should(Dictionary.prefixOf('abc')).equal('abc');
    should(Dictionary.prefixOf('abcdef', 'abc', 'aba')).equal('ab');
    should(Dictionary.prefixOf(['a', 'abc', 'aba'])).equal('a');
  });
});
