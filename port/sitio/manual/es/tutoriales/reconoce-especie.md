---
titulo: Un bot que reconoce a su especie
resumen: "La firma del ADN y una contraseña pública, paso a paso, para que tu bot reserve los disparos para los extraños."
etiquetas: [especie, reconocimiento, firma, contrasena, disparos]
estado: revisada
---
En [[tutoriales/busca-comida]] tu bot aprendió a moverse hacia la comida, y en
[[tutoriales/dispara]], a quitársela a otro a tiros. Este tutorial agrega la
pieza que falta para que muchas copias del mismo bot vivan juntas: saber a
quién tenés enfrente, y reservar las balas para los extraños.

## El disparo no elige {#problema}

<!-- 33-SHOTS §0.2-0.3 (el disparo le pega a cualquiera; inmunidad filial corregida en el port: port/README B3-1, solo del padre y age <= 1); sysvars .totalmyspecies (el ADN no lee el nombre de la especie) -->
El disparo no distingue especies: le pega a cualquier bot que se cruce. Un bot
nunca se pega con su propio disparo, y un recién nacido está protegido de los
disparos de su padre durante sus primeros ciclos; de nadie más. El ADN tampoco
puede leer el nombre de la especie: para el motor es un nombre que se hereda
(ver [[simulacion/especies]]), y no hay ninguna sysvar que lo traiga. Lo más
parecido es [[.totalmyspecies]], que cuenta cuántos bots vivos llevan tu
nombre: sirve para saber cuántos quedan, no quién tenés enfrente.

Sembrá cuatro copias de este cazador sin filtro — el del tutorial anterior,
reducido a lo esencial —, en un mundo chico y sin vegetales:

```adn
cond
 *.eye5 0 =
start
 314 rnd .aimdx store
stop

cond
 *.eye5 0 >
start
 -1 .shoot store
stop
```

<!-- probado: cazador.txt, --qty 4, campo 600x600, 60 ciclos, semilla 1: al 20 faltaba uno y al 30, otro; un superviviente cerró con kills=2 mientras el otro caía de 3000 a 2441 y el primero subía a 9175 -->
En la corrida, a los 20 ciclos ya faltaba uno, y a los 30, otro. Uno de los
supervivientes cerró con dos muertes de sus propios hermanos en [[.kills]]; al
otro lo estaban desangrando de a poco (de 3000 a 2441 de energía, mientras el
primero subía a 9175). Sin vegetales que repoblar, una especie así se come a
sí misma. (Este mismo bache, con su arreglo, está en [[adn/errores#especie]].)

## Las dos señales {#senales}

<!-- 32-VISION §2.6, §4 (lookoccurr desde la vista y desde los choques); sysvars/ref; sysvars/my (lo que ven los demás sale de la cuenta del motor, no de la celda); core senses.hpp makeoccurrlist (cuenta el texto del ADN, no lo que se ejecuta) -->
Todo lo que un bot sabe del que tiene adelante llega por la vista —y por los
choques—, y ninguna de esas cosas es un nombre. Cuando el ojo con foco ve
algo, las celdas [[sysvars/ref|ref*]] lo describen: dónde está, cómo se
mueve, cuánta energía y cuerpo tiene ([[simulacion/vision#foco]]). Entre esos
datos llega una _firma_ de su ADN: los mismos contadores que tenés en
[[sysvars/my|las my*]], pero del otro.

La firma no sale de lo que el otro hace, sino del texto de su ADN.
[[.refeye]], por ejemplo, dice cuántas veces lee sus ojos su ADN;
[[.refshoot]], cuántas veces ordena un disparo; [[.refup]], cuántas veces
empuja. Como se cuenta el texto, cuenta aunque ese código nunca se ejecute, y
no se puede falsear: escribir a mano las propias `my*` no cambia lo que ven
los demás. Dos bots con el mismo ADN tienen exactamente la misma firma.
La comparación más usada —viene de _Animal Minimalis_, de Numsgil, y la
llevan cientos de bots del Bestiario— es [[.refeye]] contra tu [[.myeye]].
<!-- Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (*.refeye *.myeye != antes de -1 .shoot); 340 de los 684 bots de port/web/bots mencionan refeye y myeye -->

La otra señal funciona al revés: no la deducís del otro, la publica él.
Escribís un número en [[.out1]] y queda ahí: el motor no lo borra nunca.
Cualquier bot que te tenga en el ojo con foco lo recibe en su [[.in1]], con
el atraso de un ciclo que tienen todos los sentidos. Es un canal público: el
555 de _Artemis Minimalis_, del Bestiario, es el ejemplo clásico.
<!-- 21-MEMORIA §2 (800-819: out1-10 / in1-10), §3 (in*: se borran en «se borran los sentidos»); Bestiario: Artemis_Minimalis.txt (555 .out1 store mientras *.robage 5 <; dispara con *.in1 *.out1 !=) -->

| Señal | Fortaleza | Debilidad |
|---|---|---|
| La firma (`ref*` contra `my*`) | No se puede copiar | Dos ADN distintos pueden contar igual |
| La contraseña (`in1` contra `out1`) | No coincide por casualidad | Cualquiera que te vea la lee |

Vamos con las dos, en orden, porque cada una tapa el hueco de la otra.

## Paso 1: la firma {#firma}

El cazador lee `*.eye5` dos veces, así que su [[.myeye]] vale 2: esa es su
firma. Agregale la comparación al gen que dispara:

```adn
' Disparar solo si la firma del otro no coincide con la mia
cond
 *.eye5 0 =
start
 314 rnd .aimdx store
stop

cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 -1 .shoot store
stop
```

Qué deberías ver:

1. **Contra un clon** (la misma especie, dos copias), ni un disparo. En la
   corrida quedaron pegados frente a frente —el ojo frontal marcaba más de
   20000— con `*.refeye` y `*.myeye` en 2, y la energía intacta en 3000
   durante 40 ciclos.
   <!-- probado: firmado.txt, --qty 2, campo 600x600, 40 ciclos, semilla 1: eye5 20736, refeye=2=myeye, nrg 3000 en ambos -->
2. **Contra un extraño** que lee sus ojos una sola vez, la firma no coincide
   (1 contra 2) y el cazador actúa como siempre: giró hasta verlo, le robó
   energía hasta matarlo antes del ciclo 25 y cerró en 6160, desde los 3000
   iniciales.
   <!-- probado: firmado.txt contra distinto.txt (myeye 1), campo 600x600, 40 ciclos, semilla 2: muerto entre el 20 y el 25; firmado en 6159.89 -->

## Paso 2: las trampas de la firma {#trampas}

La firma es una aproximación, y tiene tres baches:

- **Los cadáveres** llegan con toda la firma en 0: parecen un extraño mudo.
  Se los distingue porque su [[.refnrg]] también viene en 0, mientras su
  [[.refbody]] es el real (ver [[simulacion/muerte]]).
  <!-- 32-VISION §2 notas (corpse: occurr borrado, refnrg/refbody reales) -->
- **Las formas** del mundo, cuando son visibles, también dejan la firma en 0;
  [[.reftype]] en 1 es lo que avisa que lo que ves es una forma.
  <!-- sysvars.yaml .reftype; 32-VISION §3 -->
- **Las coincidencias**: dos ADN distintos pueden contar igual. El bache se
  puede construir a propósito: un bot pacífico que, sin disparar nunca,
  también lee sus ojos dos veces. La firma dijo «es de los míos» y en 40
  ciclos no salió un disparo.
  <!-- probado: firmado.txt contra gemelo.txt (myeye 2, myshoot 0), campo 600x600, 40 ciclos, semilla 2: 0 disparos, nrg 3000 en ambos -->

El arreglo es comparar más de una cifra y disparar si _alguna_ no coincide,
con [[op:or]] en la zona de condiciones:

```adn
' Disparar si alguna cifra de la firma no coincide
cond
 *.eye5 0 =
start
 314 rnd .aimdx store
stop

cond
 *.eye5 0 >
 *.refeye *.myeye !=
 *.refshoot *.myshoot != or
start
 -1 .shoot store
stop
```

El falso hermano de arriba escribe `.shoot` cero veces, así que su
[[.refshoot]] (0) ya no coincide con tu [[.myshoot]] (1): en la corrida quedó
muerto antes del ciclo 25, con el cazador cerrando en 6160.
<!-- probado: firmado2.txt contra gemelo.txt, campo 600x600, 40 ciclos, semilla 2: gemelo muerto entre el 20 y el 25; firmado2 en 6159.89 -->

Podés sumar una tercera cifra ([[.refup]], [[.reftie]]…): cada una
independiente hace más difícil la coincidencia casual.

## Paso 3: la contraseña {#contrasena}

La contraseña la publica cada bot por su cuenta. Alcanza con publicarla una
vez: como `.out1` nunca se borra y arranca en 0, «mientras valga 0» es «la
primera vez». Después, antes de disparar, comparás `*.in1` con tu propio
`*.out1`.

```adn
' Publicar el codigo de especie, una sola vez
cond
 *.out1 0 =
start
 555 .out1 store
stop

cond
 *.eye5 0 =
start
 314 rnd .aimdx store
stop

' Disparar al que no publica mi codigo
cond
 *.eye5 0 >
 *.in1 *.out1 !=
start
 -1 .shoot store
stop
```

Dos cuidados. Primero, `*.in1` vale 0 tanto si no estás viendo a nadie como
si el otro no publica nada: el `*.eye5 0 >` es el que avisa que hay alguien
enfrente. Segundo, elegí un código distinto de 0, que es lo que «publica»
cualquier bot que no usa el canal.

Qué deberías ver:

1. **Contra un extraño que no publica nada**, la contraseña funciona como
   una firma más: en la corrida lo cazó igual que antes y cerró en 6152.
   <!-- probado: clave.txt contra distinto.txt (no publica), campo 600x600, 40 ciclos, semilla 4: muerto entre el 30 y el 35; clave en 6152.46 -->
2. **Contra un espía**, la contraseña muestra su precio: un bot que se limita
   a copiar en su `.out1` lo que lee en `*.in1` publica tu código en cuanto te
   ve. En la corrida, el espía ya anunciaba 555 en el ciclo 5.
   <!-- probado: hermano.txt (publica 555) contra copion.txt (copia *.in1 a .out1), campo 600x600, 30 ciclos, semilla 3: copion con out1=555 en el ciclo 5 -->
3. **Y la consecuencia**: contra un intruso que publica tu código, un bot que
   solo mira contraseñas no dispara. El intruso pasó 40 ciclos a la vista,
   con la energía intacta.
   <!-- probado: clave.txt contra intruso.txt (publica 555, firma 1), campo 600x600, 40 ciclos, semilla 2: 0 disparos, nrg 3000 en ambos -->

Es un canal público: sirve para elegir a los tuyos, no para guardar un
secreto.

## Paso 4: el bot completo {#final}

Combinadas, cada señal tapa el hueco de la otra. Pero fijate _cómo_: hay que
disparar si _alguna_ no coincide, con [[op:or]]. Si exigieras que fallen las
dos, cada trampa seguiría abierta: al falso hermano lo salvaría la firma, al
intruso con el código robado lo salvaría la contraseña.

| Enfrente | Firma | Contraseña | Dispara |
|---|---|---|---|
| Un clon | coincide | coincide | no |
| Un extraño que cuenta igual | coincide | no | sí |
| Un intruso con el código robado | no | coincide | sí |

El bot completo —el esqueleto es el de _Animal Minimalis_, más la
contraseña— queda así:

```adn
' Publicar el codigo de especie, una sola vez
cond
 *.out1 0 =
start
 555 .out1 store
stop

' Algo adelante que no es de los mios: perseguirlo copiando su velocidad
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 *.refveldx .dx store
 *.refvelup 30 add .up store
stop

' Extraño cerca: firma o contrasena que no coincidan
cond
 *.eye5 50 >
 *.refeye *.myeye !=
 *.refshoot *.myshoot != or
 *.in1 *.out1 != or
start
 -1 .shoot store
stop

' Nada adelante, o alguien de los mios: girar buscando
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 314 rnd .aimdx store
stop

' Reproducirse cuando sobra energia (10 por ciento para el hijo)
cond
 *.nrg 20000 >
start
 10 .repro store
stop
```

Cada gen hace una cosa: publicar el código, perseguir a los extraños
copiando su velocidad, dispararles cuando están cerca, girar cuando no hay
nada —o lo que hay es un hermano—, y dividirse cuando sobra energía. El hijo
nace con el mismo ADN, o sea con la misma firma, y publica su 555 en su
primer ciclo; mientras tanto, los disparos de su padre no le pegan.
<!-- port/README B3-1; 36-REPRO (el hijo no hereda la memoria: publica él mismo); Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (mismos genes de persecución y giro) -->

Qué deberías ver:

1. **Contra sus clones**, ni un disparo. En la corrida, dos copias giraron
   cada una por su lado; en el ciclo 35 una tuvo a la otra de frente
   —`*.refeye` en 3, `*.in1` en 555— y siguió su camino, con la energía
   intacta.
   <!-- probado: final.txt, --qty 2, campo 600x600, 40 ciclos, semilla 3: en el ciclo 35, refeye=3=myeye e in1=555=out1; 0 disparos, nrg 3000 -->
2. **Contra el intruso de la contraseña robada**, la firma lo delató: lo
   persiguió, le fue sacando energía y quedó muerto antes del ciclo 35, con
   el bot final cerrando en 5958 desde los 3000 iniciales.
   <!-- probado: final.txt contra intruso.txt (publica 555, firma 1), campo 600x600, 40 ciclos, semilla 2: intruso muerto entre el 30 y el 35; final en 5957.88 -->
3. **Contra un extraño que cuenta igual** —tres lecturas de ojos y un
   disparo, como el tuyo, pero sin publicar código—, la contraseña lo delató:
   en cuanto lo vio, empezó a dispararle, y en 60 ciclos lo bajó de 3000 a
   2244 de energía.
   <!-- probado: final.txt contra gemelo3.txt (myeye 3, myshoot 1, sin out1), campo 600x600, 60 ciclos, semilla 2: primer avistamiento en el 15, primer daño hacia el 30; gemelo3 en 2244.04 al 60 -->

El bloque entero pasa el lint sin avisos. Cambiale el 555 por un número tuyo
(que no sea 0) y tiene que seguir andando igual.

## Qué probar después {#despues}

**El espía completo.** Las dos señales juntas todavía se pueden engañar: un
bot que copie tu contraseña y que además, por casualidad o por diseño, cuente
igual que vos engaña al bot completo. Conseguirlo por azar es difícil;
cuantas más señales independientes compares, más difícil el engaño.

**Parientes que mutaron.** Con las mutaciones encendidas
([[simulacion/mutaciones]]), cada mutación rehace la firma del bot: un
descendiente puede quedar con otra cuenta y empezar a recibir fuego amigo de
sus parientes. Una mutación también puede tocarle el 555 o el gen que lo
publica. Las dos señales derivan con la evolución; mirá
[[simulacion/especies#mutaciones]].
<!-- 40-MUTACIONES; port/README B6-9 (la firma se recalcula al mutar); sysvars/my #cuando -->

**Sin verse: por lazos.** Un bot atado a otro lo reconoce con [[.trefeye]]
en vez de `refeye`, y comparado con [[op:%=]] admite hasta un 10 % de
diferencia, útil si esperás parientes que mutaron poco. Para armar lazos, el
tutorial es [[tutoriales/multibot]].

**Contraseñas escondidas.** Con [[.memloc]] podés espiar cualquier celda del
bot que ves y guardar tu código en una variable privada, en vez de publicarlo
en `out1` (ver [[simulacion/vision#espionaje]]). Spoiler: un espía con
`.memloc` también la encuentra: la vista de DarwinBots no tiene secretos.
