// dbcore/memmap.hpp — constantes de direccion del motor (Robots.bas:8-163)
// mas las auxiliares usadas por Senses/Ties/Shots. Nombres y valores del
// fuente tal cual (incluidas las dos trampas de 21-MEMORIA.md §1: la const
// Fixed=216 corresponde al sysvar `fixpos` y tieport1=450 colisiona con
// TIEANG=450).
#pragma once

namespace db::addr {

// Robots.bas:8-43
inline constexpr int dirup = 1;
inline constexpr int dirdn = 2;
inline constexpr int dirdx = 3;   // ojo: la CONST dirdx es 3 y dirsx es 4
inline constexpr int dirsx = 4;   // (Robots.bas:10-11); el sysvar "sx" es 3
inline constexpr int aimdx = 5;
inline constexpr int aimsx = 6;
inline constexpr int shoot = 7;
inline constexpr int shootval = 8;
inline constexpr int robage = 9;
inline constexpr int masssys = 10;
inline constexpr int maxvelsys = 11;
inline constexpr int timersys = 12;
inline constexpr int AimSys = 18;
inline constexpr int SetAim = 19;
inline constexpr int bodgain = 194;
inline constexpr int bodloss = 195;
inline constexpr int velscalar = 196;
inline constexpr int velsx = 197;
inline constexpr int veldx = 198;
inline constexpr int veldn = 199;
inline constexpr int velup = 200;
inline constexpr int vel = 200;
inline constexpr int hit = 201;
inline constexpr int shflav = 202;
inline constexpr int pain = 203;
inline constexpr int pleas = 204;
inline constexpr int hitup = 205;
inline constexpr int hitdn = 206;
inline constexpr int hitdx = 207;
inline constexpr int hitsx = 208;
inline constexpr int shup = 210;
inline constexpr int shdn = 211;
inline constexpr int shdx = 212;
inline constexpr int shsx = 213;
inline constexpr int Fixed = 216;  // ¡el sysvar `fixpos`! (`fixed` es 215)
inline constexpr int Kills = 220;

// Robots.bas:44-62
inline constexpr int Repro = 300;
inline constexpr int mrepro = 301;
inline constexpr int SEXREPRO = 302;
inline constexpr int SYSFERTILIZED = 303;
inline constexpr int Energy = 310;
inline constexpr int body = 311;
inline constexpr int fdbody = 312;
inline constexpr int strbody = 313;
inline constexpr int setboy = 314;
inline constexpr int rdboy = 315;
inline constexpr int mtie = 330;
inline constexpr int stifftie = 331;
inline constexpr int mkvirus = 335;
inline constexpr int DnaLenSys = 336;
inline constexpr int Vtimer = 337;
inline constexpr int VshootSys = 338;
inline constexpr int GenesSys = 339;
inline constexpr int DelgeneSys = 340;
inline constexpr int thisgene = 341;

// Robots.bas:63-101
inline constexpr int LandM = 400;
inline constexpr int TotalBots = 401;
inline constexpr int TOTALMYSPECIES = 402;
inline constexpr int trefbody = 437;
inline constexpr int trefxpos = 438;
inline constexpr int trefypos = 439;
inline constexpr int trefvelmysx = 440;
inline constexpr int trefvelmydx = 441;
inline constexpr int trefvelmydn = 442;
inline constexpr int trefvelmyup = 443;
inline constexpr int trefvelscalar = 444;
inline constexpr int trefvelyoursx = 445;
inline constexpr int trefvelyourdx = 446;
inline constexpr int trefvelyourdn = 447;
inline constexpr int trefvelyourup = 448;
inline constexpr int trefshell = 449;
inline constexpr int tieport1 = 450;
inline constexpr int TIEANG = 450;  // colision de nombres del fuente
inline constexpr int TIELEN = 451;
inline constexpr int tieloc = 452;
inline constexpr int tieval = 453;
inline constexpr int TIEPRES = 454;
inline constexpr int TIENUM = 455;
inline constexpr int TREFUPSYS = 456;
inline constexpr int TREFDNSYS = 457;
inline constexpr int TREFSXSYS = 458;
inline constexpr int TREFDXSYS = 459;
inline constexpr int trefnrg = 464;
inline constexpr int numties = 466;
inline constexpr int DELTIE = 467;
inline constexpr int FIXANG = 468;
inline constexpr int FIXLEN = 469;
inline constexpr int multi = 470;
inline constexpr int readtiesys = 471;

// Robots.bas:102-135
inline constexpr int EYE1DIR = 521;    // Robots.bas:106 (eye1dir..eye9dir)
inline constexpr int EYE1WIDTH = 531;  // Robots.bas:115 (eye1width..eye9width)
inline constexpr int EyeStart = 500;
inline constexpr int EyeEnd = 510;
inline constexpr int EYEF = 510;
inline constexpr int FOCUSEYE = 511;
inline constexpr int REFTYPE = 685;
inline constexpr int refmulti = 686;
inline constexpr int refshell = 687;
inline constexpr int refbody = 688;
inline constexpr int refxpos = 689;
inline constexpr int refypos = 690;
inline constexpr int refvelscalar = 695;
inline constexpr int refvelsx = 696;
inline constexpr int refveldx = 697;
inline constexpr int refveldn = 698;
inline constexpr int refvelup = 699;
inline constexpr int occurrstart = 700;

// Robots.bas:136-163
inline constexpr int out1 = 800;   // out1..out10 = 800..809
inline constexpr int in1 = 810;    // in1..in10 = 810..819
inline constexpr int poison = 827;
inline constexpr int backshot = 900;
inline constexpr int aimshoot = 901;
inline constexpr int chlr = 920;
inline constexpr int mkchlr = 921;
inline constexpr int rmchlr = 922;
inline constexpr int light = 923;
inline constexpr int sharechlr = 924;

}  // namespace db::addr
