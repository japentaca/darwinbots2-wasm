---
titulo: El ciclo y el orden de las acciones
resumen: "Qué hace el mundo en cada ciclo, en qué orden, por qué los sentidos llegan con un ciclo de atraso y cómo influyen el número de cada bot, los costos dinámicos y la oscilación de las mutaciones."
etiquetas: [ciclo, fases, orden, sentidos, costos dinámicos, mutaciones]
estado: revisada
---
La simulación avanza a pasos discretos: los _ciclos_. En cada uno, el mundo hace siempre lo mismo y en el mismo orden: deja pensar a todos los bots, mueve los disparos, calcula fuerzas, mueve a todos, resuelve lo que cada uno pidió, hace nacer y morir a los que corresponde y reparte la luz del sol. Entender ese orden es la mitad de programar un bot: explica por qué lo que ves siempre llega un poco tarde y por qué lo que pedís pasa enseguida.

## Las ocho fases {#fases}
<!-- 10-CICLO §2 (pasos 10, 12, 14, 16, 19-21), §5 (pasadas P1-P6) -->

Un ciclo, de punta a punta:

```
  el ADN ──► se borran ──► los ──► fuerzas ──► movimiento ──► acciones ──► nacimientos ──► el sol
             los sentidos  disparos y choques                              y muertes
  (piensa)  └──────────────────────── el mundo responde ─────────────────────────────────────┘
```

| Fase | Qué pasa |
|---|---|
| **El ADN** | Cada bot vivo ejecuta su ADN entero, de arriba abajo. Lee sus sentidos y escribe sus órdenes en la memoria. Los cadáveres no piensan. |
| **Se borran los sentidos** | Se ponen en 0 el contacto, los sabores de disparo y los datos del bot que tenías enfrente: lo que ya leíste no queda para el ciclo siguiente. Los ojos no se borran acá. |
| **Los disparos** | Los disparos que ya estaban en vuelo chocan con quien tengan delante y avanzan. Un golpe escribe en la memoria del bot golpeado (su sabor, o el valor que traía el disparo). |
| **Fuerzas y choques** | Se cobra el mantenimiento (cuerpo, largo del ADN, edad), se suman las fuerzas (fricción, gravedad, lazos, y el empuje que pediste con [[.up]] y compañía) y se resuelven los choques entre bots, que escriben los sentidos de contacto. Los lazos se pasan mensajes. |
| **Movimiento** | Los lazos comparten energía y materia, el bot gira lo que pidió y todas las fuerzas acumuladas se aplican de una vez: cambia la velocidad y la posición. Se publican [[.vel]] y la masa. |
| **Acciones** | Cada bot hace lo que dejó pedido: muta si le toca, fabrica sus defensas (caparazón, baba, veneno, toxina), dispara, maneja cloroplastos y cuerpo, pide reproducirse. Después **mira**: los ojos barren el mundo con las posiciones ya movidas. Al final envejece y, si se quedó sin energía, se vuelve cadáver o queda anotado para morir. |
| **Nacimientos y muertes** | Nacen todos los hijos pedidos y después mueren todos los anotados. |
| **El sol** | Se cuentan los cloroplastos del mundo, se siembran vegetales nuevos si hacen falta y la luz alimenta a los que hacen fotosíntesis. |

Los detalles de cada fase están en su página: [[simulacion/disparos]], [[simulacion/fisica]], [[simulacion/vision]], [[simulacion/reproduccion]], [[simulacion/muerte]] y [[simulacion/cloroplastos]]. Las fichas de las sysvars usan estos mismos nombres de fase para decir quién escribe y quién borra cada posición.

## Por qué ves tarde y actuás enseguida {#atraso}
<!-- 10-CICLO «Flujo de datos de los sentidos entre ciclos»; 21-MEMORIA §0.3 -->

El ADN corre **primero** y el mundo responde **después**. Eso tiene dos caras.

**Los sentidos llegan con un ciclo de atraso.** El contacto se escribe en fuerzas y choques; los ojos, en acciones; los sabores, en los disparos. Todo eso pasa _después_ del ADN, así que tu ADN del ciclo _N_ lee lo que el mundo escribió durante el ciclo _N−1_. Cuando un bot ve a otro en [[.eye5]], lo está viendo donde estaba al final del ciclo anterior. La tabla de [[adn/ejecucion#retraso]] lo muestra con [[.vel]]: la velocidad que anota el ADN va siempre un paso atrás de la real.

**Las órdenes se cumplen en el mismo ciclo.** Lo que escribís en [[.up]], [[.shoot]] o [[.repro]] queda en la memoria en el acto, y las fases que vienen detrás lo leen en ese mismo ciclo. Además, casi todas las órdenes se _consumen_: la fase que las ejecuta las vuelve a 0. Este bot lee sus propias órdenes antes de darlas:

```adn
' Lee sus propias órdenes antes de darlas
cond
start
  *.up 50 store
  *.shoot 51 store
  10 .up store
  -1 .shoot store
stop
end
```

Ciclo tras ciclo, 50 y 51 quedan en 0, aunque el bot empuja y dispara siempre: el empuje se aplicó (y [[.up]] se borró) en movimiento, y el disparo salió (y [[.shoot]] se borró) en acciones, los dos antes de que el ADN volviera a correr. Si querés repetir una orden, tenés que volver a darla en cada ciclo. Los grupos [[sysvars/movimiento]] y [[sysvars/disparos]] dicen, sysvar por sysvar, quién la borra y cuándo.

Juntando las dos caras: un bot que empuja en el ciclo _N_ ya se movió al terminar ese ciclo, pero su ADN se entera recién en el _N+1_.

### Dos demoras más {#demoras}
<!-- 10-CICLO §4 (shots quietos hasta el updateshots siguiente), §3 y §6 (recién nacidos) -->

- **Un disparo nuevo espera un ciclo.** El disparo nace en la fase de acciones, pero la fase de los disparos de ese ciclo ya pasó: no se mueve ni golpea hasta el ciclo siguiente. Por eso el orden entre los tiradores de un mismo ciclo no importa.
- **Un hijo piensa recién al ciclo siguiente.** Nace en nacimientos y muertes, cuando el ADN de ese ciclo ya corrió. Su primer ADN corre en el ciclo siguiente, con [[.robage]] en 0.

Este bot cuenta sus ciclos en la posición 50 y pide un hijo cuando llega a 3:

```adn
' Cuenta sus ciclos de ADN y pide un hijo en el tercero
cond
start
  *50 1 add 50 store
stop

cond
  *50 3 =
start
  50 .repro store
stop
end
```

| Al terminar el ciclo | Padre: 50 | Hijo: 50 | Hijo: `.robage` |
|---|---|---|---|
| 3 | 3 | 0 (acaba de nacer) | 0 |
| 4 | 4 | 1 | 1 |
| 5 | 5 | 2 | 2 |

El hijo nace en el ciclo 3 pero no corre su ADN hasta el 4. Por eso tantos bots del Bestiario abren con un gen `*.robage 0 =`: es el gen que corre una sola vez, en el primer ciclo de vida. El 4-d_Swarmer, por ejemplo, lo usa para orientar sus ojos con [[.eye1dir]] y compañía.

## El orden entre bots {#orden-entre-bots}
<!-- 10-CICLO §0 (efectos de orden 1-5 y lo que no depende del orden), §6 (posto) -->

Cada bot ocupa un _lugar_ numerado en el mundo, y dentro de cada fase el motor los recorre en orden, del lugar 1 en adelante, cambiando el estado en el momento. Cada fase termina con todos los bots antes de que empiece la siguiente: el número importa _dentro_ de una fase, no entre fases.

Para tu ADN eso casi no se nota, porque mientras piensa un bot solo toca su propia memoria y su energía. Lo que sí depende del orden:

| Qué | Cómo influye el número |
|---|---|
| Números al azar | Hay un solo generador para todo el mundo. Lo que te devuelve [[op:rnd]] depende de cuántos números se sacaron antes que vos, en tu ADN o en el de otros, y cualquier nacimiento o muerte corre esa cuenta. |
| Choques | Cada par de bots se resuelve una vez, cuando el motor pasa por el de número menor, y empuja a los dos en el acto. El de número mayor recibe el empujón antes de calcular sus propias fuerzas. |
| Lazos | Los mensajes por lazo se escriben directo en la memoria del otro bot ([[simulacion/lazos]]). En una cadena de bots atados, que un valor avance un eslabón o varios en el mismo ciclo depende de los números de cada uno. |
| Visión | Cuando miran, todos ya están en su posición final; pero los de número menor ya hicieron sus acciones del ciclo (dispararon, cambiaron de caparazón o de cuerpo) y los de número mayor todavía no. |
| Nacimientos | Los hijos se crean en el orden de sus padres y cada uno toma el lugar libre más bajo. Los padres de número bajo consiguen lugares bajos para sus hijos. |

## Nacimientos y muertes: primero nacen {#nacimientos-y-muertes}
<!-- 10-CICLO §6 (ReproduceAndKill: primero rep, después kil; muertes inmediatas P2/P4); port/README A1-5, A1-7 -->

Durante las acciones los bots solo _piden_: reproducirse o morir quedan anotados en dos listas. En la fase de nacimientos y muertes se procesa primero toda la lista de nacimientos y después toda la de muertes. De ahí salen dos reglas:

- **Un bot que muere en este ciclo todavía puede tener a su hijo.** Si en el mismo ciclo pidió reproducirse y se quedó sin energía, el hijo nace y después el padre muere.
- **Un hijo nunca ocupa el lugar de quien muere en el mismo ciclo**: las muertes van después.

No todas las muertes esperan a esta fase: un cadáver que se quedó sin cuerpo desaparece apenas termina fuerzas y choques, antes del movimiento ([[simulacion/muerte]]).

:::nota
En el DarwinBots original un bot podía quedar anotado dos veces en el mismo ciclo, una para reproducirse solo y otra con pareja. En el port se anota una sola vez: si procede la reproducción sexual, la asexual espera.
:::

## Dónde se paga la energía {#energia}
<!-- 31-ENERGIA §0.2 y §1 (libro mayor por fase) -->

Los gastos también tienen su fase: las instrucciones se cobran mientras corre el
ADN, el mantenimiento y el empuje en fuerzas y choques, el giro en movimiento, las
defensas y los disparos en acciones, la copia del ADN en nacimientos y muertes, y
la fotosíntesis entra con el sol. Entre una fase y otra la energía puede quedar
negativa; recién en las acciones se decide si el bot se quedó sin ella. La tabla
completa está en [[simulacion/energia#por-fase]], y todos los precios se
multiplican por el [[param:cost:54]].

## Costos dinámicos: el precio sigue a la población {#costos-dinamicos}
<!-- 10-CICLO §2 pasos 6-7; core master.hpp DynamicCostsStep (cero-costes fuera del gate) -->

Antes de que corra el ADN, el motor puede ajustar el [[param:cost:54]] para llevar la población hacia un objetivo. Se enciende con [[param:cost:56]] y se configura en [[app/parametros-costos-dinamicos]].

La población que cuenta son los bots que no son vegetales (con [[param:cost:61]], también los vegetales), según la última cuenta del motor. En cada ciclo:

- Si la población está por encima de la [[param:cost:53]] más su [[param:cost:57]] y además creció respecto de la de unos cien ciclos atrás, el multiplicador **sube**: la vida se encarece.
- Si está por debajo del objetivo menos su [[param:cost:58]] y además bajó, el multiplicador **baja**.
- Si la población lleva diez ciclos clavada en el mismo valor de hace cien, se ajusta igual, aunque no crezca ni baje.
- Dentro de la banda, nada cambia.

Cada ajuste es pequeño: 0,0000001 × (bots fuera de la banda) × [[param:cost:55]]. Con el objetivo en 100, márgenes en 0, sensibilidad 50 y 200 bots, el multiplicador sube 0,0005 por ciclo: medio punto cada mil ciclos. Es un termostato lento, pensado para corridas largas. El multiplicador no baja de 0 salvo que actives [[param:cost:62]].

Aparte hay un freno de emergencia que funciona aunque el ajuste esté apagado: si la población cae por debajo de [[param:cost:52]], el multiplicador pasa a 0 (nada cuesta) hasta que la población supere [[param:cost:59]], y entonces vuelve el valor que tenía. Con −1 en el primero, el freno no actúa nunca.

Como el ajuste se hace al principio del ciclo, el ADN de ese mismo ciclo ya paga con el precio nuevo. Un bot no tiene forma directa de leer el multiplicador: lo nota en lo rápido que baja su [[.nrg]].

## La oscilación de las mutaciones {#oscilacion}
<!-- 10-CICLO §2 paso 4; 40-MUTACIONES (rate/MutCurrMult); core master.hpp paso 4, sim.hpp MutOscill=false -->

También al principio del ciclo, el motor puede hacer subir y bajar las tasas de mutación de todos los bots a la vez, alternando épocas de mucho cambio con épocas de calma. La oscilación tiene dos tramos que se repiten: uno de _subida_ de cierta cantidad de ciclos y uno de _bajada_ de otra.

- **En escalón**: durante el tramo de subida las mutaciones son 16 veces más probables de lo que dice cada tasa; durante el de bajada, 16 veces menos.
- **En onda**: el factor sube de 1 a 20 y vuelve a 1 a lo largo del tramo de subida, y baja de 1 a 1/20 y vuelve a 1 a lo largo del de bajada.

Las tasas heredables de cada bot no cambian: el factor se aplica encima, al momento de sortear cada mutación ([[simulacion/mutaciones]]).

La oscilación viene apagada y la app no tiene un control para encenderla: solo actúa si cargás una simulación guardada que la traiga encendida.

## Al cerrar el ciclo {#cierre}
<!-- 10-CICLO §2 pasos 18-21 y 24, §8; port/README A1-3 -->

Hay dos cosas más que no son fases del bot. Entre nacimientos y muertes y el sol se mueven las formas y los teleporters ([[simulacion/mundo]]). Y después del sol queda una regla de seguridad: si la suma de los largos de todos los genomas del mundo pasa de 4 millones de instrucciones, el motor elimina de una vez una tanda de los bots más pobres (los de menos energía más diez veces su cuerpo), tanto más grande cuanto más bots hay. Solo pasa con poblaciones enormes de genomas muy largos, pero es una presión real contra los bots débiles en corridas de evolución largas.
