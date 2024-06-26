import { Pali } from "../main.mjs";
import should from "should";

typeof describe === "function" && describe("pali", function () {
  it("default constructor", () => {
    let pali = new Pali();

    should.deepEqual(Pali.OCBS_ALPHABET, [
      'a', 'ā', 'i', 'ī', 'u', 'ū', 'e', 'o', 
      'ṃ', 
      'k', 'kh', 'g', 'gh', 
      'ṅ', 'c', 'ch', 'j', 'jh', 
      'ñ', 'ṭ', 'ṭh', 'ḍ', 'ḍh', 
      'ṇ', 't', 'th', 'd', 'dh', 
      'n', 'p', 'ph', 'b', 'bh', 
      'm', 'y', 'r', 'l', 'ḷ', 'ḷh', 'v', 's', 'h',
    ]);
  });
  it("OCBS_CHAR_ORDER()", ()=>{
    //console.log(Pali.OCBS_CHAR_ORDER);
  });
  it("compareOCBS()", ()=>{
    let pali = new Pali();
    let test = (items, expected) =>{
      let sorted = items.split(' ').sort(Pali.compareOCBS).join(' ');
      should(sorted).equal(expected);
    }

    test('āsava ācariya ananta ānanda', 'ananta ācariya ānanda āsava');
    test('iñjati amacca oka ūhata', 'amacca iñjati ūhata oka');
    test('ghara gaṇa cakka joti', 'gaṇa ghara cakka joti');
    test('jeguccha jīva jāgara jaya', 'jaya jāgara jīva jeguccha');
    test('ṭhāna dhaja ḍaṃsa ñāṇa', 'ñāṇa ṭhāna ḍaṃsa dhaja');
    test('phala palapati bala bhava', 'palapati phala bala bhava');
    test('mettā māna mitta mūla', 'māna mitta mūla mettā');
    test('saṃyuta saṃyutta saṃyojita saṃyojana', 
      'saṃyuta saṃyutta saṃyojana saṃyojita');
    test('rāga lakkhaṇa yakkha vacana', 'yakkha rāga lakkhaṇa vacana');
    test('khattiya khandha khanti khama', 
      'khattiya khanti khandha khama');
    test('icchati iñjati icchā iṭṭha', 'icchati icchā iñjati iṭṭha');
    test('sīla siṅgāla sikhā sīta', 'sikhā siṅgāla sīta sīla');
  });
  it("compareRoman()", ()=>{
    let pali = new Pali();
    let test = (items, expected) =>{
      let sorted = items.split(/  */)
        .sort(Pali.compareRoman)
        .join(' ');
      should(sorted).equal(expected);
    }

    test('ṃd it ṃ  i', 'i it ṃ ṃd');
    test('āsava ācariya ananta ānanda', 'ananta ācariya ānanda āsava');
    test('iñjati amacca oka ūhata', 'amacca iñjati oka ūhata');
    test('ghara gaṇa cakka joti', 'cakka gaṇa ghara joti');
    test('jeguccha jīva jāgara jaya', 'jaya jāgara jeguccha jīva');
    test('ṭhāna dhaja ḍaṃsa ñāṇa', 'dhaja ḍaṃsa ñāṇa ṭhāna');
    test('phala palapati bhava bala', 'bala bhava palapati phala');
    test('mettā māna mitta mūla', 'māna mettā mitta mūla');
    test('saṃyuta saṃyutta saṃyojita saṃyojana', 
      'saṃyojana saṃyojita saṃyuta saṃyutta');
    test('rāga lakkhaṇa yakkha vacana', 'lakkhaṇa rāga vacana yakkha');
    test('khattiya khandha khanti khama', 
      'khama khandha khanti khattiya');
    test('icchati iñjati icchā iṭṭha', 'icchati icchā iñjati iṭṭha');
    test('sīla siṅgāla sikhā sīta', 'sikhā siṅgāla sīla sīta');
  });
  it("compareStem()", ()=>{
    return; // DEPRECATED
    let pali = new Pali();
    let test = (items, expected) =>{
      let sorted = items.split(' ').sort(Pali.compareStem).join(' ');
      should(sorted).equal(expected);
    }

    test('dhamma dhammehi dhammabhogo', 'dhamma dhammehi dhammabhogo');
    test('dhammo dhammehi dhammi dhammā ababo ūmi dhammabhogo dhamma', 
      'ababo dhamma dhammā dhammehi dhammabhogo dhammi dhammo ūmi'); 
  });
  it("compare endings()", ()=>{
    let pali = new Pali();
    let endings = [
      '-iṃ', 
      '-ī',
      '-iyo',
      '-i',
      '-ī',
      '-iyā',
      '-īhi',
    ];
    let sendings = endings.sort(Pali.compareRoman);
    should.deepEqual(sendings, [
      '-i',
      '-iṃ', 
      '-iyā',
      '-iyo',
      '-ī',
      '-ī',
      '-īhi',
    ]);
  });
  it("INFLECTIONS", ()=>{
    let inf = Pali.INFLECTIONS;
    should.deepEqual(inf[0], {
      "ending": [
        "-a",
        "ā"
      ],
      "gender": "masc.",
      "infCase": "nom",
      "singular": "-o",
      "plural": "-ā"
    });
  });
  it("wordStem", ()=>{
    // Singular
    should(Pali.wordStem("dhammo")).equal('dhamm');    // Nom
    should(Pali.wordStem("dhammassa")).equal('dhamm'); // Acc
    should(Pali.wordStem("dhammena")).equal('dhamm');  // Instr
    should(Pali.wordStem("dhammāya")).equal('dhamm');  // Dat
    should(Pali.wordStem("dhammā")).equal('dhamm');    // Abl
    should(Pali.wordStem("dhammasmā")).equal('dhamm'); // Abl
    should(Pali.wordStem("dhammamhā")).equal('dhamm'); // Abl
    should(Pali.wordStem("dhammassa")).equal('dhamm'); // Gen
    should(Pali.wordStem("dhamme")).equal('dhamm');    // Loc
    should(Pali.wordStem("dhammasmiṃ")).equal('dhamm');  // Loc
    should(Pali.wordStem("dhammamhi")).equal('dhamm');   // Loc
    should(Pali.wordStem("dhamma")).equal('dhamm');    // Voc

  });
  it("ENDING_MAX_LEN", ()=>{
    should(Pali.ENDING_MAX_LEN).equal(5);
  });
});
