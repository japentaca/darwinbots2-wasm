---
titulo: "Parámetros: Energía y vegetales"
resumen: "Cuánta energía entra al mundo por el sol, cuántos vegetales hay y cómo se reponen, cómo se reparte lo que se come, las mutaciones y las mareas."
etiquetas: [energía, vegetales, repoblación, fotosíntesis, disparos, mareas]
estado: revisada
---
<!-- engine/opciones.js grupo 'energia' (base:maxEnergy … base:mutations, opt:60-64); CONTROLES_BASICOS luz, vegetales, repoblacion, mutaciones; 50-MUNDO §2; 31-ENERGIA; 33-SHOTS §5 -->

Este grupo regula la economía del mundo: cuánta comida entra y cómo pasa de
mano en mano. La energía solo entra por dos lados, el sol y la siembra de
vegetales nuevos (ver [[simulacion/energia#flujo|de dónde sale la energía]]), y casi todo lo de acá
toca uno de los dos. Los otros parámetros deciden cuánto rinde un disparo que
roba energía, cómo se reparte lo que produce un cloroplasto entre energía y
cuerpo, si los hijos mutan y si hay mareas.

Si querés un mundo más rico o más pobre, empezá por [[param:base:maxEnergy]]
y por los que deciden cuántos vegetales hay y cómo se reponen. En el modo básico de
Experimentar están como **Energía solar**, **Tope de vegetales**,
**Repoblación de vegetales** y **Mutaciones**. La mecánica completa del sol y
de los vegetales está en [[simulacion/cloroplastos]].

:::parametro base:maxEnergy
<!-- 50-MUNDO §2.2; core master.hpp feedvegs(sim, MaxEnergy), vegs.hpp tok = totnrg/3,5; comprobado: planta.txt (16000 cloroplastos, campo 32000²): +3,39 de energía y +1,02 de cuerpo por ciclo con 10; revisor: idem con 16000 .mkchlr, 63=0,75 -->
La base de la fotosíntesis: cada bot con cloroplastos gana en cada ciclo de
sol una cantidad proporcional a este valor (la fórmula está en
[[simulacion/cloroplastos#fotosintesis|la fotosíntesis]]). La app arranca con 10 y la base
**Liga F1** usa 40.

Con 10, un vegetal de 16000 cloroplastos, solo en un campo de 32000 × 32000,
gana unos 3,4 de energía y 1 de cuerpo por ciclo. Con 20 gana el doble; con 0
el sol no alimenta a nadie, y la única comida que entra es la de la
repoblación. En el modo estanque ([[param:opt:30]]) este valor no se usa: ahí
manda [[param:opt:31]].
:::

:::parametro base:minVegs
<!-- 50-MUNDO §2.1; core master.hpp paso 20 (TotalChlr < MinVegs → VegsRepopulate), TotalChlr = suma de chloroplasts / 16000 de todos los vivos -->
El umbral de la repoblación. Si los cloroplastos de todo el campo, contados en
unidades de 16000, quedan por debajo de este número, la simulación empieza a
sembrar vegetales nuevos. La app arranca con 15; la **Liga F1** usa 10. Con 0
no se repuebla nunca: si los vegetales se extinguen, no vuelven.

Cuenta cloroplastos y no bots: veinte vegetales de 4000 cloroplastos suman 5
unidades, y los animales que compraron cloroplastos también suman. Ver
[[simulacion/cloroplastos#repoblacion|la repoblación]].
:::

:::parametro base:maxPopulation
<!-- 31-ENERGIA §3; core robots.hpp ChangeChlr (TotalChlr > MaxPopulation y Veg), Reproduce (lotería RandomI(0,10) != 5 sobre el 90 %) -->
El tope de los vegetales, también en unidades de 16000 cloroplastos. Cuando
el total del campo lo pasa, los vegetales no pueden reproducirse ni comprar
cloroplastos; por encima del 90 % del tope, solo uno de cada once intentos de
reproducción sigue adelante. A los animales no los frena. La app arranca con
100; la **Liga F1** usa 25.

Ponelo por encima de [[param:base:minVegs]]: si queda por debajo, los
vegetales dejan de reproducirse antes de que la repoblación se detenga, y la
población la sostiene solo la siembra. Ver [[simulacion/cloroplastos#tope|el tope de vegetales]].
:::

:::parametro base:repopAmount
<!-- core master.hpp VegsRepopulate (for t = 1 To RepopAmount: aggiungirob) -->
Cuántos vegetales nacen en cada tanda de repoblación. Cada uno aparece en un
lugar al azar dentro de la zona de su especie, con 1000 de cuerpo, la energía
inicial de la especie y [[param:base:startChlr]] cloroplastos. La app arranca
con 10, igual que la **Liga F1**; con 0 la repoblación no siembra nada.
:::

:::parametro base:repopCooldown
<!-- core master.hpp VegsRepopulate: cooldown += 1 solo mientras TotalChlr < MinVegs; siembra al llegar a RepopCooldown y resta (no vuelve a 0); sim.hpp cooldown (B7-4) -->
Cuántos ciclos por debajo del umbral hacen falta para cada tanda. La espera
solo avanza en los ciclos en que los cloroplastos están por debajo de
[[param:base:minVegs]], y lo que se juntó no se pierde cuando la población se
recupera: sigue contando la próxima vez que baje. La app arranca con 10; la
**Liga F1** usa 25. Con 0 o 1 siembra una tanda en cada ciclo mientras falten
vegetales, lo que puede llenar el campo muy rápido.
:::

:::parametro base:startChlr
<!-- wasm dbcore_api db_sim_seed_species (fundadores vegetales) y core master.hpp aggiungirob (repoblados): chloroplasts = StartChlr; el core arranca en 0, la app manda 16000 -->
Los cloroplastos con los que nace cada vegetal sembrado, tanto los fundadores
de la simulación como los de la repoblación. Los hijos no: se llevan su parte
de los del padre ([[simulacion/reproduccion#reparto|cómo se reparten las cosas al nacer]]). La app arranca con
16000.

Más cloroplastos no siempre es mejor: con muchos, el vegetal pesa más, tapa más
luz y en un campo lleno puede rendir menos (la tabla está en
[[simulacion/cloroplastos#rinde|cuánto rinde un vegetal]]). Con 0 los vegetales nacen sin
cloroplastos y no comen hasta que su ADN los compre con [[.mkchlr]]. Cambiarlo
en vivo afecta solo a los que se siembren después.
:::

:::parametro base:mutations
<!-- 40-MUTACIONES §1 (DisableMutations global); wasm db_sim_set_mutations -->
El interruptor general de las mutaciones. Encendido (como arranca la app),
cada bot muta según su propia tabla de tasas, en vida y al nacer; apagado,
nadie muta y los hijos son copias exactas del padre (o la mezcla exacta de los
dos, en la reproducción sexual). La **Liga F1** lo apaga, para que compitan las
especies tal como fueron escritas. Qué tipos de mutación hay y cómo se leen las
tasas está en [[simulacion/mutaciones]].
:::

:::parametro opt:60
<!-- 33-SHOTS §5; core shots.hpp releasenrg/releasebod (EnergyExType: power = value·nrg/(Range·40)·EnergyProp; si no, EnergyFix); comprobado: tirador.txt contra nada.txt, −198 por golpe proporcional, −180 fijo -->
Cómo se calcula la fuerza de los disparos que roban: el de energía (−1) y el
de cuerpo (−6). Con **proporcional**, el valor de la app y de la **Liga F1**,
la fuerza depende del cuerpo del tirador, de su [[.shootval]] y de cuánto
viajó el disparo, multiplicada por [[param:opt:62]]. Con **fijo**, cada golpe
pega con [[param:opt:61]], sin importar nada de eso.

En una prueba con un tirador de 1000 de cuerpo y un blanco quieto, cada −1
le sacó al blanco 198 de energía con el intercambio proporcional y 180 con el
fijo de 200. Los detalles de cada tipo de disparo están en
[[simulacion/disparos#tipos|qué hace cada disparo]].
:::

:::parametro opt:61
<!-- core shots.hpp power = EnergyFix (Integer); comprobado: 61=500 → −450 de energía y −5 de cuerpo por golpe -->
La fuerza de cada disparo −1 o −6 cuando el intercambio ([[param:opt:60]]) es
fijo; con el proporcional no se usa. La app arranca con 200. Un −1 le saca a
la víctima el 90 % de este valor en energía y el 1 % en cuerpo, y le devuelve
al tirador un regalo con el valor entero: con 500, la víctima pierde 450 de
energía y 5 de cuerpo por golpe.

Como no depende del cuerpo del tirador, el intercambio fijo empareja a los
bots chicos con los grandes.
:::

:::parametro opt:62
<!-- core shots.hpp releasenrg/releasebod: × EnergyProp; comprobado: 62=2 → −396 por golpe (el doble de 198) -->
Un multiplicador de la fuerza de los disparos −1 y −6 cuando el intercambio
([[param:opt:60]]) es proporcional. Con 1, el valor de la app y de la **Liga
F1**, los disparos pegan como se cuenta en [[simulacion/disparos#tipos|qué hace cada disparo]]; con
2, el doble (en la prueba de arriba, 396 de energía por golpe en lugar de
198); con 0, los disparos que roban no sacan nada. Sube o baja de golpe la
ventaja de cazar sobre la de fotosintetizar.
:::

:::parametro opt:63
<!-- core vegs.hpp feedvegs (nrg += acttok·(1 − VFB); body += acttok·VFB/10) y feedveg2; comprobado con planta.txt: 0 → +13,6 de energía por ciclo; 1 → +1,36 de cuerpo por ciclo -->
Qué parte de lo que producen los cloroplastos va al cuerpo; el resto va a la
energía. Con 0,75, el valor de la app, un cuarto de la ganancia entra en
[[.nrg]] y tres cuartos en [[.body]], a razón de 10 de energía por 1 de
cuerpo. La **Liga F1** usa 0,5.

En la prueba del vegetal solo, con 0 ganaba 13,6 de energía por ciclo y nada
de cuerpo; con 1, ninguna energía y 1,36 de cuerpo. Un vegetal que solo engorda
no puede pagar sus acciones ni reproducirse, y uno que no engorda tampoco crece.
Vale igual para los desechos que digieren los cloroplastos (ver
[[simulacion/energia#desechos|los desechos]]).
:::

:::parametro opt:64
<!-- core robots.hpp mareas (BouyancyScaling = sqrt((1 + sin(2π·fase/Tides))/2); Ygravity = (1 − B)·4; PhysBrown = 10 si B > 0,8), vegs.hpp (acttok·(1 − B)); 50-MUNDO §2 -->
El período de las mareas, en ciclos; con 0 (el valor de la app) no hay
mareas. Con un valor positivo, el mundo oscila con ese período: en una parte
la gravedad hacia abajo sube hasta 4 y el sol alimenta a pleno; en la otra, la
gravedad cae a casi nada, el agua se agita con movimiento browniano y los
vegetales casi no comen.

Mientras haya mareas, el motor reescribe [[param:opt:20]] y [[param:opt:13]]
en cada ciclo, así que lo que pongas en ellos no se usa; y si las apagás,
quedan con el último valor que les dio la marea. Ver
[[simulacion/mundo#gravedad|gravedad, estanque y mareas]].
:::
