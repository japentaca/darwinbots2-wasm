---
titulo: Glosario
resumen: "Los términos del manual en orden alfabético, cada uno con una definición corta y el enlace a la página que lo explica."
etiquetas: [glosario, términos, vocabulario, referencia]
estado: revisada
---
Las palabras que usa este manual, con la página donde se explican. Las
direcciones de memoria con nombre (como [[.nrg]] o [[.shoot]]) tienen cada una
su ficha en la [[sysvars/todas|referencia de sysvars]], y las palabras del ADN
(como [[op:store]] o [[op:add]]), en la [[operadores/todos|referencia de
operadores]].

<!-- Términos tomados de los capítulos 3-6 (simulacion/*, adn/*, sysvars, operadores) y de los textos de la app (i18n/es). Toxina = poison, veneno = venom, caparazón = shell, baba = slime (PLAN-SITIO.md). Revisor: cada definición se contrastó con la sección de los capítulos 3-6 que enlaza (defensas, energia#shock, muerte#cadaveres, mundo#obstaculos, lazos#multicelulares, especies#linaje, adn/memoria#memoria-genetica, sysvars/my); Bestiario: web/bots/bots.json, 684 entradas. -->

## A

**ADN.** El programa de un bot: una lista de palabras (números, sysvars y
operadores) organizada en genes, que el bot ejecuta entera en cada ciclo. Se
guarda como un archivo de texto. Ver [[adn/estructura]].

**Animal.** En la app, todo bot que no es vegetal: si no fabrica sus propios
cloroplastos, tiene que sacarle la energía a otro. Ver [[simulacion/cloroplastos#vegetales]].

## B

**Baba** (_slime_). Defensa contra los lazos y los virus: hace difícil que
otro bot te ate y frena los disparos de virus. Se fabrica con [[.mkslime]].
Ver [[simulacion/defensas#baba]].

**Base.** El juego de valores del que parte un escenario: la _Clásica_ (sin
costos, campo de 32000 × 32000) o la _Liga F1_. Los cambios del escenario se
cuentan respecto de la base. Ver [[app/escenarios]].

**Bestiario.** La colección de 684 bots de la comunidad de DarwinBots, sacados
del foro y del wiki, que trae la app en su biblioteca. Ver [[app/bots]].

**Bordes.** Lo que pasa en el límite del campo: pueden ser paredes, o lados
conectados (lo que sale por uno entra por el otro). Ver
[[simulacion/mundo#bordes]].

**Bot.** Cada organismo de la simulación: un círculo con energía, cuerpo,
memoria propia y un ADN que decide qué hace. Ver [[empezar/que-es]].

## C

**Cadáver.** Lo que queda de un bot que murió sin energía, si los cadáveres
están activados: no piensa ni se mueve solo, pero conserva su cuerpo, que
otros pueden comer. Ver
[[simulacion/muerte#cadaveres]].

**Cambio en caliente.** Un cambio de parámetros que se aplica a la simulación
que está corriendo, sin empezar de nuevo. Queda anotado en la corrida como un
evento. Ver [[app/experimentar]].

**Caparazón** (_shell_). Defensa que absorbe parte de los disparos que roban
cuerpo y de los de veneno. Se fabrica con [[.mkshell]]. Ver
[[simulacion/defensas#caparazon]].

**Ciclo.** Un paso de la simulación. En cada uno corre el ADN de todos los
bots y el mundo responde, siempre en el mismo orden: el ADN, se borran los
sentidos, los disparos, fuerzas y choques, movimiento, acciones, nacimientos y
muertes, el sol. Ver [[simulacion/ciclo]].

**Cloroplasto.** Lo que le permite a un bot vivir de la luz. Hasta cierto
punto, cuantos más tiene, más energía recibe del sol, pero también pesan. Se compran con
[[.mkchlr]]. Ver [[simulacion/cloroplastos]].

**Condición.** Lo que va entre `cond` y `start` en un gen: comparaciones que
deciden si el gen se ejecuta. Ver [[adn/genes]] y [[adn/condiciones]].

**Corrida.** Una simulación con su historia: el escenario del que salió, su
semilla, los cambios en caliente y sus eventos. Se guarda en el navegador o se
descarga como `.dbsim`. Ver [[app/tus-datos]].

**Costos.** Lo que el mundo le cobra a un bot, en energía, por pensar, moverse,
disparar, tener cuerpo o un ADN largo. En la base _Clásica_ valen 0; en la
_Liga F1_, no. Ver [[simulacion/mundo#costos]] y [[adn/ejecucion#costos]].

**Cuerpo** (_body_). La reserva de un bot que no se gasta sola: lo hace más
grande y más pesado, y se puede convertir en energía y al revés. Ver
[[simulacion/energia#cuerpo]] y [[.body]].

## D

**def.** La forma de darle un nombre propio a un número en el ADN, por ejemplo
a una posición de memoria libre. Ver [[adn/def]].

**Desechos** (_waste_). Lo que se acumula al fabricar defensas y al comer.
Ver [[simulacion/energia#desechos]] y [[.waste]].

**Disparo.** Lo que un bot lanza escribiendo en [[.shoot]]: según el tipo,
saca energía o cuerpo a quien le pega, lleva veneno, desechos o un virus, o
escribe en su memoria. Ver [[simulacion/disparos]].

**Distancia genética.** Cuánto difiere el ADN de dos bots. La app puede
pintar el mundo según la distancia al bot seleccionado. Ver
[[simulacion/especies#distancia]].

## E

**Energía** (_nrg_). Lo que mantiene vivo a un bot: con ella paga todo, y
cuando se le acaba, muere. Ver [[simulacion/energia]] y [[.nrg]].

**Escenario.** Un mundo listo para correr: parámetros, especies a sembrar y
objetos (obstáculos, teleporters). La app trae siete de fábrica y podés
guardar los tuyos. Ver [[app/escenarios]].

**Especie.** Un grupo de bots con el mismo nombre: todos los que se sembraron
juntos y sus descendientes. Ver [[simulacion/especies#especie]].

## F

**Firma.** Once contadores que el motor saca del ADN de cada bot (cuántas
veces mueve, gira, dispara, mira…). Un bot lee los suyos y los del bot que
ve, y si coinciden, lo más probable es que sea de su especie. Ver [[sysvars/my]] y
[[sysvars/ref]].

**Fundador.** El bot sembrado del que desciende un linaje. La app compara el
ADN dominante de cada especie con el de su fundador. Ver
[[simulacion/especies#linaje]].

## G

**Gen.** Un bloque del ADN que empieza con `cond` o `start` y termina con
`stop`: si se cumplen sus condiciones, hace lo que dice su cuerpo. Ver
[[adn/genes]].

**Generación.** Cuántos nacimientos separan a un bot de su fundador: los
sembrados son la generación 0, sus hijos la 1, y así. Ver
[[simulacion/especies#linaje]].

## I

**Inspector.** El panel de Observar que muestra todo sobre el bot
seleccionado: recursos, sentidos, memoria, ADN y una consola. Ver
[[app/inspector]].

**Instrucción.** Cada palabra del ADN, ya leída por el motor: un número, una
lectura, una sysvar o un operador. También se les dice _tokens_. Ver
[[adn/estructura#tokens]].

## L

**Lazo** (_tie_). Una unión física entre dos bots, que sirve para sostenerse,
comunicarse y pasarse energía o cuerpo. Se crea con [[.tie]]. Ver
[[simulacion/lazos]].

**Linaje.** La cadena de padres e hijos que lleva de un bot a su fundador. La
pestaña Filogenia de Analizar la dibuja como un árbol. Ver
[[simulacion/especies#linaje]].

## M

**Memoria.** Las 1000 posiciones numeradas de cada bot. Algunas tienen nombre
y significado (las sysvars); las demás son libres para que el ADN guarde lo
que quiera. Ver [[adn/memoria]].

**Memoria genética.** Las posiciones 971 a 990, el único puente de memoria
entre un bot y sus hijos: al nacer, el hijo recibe las de su padre (las cinco
primeras al instante y las demás de a una por ciclo, mientras siga atado a él). Ver [[adn/memoria#memoria-genetica]].

**Multibot** (o multicelular). Un organismo de varios bots unidos por lazos
endurecidos, que comparten recursos y pagan menos por algunas cosas. Ver
[[simulacion/lazos#multicelulares]] y [[.multi]].

**Mutación.** Un cambio al azar en el ADN, al nacer o durante la vida. Es lo
que hace posible la evolución. Ver [[simulacion/mutaciones]].

## O

**Obstáculo.** Un rectángulo del campo que los bots no pueden atravesar y que
tapa la vista. Los laberintos son conjuntos de obstáculos. Ver
[[simulacion/mundo#obstaculos]].

**Ojo.** Cada uno de los nueve sentidos de visión de un bot, de [[.eye1]] a
[[.eye9]]: dicen qué tan cerca está lo que ven. Ver [[simulacion/vision]].

**Operador.** Una palabra del ADN que hace algo con las pilas: sumar,
comparar, escribir en la memoria. Ver [[adn/operadores]].

## P

**Parálisis.** El efecto del veneno: durante unos ciclos, el motor le escribe
al bot paralizado una orden elegida por quien le disparó. Ver
[[simulacion/defensas#veneno]] y [[.paralyzed]].

**Pila.** Donde el ADN deja los números con los que trabaja. Hay dos: la
entera, para números, y la booleana, para verdadero y falso. Ver
[[adn/pilas]].

## R

**Réplica.** Una de varias corridas del mismo escenario que se corren sin
dibujar para ver qué resultado se repite; cada una con una semilla propia
(la primera repite la semilla de la corrida de origen). Ver [[app/analizar]].

**Reproducción.** El nacimiento de un hijo: asexual con [[.repro]] (o
[[.mrepro]], con más mutaciones) y sexual con [[.sexrepro]]. Ver
[[simulacion/reproduccion]].

## S

**Semilla.** El número que fija el azar de una simulación: mismo escenario y
misma semilla dan la misma simulación. Ver [[tecnico/semillas]].

**Shock.** La muerte de un bot (que no sea vegetal) que pierde en un solo
ciclo más de la mitad de su energía y aun así le quedan más de 3000: lo que
le queda pasa al cuerpo y se vuelve cadáver. Ver [[simulacion/energia#shock]].

**Store.** Escribir un número en una posición de memoria. Así da sus órdenes
un bot: `10 .up store` escribe 10 en [[.up]]. Ver [[adn/stores]] y
[[op:store]].

**Sysvar.** Una posición de memoria con nombre y significado, como [[.up]]
(avanzar) o [[.nrg]] (la energía). Ver [[adn/numeros#sysvar]] y
[[sysvars/todas]].

## T

**Teleporter.** Un objeto del campo que lleva a los bots que entran en él a
otro lugar. Ver [[simulacion/mundo#teleporters]].

**Toroidal.** Un mundo cuyos bordes están conectados de los dos lados: lo que
sale por la derecha entra por la izquierda, y lo que sale por arriba entra por
abajo. Ver [[simulacion/mundo#bordes]].

**Toxina** (_poison_). Defensa pasiva: a quien te muerde le devuelve un
disparo de toxina que lo envenena. Se fabrica con [[.mkpoison]]. Ver
[[simulacion/defensas#toxina]].

## V

**Vegetal.** Un bot de una especie marcada como vegetal: vive de la luz,
nace con cloroplastos y la simulación lo repone cuando escasea. Ver
[[simulacion/cloroplastos#vegetales]].

**Veneno** (_venom_). Un arma: se dispara y paraliza a la víctima. Se
fabrica con [[.mkvenom]]. Ver [[simulacion/defensas#veneno]].

**Virus.** Un gen empaquetado en un disparo: el bot copia uno de sus genes y
lo dispara, y si pega en otro bot, el gen se inserta en su ADN. Se fabrica con [[.mkvirus]]. Ver [[simulacion/virus]].
