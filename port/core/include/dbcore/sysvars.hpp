// dbcore/sysvars.hpp — la tabla sysvar(1..255) de LoadSysVars
// (DNATokenizing.bas:862-3167), transcrita mecanicamente del fuente (script
// de extraccion sobre el commit 02b20d7; verificada contra spec/sysvars.yaml:
// 255 entradas, 247 direcciones, 8 pares de alias en 5/6/200/217/699/824/826/923).
// El orden de entrada es el orden de indice de la tabla original: SysvarTok
// recorre en orden y gana la ULTIMA coincidencia (loader.hpp).
// Las tablas sysvarIN/sysvarOUT (solo mutaciones, 21-MEMORIA.md §8) quedan
// para el milestone de mutaciones.
#pragma once

#include <array>

#include "loader.hpp"

namespace db {

inline const SysvarTable& DefaultSysvarTable() {
  static const SysvarTable table = [] {
    SysvarTable t;
    t.entries = {
        {"up", 1},  // sysvar(1)
        {"dn", 2},  // sysvar(2)
        {"sx", 3},  // sysvar(3)
        {"dx", 4},  // sysvar(4)
        {"aimdx", 5},  // sysvar(5)
        {"aimright", 5},  // sysvar(6)
        {"aimsx", 6},  // sysvar(7)
        {"aimleft", 6},  // sysvar(8)
        {"shoot", 7},  // sysvar(9)
        {"shootval", 8},  // sysvar(10)
        {"robage", 9},  // sysvar(11)
        {"mass", 10},  // sysvar(12)
        {"maxvel", 11},  // sysvar(13)
        {"timer", 12},  // sysvar(14)
        {"aim", 18},  // sysvar(15)
        {"setaim", 19},  // sysvar(16)
        {"bodgain", 194},  // sysvar(17)
        {"bodloss", 195},  // sysvar(18)
        {"velscalar", 196},  // sysvar(19)
        {"velsx", 197},  // sysvar(20)
        {"veldx", 198},  // sysvar(21)
        {"veldn", 199},  // sysvar(22)
        {"velup", 200},  // sysvar(23)
        {"vel", 200},  // sysvar(24)
        {"hit", 201},  // sysvar(25)
        {"shflav", 202},  // sysvar(26)
        {"pain", 203},  // sysvar(27)
        {"pleas", 204},  // sysvar(28)
        {"hitup", 205},  // sysvar(29)
        {"hitdn", 206},  // sysvar(30)
        {"hitdx", 207},  // sysvar(31)
        {"hitsx", 208},  // sysvar(32)
        {"shang", 209},  // sysvar(33)
        {"shup", 210},  // sysvar(34)
        {"shdn", 211},  // sysvar(35)
        {"shdx", 212},  // sysvar(36)
        {"shsx", 213},  // sysvar(37)
        {"edge", 214},  // sysvar(38)
        {"fixed", 215},  // sysvar(39)
        {"fixpos", 216},  // sysvar(40)
        {"depth", 217},  // sysvar(41)
        {"ypos", 217},  // sysvar(42)
        {"daytime", 218},  // sysvar(43)
        {"xpos", 219},  // sysvar(44)
        {"kills", 220},  // sysvar(45)
        {"hitang", 221},  // sysvar(46)
        {"repro", 300},  // sysvar(47)
        {"mrepro", 301},  // sysvar(48)
        {"sexrepro", 302},  // sysvar(49)
        {"nrg", 310},  // sysvar(50)
        {"body", 311},  // sysvar(51)
        {"fdbody", 312},  // sysvar(52)
        {"strbody", 313},  // sysvar(53)
        {"setboy", 314},  // sysvar(54)
        {"rdboy", 315},  // sysvar(55)
        {"tie", 330},  // sysvar(56)
        {"stifftie", 331},  // sysvar(57)
        {"mkvirus", 335},  // sysvar(58)
        {"dnalen", 336},  // sysvar(59)
        {"vtimer", 337},  // sysvar(60)
        {"vshoot", 338},  // sysvar(61)
        {"genes", 339},  // sysvar(62)
        {"delgene", 340},  // sysvar(63)
        {"thisgene", 341},  // sysvar(64)
        {"sun", 400},  // sysvar(65)
        {"trefbody", 437},  // sysvar(66)
        {"trefxpos", 438},  // sysvar(67)
        {"trefypos", 439},  // sysvar(68)
        {"trefvelmysx", 440},  // sysvar(69)
        {"trefvelmydx", 441},  // sysvar(70)
        {"trefvelmydn", 442},  // sysvar(71)
        {"trefvelmyup", 443},  // sysvar(72)
        {"trefvelscalar", 444},  // sysvar(73)
        {"trefvelyoursx", 445},  // sysvar(74)
        {"trefvelyourdx", 446},  // sysvar(75)
        {"trefvelyourdn", 447},  // sysvar(76)
        {"trefvelyourup", 448},  // sysvar(77)
        {"trefshell", 449},  // sysvar(78)
        {"tieang", 450},  // sysvar(79)
        {"tielen", 451},  // sysvar(80)
        {"tieloc", 452},  // sysvar(81)
        {"tieval", 453},  // sysvar(82)
        {"tiepres", 454},  // sysvar(83)
        {"tienum", 455},  // sysvar(84)
        {"trefup", 456},  // sysvar(85)
        {"trefdn", 457},  // sysvar(86)
        {"trefsx", 458},  // sysvar(87)
        {"trefdx", 459},  // sysvar(88)
        {"trefaimdx", 460},  // sysvar(89)
        {"trefaimsx", 461},  // sysvar(90)
        {"trefshoot", 462},  // sysvar(91)
        {"trefeye", 463},  // sysvar(92)
        {"trefnrg", 464},  // sysvar(93)
        {"trefage", 465},  // sysvar(94)
        {"numties", 466},  // sysvar(95)
        {"deltie", 467},  // sysvar(96)
        {"fixang", 468},  // sysvar(97)
        {"fixlen", 469},  // sysvar(98)
        {"multi", 470},  // sysvar(99)
        {"readtie", 471},  // sysvar(100)
        {"fertilized", 303},  // sysvar(101)
        {"memval", 473},  // sysvar(102)
        {"memloc", 474},  // sysvar(103)
        {"tmemval", 475},  // sysvar(104)
        {"tmemloc", 476},  // sysvar(105)
        {"reffixed", 477},  // sysvar(106)
        {"treffixed", 478},  // sysvar(107)
        {"trefaim", 479},  // sysvar(108)
        {"tieang1", 480},  // sysvar(109)
        {"tieang2", 481},  // sysvar(110)
        {"tieang3", 482},  // sysvar(111)
        {"tieang4", 483},  // sysvar(112)
        {"tielen1", 484},  // sysvar(113)
        {"tielen2", 485},  // sysvar(114)
        {"tielen3", 486},  // sysvar(115)
        {"tielen4", 487},  // sysvar(116)
        {"eye1", 501},  // sysvar(117)
        {"eye2", 502},  // sysvar(118)
        {"eye3", 503},  // sysvar(119)
        {"eye4", 504},  // sysvar(120)
        {"eye5", 505},  // sysvar(121)
        {"eye6", 506},  // sysvar(122)
        {"eye7", 507},  // sysvar(123)
        {"eye8", 508},  // sysvar(124)
        {"eye9", 509},  // sysvar(125)
        {"refmulti", 686},  // sysvar(126)
        {"refshell", 687},  // sysvar(127)
        {"refbody", 688},  // sysvar(128)
        {"refxpos", 689},  // sysvar(129)
        {"refypos", 690},  // sysvar(130)
        {"refvelscalar", 695},  // sysvar(131)
        {"refvelsx", 696},  // sysvar(132)
        {"refveldx", 697},  // sysvar(133)
        {"refveldn", 698},  // sysvar(134)
        {"refvel", 699},  // sysvar(135)
        {"refvelup", 699},  // sysvar(136)
        {"refup", 701},  // sysvar(137)
        {"refdn", 702},  // sysvar(138)
        {"refsx", 703},  // sysvar(139)
        {"refdx", 704},  // sysvar(140)
        {"refaimdx", 705},  // sysvar(141)
        {"refaimsx", 706},  // sysvar(142)
        {"refshoot", 707},  // sysvar(143)
        {"refeye", 708},  // sysvar(144)
        {"refnrg", 709},  // sysvar(145)
        {"refage", 710},  // sysvar(146)
        {"refaim", 711},  // sysvar(147)
        {"reftie", 712},  // sysvar(148)
        {"refpoison", 713},  // sysvar(149)
        {"refvenom", 714},  // sysvar(150)
        {"refkills", 715},  // sysvar(151)
        {"myup", 721},  // sysvar(152)
        {"mydn", 722},  // sysvar(153)
        {"mysx", 723},  // sysvar(154)
        {"mydx", 724},  // sysvar(155)
        {"myaimdx", 725},  // sysvar(156)
        {"myaimsx", 726},  // sysvar(157)
        {"myshoot", 727},  // sysvar(158)
        {"myeye", 728},  // sysvar(159)
        {"myties", 729},  // sysvar(160)
        {"mypoison", 730},  // sysvar(161)
        {"myvenom", 731},  // sysvar(162)
        {"out1", 800},  // sysvar(163)
        {"out2", 801},  // sysvar(164)
        {"out3", 802},  // sysvar(165)
        {"out4", 803},  // sysvar(166)
        {"out5", 804},  // sysvar(167)
        {"out6", 805},  // sysvar(168)
        {"out7", 806},  // sysvar(169)
        {"out8", 807},  // sysvar(170)
        {"out9", 808},  // sysvar(171)
        {"out10", 809},  // sysvar(172)
        {"in1", 810},  // sysvar(173)
        {"in2", 811},  // sysvar(174)
        {"in3", 812},  // sysvar(175)
        {"in4", 813},  // sysvar(176)
        {"in5", 814},  // sysvar(177)
        {"in6", 815},  // sysvar(178)
        {"in7", 816},  // sysvar(179)
        {"in8", 817},  // sysvar(180)
        {"in9", 818},  // sysvar(181)
        {"in10", 819},  // sysvar(182)
        {"mkslime", 820},  // sysvar(183)
        {"slime", 821},  // sysvar(184)
        {"mkshell", 822},  // sysvar(185)
        {"shell", 823},  // sysvar(186)
        {"strvenom", 824},  // sysvar(187)
        {"mkvenom", 824},  // sysvar(188)
        {"venom", 825},  // sysvar(189)
        {"strpoison", 826},  // sysvar(190)
        {"mkpoison", 826},  // sysvar(191)
        {"poison", 827},  // sysvar(192)
        {"waste", 828},  // sysvar(193)
        {"pwaste", 829},  // sysvar(194)
        {"sharenrg", 830},  // sysvar(195)
        {"sharewaste", 831},  // sysvar(196)
        {"shareshell", 832},  // sysvar(197)
        {"shareslime", 833},  // sysvar(198)
        {"ploc", 834},  // sysvar(199)
        {"vloc", 835},  // sysvar(200)
        {"venval", 836},  // sysvar(201)
        {"paralyzed", 837},  // sysvar(202)
        {"poisoned", 838},  // sysvar(203)
        {"backshot", 900},  // sysvar(204)
        {"aimshoot", 901},  // sysvar(205)
        {"eyef", 510},  // sysvar(206)
        {"focuseye", 511},  // sysvar(207)
        {"eye1dir", 521},  // sysvar(208)
        {"eye2dir", 522},  // sysvar(209)
        {"eye3dir", 523},  // sysvar(210)
        {"eye4dir", 524},  // sysvar(211)
        {"eye5dir", 525},  // sysvar(212)
        {"eye6dir", 526},  // sysvar(213)
        {"eye7dir", 527},  // sysvar(214)
        {"eye8dir", 528},  // sysvar(215)
        {"eye9dir", 529},  // sysvar(216)
        {"eye1width", 531},  // sysvar(217)
        {"eye2width", 532},  // sysvar(218)
        {"eye3width", 533},  // sysvar(219)
        {"eye4width", 534},  // sysvar(220)
        {"eye5width", 535},  // sysvar(221)
        {"eye6width", 536},  // sysvar(222)
        {"eye7width", 537},  // sysvar(223)
        {"eye8width", 538},  // sysvar(224)
        {"eye9width", 539},  // sysvar(225)
        {"reftype", 685},  // sysvar(226)
        {"totalbots", 401},  // sysvar(227)
        {"totalmyspecies", 402},  // sysvar(228)
        {"tout1", 410},  // sysvar(229)
        {"tout2", 411},  // sysvar(230)
        {"tout3", 412},  // sysvar(231)
        {"tout4", 413},  // sysvar(232)
        {"tout5", 414},  // sysvar(233)
        {"tout6", 415},  // sysvar(234)
        {"tout7", 416},  // sysvar(235)
        {"tout8", 417},  // sysvar(236)
        {"tout9", 418},  // sysvar(237)
        {"tout10", 419},  // sysvar(238)
        {"tin1", 420},  // sysvar(239)
        {"tin2", 421},  // sysvar(240)
        {"tin3", 422},  // sysvar(241)
        {"tin4", 423},  // sysvar(242)
        {"tin5", 424},  // sysvar(243)
        {"tin6", 425},  // sysvar(244)
        {"tin7", 426},  // sysvar(245)
        {"tin8", 427},  // sysvar(246)
        {"tin9", 428},  // sysvar(247)
        {"tin10", 429},  // sysvar(248)
        {"pval", 839},  // sysvar(249)
        {"chlr", 920},  // sysvar(250)
        {"mkchlr", 921},  // sysvar(251)
        {"rmchlr", 922},  // sysvar(252)
        {"light", 923},  // sysvar(253)
        {"availability", 923},  // sysvar(254)
        {"sharechlr", 924},  // sysvar(255)
    };
    return t;
  }();
  return table;
}


// ---------------------------------------------------------------------------
// M7 (B6): las tablas indexadas por slot que las mutaciones sondean.
//
// - sysvar(0..999) (DNA.bas:25): el sondeo `Int(rndy * 1000)` de ChangeDNA2
//   re-tira hasta caer en un slot con nombre. La tabla del port guarda las
//   255 entradas en orden de indice original (sysvar(1)..sysvar(255)), asi
//   que el slot i se resuelve como entries[i-1]; fuera de 1..255 no hay
//   nombre (los slots 256..999 del original quedaban vacios).
// - sysvarIN(0..255) / sysvarOUT(0..255) (DNA.bas:27-28): el vocabulario
//   informacional/funcional de las mutaciones (21-MEMORIA.md par. 8),
//   extraido mecanicamente de LoadSysVars sobre el commit 02b20d7 (las
//   entradas comentadas del fuente son huecos con Name = "").

struct IndexedSysvarTable {
  std::array<Var, 256> e{};  // Name vacio = hueco (como el original)
};

// sysvar(i) por slot original (ver nota arriba).
inline const Var* SysvarByIndex(const SysvarTable& t, int i) {
  if (i < 1 || i > static_cast<int>(t.entries.size())) return nullptr;
  return &t.entries[static_cast<std::size_t>(i - 1)];
}

// sysvarIN(0..255) de DNA.bas:27-28, poblada en LoadSysVars
// (DNATokenizing.bas): 164 entradas activas; los huecos son las
// lineas comentadas del fuente (Name = "").
inline const IndexedSysvarTable& DefaultSysvarIN() {
  static const IndexedSysvarTable table = [] {
    IndexedSysvarTable t{};
    t.e[11] = {"robage", 9};
    t.e[12] = {"mass", 10};
    t.e[13] = {"maxvel", 11};
    t.e[14] = {"timer", 12};
    t.e[15] = {"aim", 18};
    t.e[17] = {"bodgain", 194};
    t.e[18] = {"bodloss", 195};
    t.e[19] = {"velscalar", 196};
    t.e[20] = {"velsx", 197};
    t.e[21] = {"veldx", 198};
    t.e[22] = {"veldn", 199};
    t.e[23] = {"velup", 200};
    t.e[24] = {"vel", 200};
    t.e[25] = {"hit", 201};
    t.e[26] = {"shflav", 202};
    t.e[27] = {"pain", 203};
    t.e[28] = {"pleas", 204};
    t.e[29] = {"hitup", 205};
    t.e[30] = {"hitdn", 206};
    t.e[31] = {"hitdx", 207};
    t.e[32] = {"hitsx", 208};
    t.e[33] = {"shang", 209};
    t.e[34] = {"shup", 210};
    t.e[35] = {"shdn", 211};
    t.e[36] = {"shdx", 212};
    t.e[37] = {"shsx", 213};
    t.e[38] = {"edge", 214};
    t.e[39] = {"fixed", 215};
    t.e[41] = {"depth", 217};
    t.e[42] = {"ypos", 217};
    t.e[43] = {"daytime", 218};
    t.e[44] = {"xpos", 219};
    t.e[45] = {"kills", 220};
    t.e[50] = {"nrg", 310};
    t.e[51] = {"body", 311};
    t.e[55] = {"rdboy", 315};
    t.e[59] = {"dnalen", 336};
    t.e[60] = {"vtimer", 337};
    t.e[62] = {"genes", 339};
    t.e[64] = {"thisgene", 341};
    t.e[65] = {"sun", 400};
    t.e[66] = {"trefbody", 437};
    t.e[67] = {"trefxpos", 438};
    t.e[68] = {"trefypos", 439};
    t.e[69] = {"trefvelmysx", 440};
    t.e[70] = {"trefvelmydx", 441};
    t.e[71] = {"trefvelmydn", 442};
    t.e[72] = {"trefvelmyup", 443};
    t.e[73] = {"trefvelscalar", 444};
    t.e[74] = {"trefvelyoursx", 445};
    t.e[75] = {"trefvelyourdx", 446};
    t.e[76] = {"trefvelyourdn", 447};
    t.e[77] = {"trefvelyourup", 448};
    t.e[78] = {"trefshell", 449};
    t.e[79] = {"tieang", 450};
    t.e[80] = {"tielen", 451};
    t.e[83] = {"tiepres", 454};
    t.e[85] = {"trefup", 456};
    t.e[86] = {"trefdn", 457};
    t.e[87] = {"trefsx", 458};
    t.e[88] = {"trefdx", 459};
    t.e[89] = {"trefaimdx", 460};
    t.e[90] = {"trefaimsx", 461};
    t.e[91] = {"trefshoot", 462};
    t.e[92] = {"trefeye", 463};
    t.e[93] = {"trefnrg", 464};
    t.e[94] = {"trefage", 465};
    t.e[95] = {"numties", 466};
    t.e[99] = {"multi", 470};
    t.e[101] = {"fertilized", 303};
    t.e[102] = {"memval", 473};
    t.e[104] = {"tmemval", 475};
    t.e[106] = {"reffixed", 477};
    t.e[107] = {"treffixed", 478};
    t.e[108] = {"trefaim", 479};
    t.e[109] = {"tieang1", 480};
    t.e[110] = {"tieang2", 481};
    t.e[111] = {"tieang3", 482};
    t.e[112] = {"tieang4", 483};
    t.e[113] = {"tielen1", 484};
    t.e[114] = {"tielen2", 485};
    t.e[115] = {"tielen3", 486};
    t.e[116] = {"tielen4", 487};
    t.e[117] = {"eye1", 501};
    t.e[118] = {"eye2", 502};
    t.e[119] = {"eye3", 503};
    t.e[120] = {"eye4", 504};
    t.e[121] = {"eye5", 505};
    t.e[122] = {"eye6", 506};
    t.e[123] = {"eye7", 507};
    t.e[124] = {"eye8", 508};
    t.e[125] = {"eye9", 509};
    t.e[126] = {"refmulti", 686};
    t.e[127] = {"refshell", 687};
    t.e[128] = {"refbody", 688};
    t.e[129] = {"refxpos", 689};
    t.e[130] = {"refypos", 690};
    t.e[131] = {"refvelscalar", 695};
    t.e[132] = {"refvelsx", 696};
    t.e[133] = {"refveldx", 697};
    t.e[134] = {"refveldn", 698};
    t.e[135] = {"refvel", 699};
    t.e[136] = {"refvelup", 699};
    t.e[137] = {"refup", 701};
    t.e[138] = {"refdn", 702};
    t.e[139] = {"refsx", 703};
    t.e[140] = {"refdx", 704};
    t.e[141] = {"refaimdx", 705};
    t.e[142] = {"refaimsx", 706};
    t.e[143] = {"refshoot", 707};
    t.e[144] = {"refeye", 708};
    t.e[145] = {"refnrg", 709};
    t.e[146] = {"refage", 710};
    t.e[147] = {"refaim", 711};
    t.e[148] = {"reftie", 712};
    t.e[149] = {"refpoison", 713};
    t.e[150] = {"refvenom", 714};
    t.e[151] = {"refkills", 715};
    t.e[152] = {"myup", 721};
    t.e[153] = {"mydn", 722};
    t.e[154] = {"mysx", 723};
    t.e[155] = {"mydx", 724};
    t.e[156] = {"myaimdx", 725};
    t.e[157] = {"myaimsx", 726};
    t.e[158] = {"myshoot", 727};
    t.e[159] = {"myeye", 728};
    t.e[160] = {"myties", 729};
    t.e[161] = {"mypoison", 730};
    t.e[162] = {"myvenom", 731};
    t.e[173] = {"in1", 810};
    t.e[174] = {"in2", 811};
    t.e[175] = {"in3", 812};
    t.e[176] = {"in4", 813};
    t.e[177] = {"in5", 814};
    t.e[178] = {"in6", 815};
    t.e[179] = {"in7", 816};
    t.e[180] = {"in8", 817};
    t.e[181] = {"in9", 818};
    t.e[182] = {"in10", 819};
    t.e[184] = {"slime", 821};
    t.e[186] = {"shell", 823};
    t.e[189] = {"venom", 825};
    t.e[192] = {"poison", 827};
    t.e[193] = {"waste", 828};
    t.e[194] = {"pwaste", 829};
    t.e[202] = {"paralyzed", 837};
    t.e[203] = {"poisoned", 838};
    t.e[206] = {"eyef", 510};
    t.e[226] = {"reftype", 685};
    t.e[227] = {"totalbots", 401};
    t.e[228] = {"totalmyspecies", 402};
    t.e[239] = {"tin1", 420};
    t.e[240] = {"tin2", 421};
    t.e[241] = {"tin3", 422};
    t.e[242] = {"tin4", 423};
    t.e[243] = {"tin5", 424};
    t.e[244] = {"tin6", 425};
    t.e[245] = {"tin7", 426};
    t.e[246] = {"tin8", 427};
    t.e[247] = {"tin9", 428};
    t.e[248] = {"tin10", 429};
    t.e[250] = {"chlr", 920};
    t.e[253] = {"light", 923};
    t.e[254] = {"availability", 923};
    return t;
  }();
  return table;
}

// sysvarOUT(0..255) de DNA.bas:27-28, poblada en LoadSysVars
// (DNATokenizing.bas): 98 entradas activas; los huecos son las
// lineas comentadas del fuente (Name = "").
inline const IndexedSysvarTable& DefaultSysvarOUT() {
  static const IndexedSysvarTable table = [] {
    IndexedSysvarTable t{};
    t.e[1] = {"up", 1};
    t.e[2] = {"dn", 2};
    t.e[3] = {"sx", 3};
    t.e[4] = {"dx", 4};
    t.e[5] = {"aimdx", 5};
    t.e[6] = {"aimright", 5};
    t.e[7] = {"aimsx", 6};
    t.e[8] = {"aimleft", 6};
    t.e[9] = {"shoot", 7};
    t.e[10] = {"shootval", 8};
    t.e[16] = {"setaim", 19};
    t.e[40] = {"fixpos", 216};
    t.e[47] = {"repro", 300};
    t.e[48] = {"mrepro", 301};
    t.e[49] = {"sexrepro", 302};
    t.e[52] = {"fdbody", 312};
    t.e[53] = {"strbody", 313};
    t.e[54] = {"setboy", 314};
    t.e[56] = {"tie", 330};
    t.e[57] = {"stifftie", 331};
    t.e[58] = {"mkvirus", 335};
    t.e[61] = {"vshoot", 338};
    t.e[63] = {"delgene", 340};
    t.e[81] = {"tieloc", 452};
    t.e[82] = {"tieval", 453};
    t.e[84] = {"tienum", 455};
    t.e[96] = {"deltie", 467};
    t.e[97] = {"fixang", 468};
    t.e[98] = {"fixlen", 469};
    t.e[100] = {"readtie", 471};
    t.e[103] = {"memloc", 474};
    t.e[105] = {"tmemloc", 476};
    t.e[109] = {"tieang1", 480};
    t.e[110] = {"tieang2", 481};
    t.e[111] = {"tieang3", 482};
    t.e[112] = {"tieang4", 483};
    t.e[113] = {"tielen1", 484};
    t.e[114] = {"tielen2", 485};
    t.e[115] = {"tielen3", 486};
    t.e[116] = {"tielen4", 487};
    t.e[163] = {"out1", 800};
    t.e[164] = {"out2", 801};
    t.e[165] = {"out3", 802};
    t.e[166] = {"out4", 803};
    t.e[167] = {"out5", 804};
    t.e[168] = {"out6", 805};
    t.e[169] = {"out7", 806};
    t.e[170] = {"out8", 807};
    t.e[171] = {"out9", 808};
    t.e[172] = {"out10", 809};
    t.e[183] = {"mkslime", 820};
    t.e[185] = {"mkshell", 822};
    t.e[187] = {"strvenom", 824};
    t.e[188] = {"mkvenom", 824};
    t.e[190] = {"strpoison", 826};
    t.e[191] = {"mkpoison", 826};
    t.e[195] = {"sharenrg", 830};
    t.e[196] = {"sharewaste", 831};
    t.e[197] = {"shareshell", 832};
    t.e[198] = {"shareslime", 833};
    t.e[199] = {"ploc", 834};
    t.e[200] = {"vloc", 835};
    t.e[201] = {"venval", 836};
    t.e[204] = {"backshot", 900};
    t.e[205] = {"aimshoot", 901};
    t.e[207] = {"focuseye", 511};
    t.e[208] = {"eye1dir", 521};
    t.e[209] = {"eye2dir", 522};
    t.e[210] = {"eye3dir", 523};
    t.e[211] = {"eye4dir", 524};
    t.e[212] = {"eye5dir", 525};
    t.e[213] = {"eye6dir", 526};
    t.e[214] = {"eye7dir", 527};
    t.e[215] = {"eye8dir", 528};
    t.e[216] = {"eye9dir", 529};
    t.e[217] = {"eye1width", 531};
    t.e[218] = {"eye2width", 532};
    t.e[219] = {"eye3width", 533};
    t.e[220] = {"eye4width", 534};
    t.e[221] = {"eye5width", 535};
    t.e[222] = {"eye6width", 536};
    t.e[223] = {"eye7width", 537};
    t.e[224] = {"eye8width", 538};
    t.e[225] = {"eye9width", 539};
    t.e[229] = {"tout1", 410};
    t.e[230] = {"tout2", 411};
    t.e[231] = {"tout3", 412};
    t.e[232] = {"tout4", 413};
    t.e[233] = {"tout5", 414};
    t.e[234] = {"tout6", 415};
    t.e[235] = {"tout7", 416};
    t.e[236] = {"tout8", 417};
    t.e[237] = {"tout9", 418};
    t.e[238] = {"tout10", 419};
    t.e[249] = {"pval", 839};
    t.e[251] = {"mkchlr", 921};
    t.e[252] = {"rmchlr", 922};
    t.e[255] = {"sharechlr", 924};
    return t;
  }();
  return table;
}

}  // namespace db
