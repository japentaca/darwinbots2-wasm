---
titulo: Ejecución y costos
resumen: "Cuándo corre el ADN dentro del ciclo, en qué orden, qué ve de los sentidos y cuánta energía cobra cada instrucción."
etiquetas: [ejecución, costos, energía, ciclo, store]
estado: revisada
---
El ADN de un bot no es un programa que arranca una vez y queda corriendo: es una receta que el mundo vuelve a leer entera, de arriba abajo, en cada ciclo. Esta página cuenta en qué momento del ciclo pasa eso, qué ve el bot cuando lee sus sentidos, en qué orden corren los genes y cuánta energía le cuesta cada instrucción.

## El ADN corre al principio del ciclo {#cuando}
<!-- 10-CICLO §2 (pasos 1-9 antes; 10 ExecRobs; 12-16 después) y «Flujo de datos de los sentidos», §3 (cadáveres excluidos; recién nacidos corren en N+1) -->

Cada ciclo de la simulación (lo ves completo en [[simulacion/ciclo]]) empieza, después de unas cuentas generales, con la _fase de ADN_: el motor recorre los bots vivos uno por uno y ejecuta el ADN de cada uno. Recién cuando terminaron todos se mueven los disparos, se aplican las fuerzas, se integran las posiciones, miran los ojos y se resuelven las acciones (disparar, reproducirse, fabricar escudo…).

Eso tiene dos consecuencias que conviene tener siempre en la cabeza:

- **Lo que leés viene del ciclo anterior.** Los ojos, el contacto, la velocidad, la energía y demás sentidos se escriben durante la parte física del ciclo _N−1_; el ADN del ciclo _N_ lee esos valores.
- **Lo que escribís se aplica después.** Un `10 .up store` deja el 10 en memoria en el acto, pero el empuje se aplica más tarde, en la parte física del mismo ciclo. Su efecto en los sentidos lo vas a ver recién en el ciclo siguiente.

Los cadáveres no ejecutan ADN. Un bot que nace durante el ciclo _N_ corre su ADN por primera vez en el ciclo _N+1_.

## Un ciclo de retraso, comprobado {#retraso}
<!-- 21-MEMORIA §0.3 (latencia 1 ciclo); 10-CICLO §2; comprobado en el port (tabla de .vel; bot sembrado lee .nrg 0 en su primer ciclo) -->

Este bot empuja hacia adelante con [[.up]] y, antes, anota en la posición 52 la velocidad que lee en [[.vel]]:

```adn
' Empuja hacia adelante y anota la velocidad que lee
cond
start
  *.vel 52 store
  10 .up store
stop
end
```

Corriéndolo, la posición 52 va siempre un paso atrás de la velocidad real:

| Ciclo | `.vel` al terminar el ciclo | Lo que el ADN anotó en 52 |
|---|---|---|
| 1 | 7 | 0 |
| 2 | 13 | 7 |
| 3 | 20 | 13 |
| 4 | 26 | 20 |

En el ciclo 1 el bot ya empujó, pero cuando su ADN leyó `.vel` el empuje todavía no se había aplicado. Pasa lo mismo con [[.nrg]]: el bot ve la energía con la que terminó el ciclo anterior, no la que le queda mientras su propio ADN la va gastando. Un bot recién sembrado en el mundo lee además los sentidos en 0 durante su primer ciclo, porque todavía no pasó por ninguna parte física.

:::nota
Esta demora de un ciclo no es un defecto del port: es la del DarwinBots 2.48.32, y los bots del Bestiario están escritos (y evolucionados) contando con ella.
:::

## Todo el ADN, cada ciclo, en orden {#orden}
<!-- 20-VM §4 (bucle hasta end, sin saltos; CLEAR token a token; stacks limpiados por bot); 10-CICLO §3 (stores inmediatos; sin estado compartido salvo RNG) -->

En cada ciclo el intérprete arranca en la primera instrucción y avanza hasta el `end` final (o hasta el final del archivo). No hay saltos ni bucles: los genes no se llaman entre sí y nada vuelve atrás. Cada instrucción se mira a lo sumo una vez por ciclo, y los genes se recorren en el orden en que están escritos.

Un gen cuya condición es falsa no se _salta_ de un golpe: el intérprete sigue pasando por sus instrucciones, pero las ignora una por una hasta el próximo marcador (`cond`, `start`, `else` o `stop`). Los detalles de esos marcadores están en [[adn/genes]].

Las pilas ([[adn/pilas]]) se vacían al empezar el ADN de cada bot: nada queda en ellas de un ciclo a otro ni pasa de un bot a otro. Lo que sí persiste es la memoria, y los stores escriben en ella **en el momento** ([[adn/stores]]). Por eso un gen ve lo que escribió un gen anterior en el mismo ciclo, pero no lo que va a escribir uno posterior:

```adn
' El gen 1 cuenta; el gen 2 copia el contador
cond
start
  *50 1 add 50 store
stop

cond
start
  *50 51 store
stop
end
```

Con este orden, al final de cada ciclo 50 y 51 valen lo mismo (1 y 1, 2 y 2, 3 y 3…). Si invertís los dos genes, la copia lee el valor viejo y 51 queda siempre uno por detrás de 50 (1 y 0, 2 y 1, 3 y 2…).

El ADN de un bot solo toca su propia memoria y su energía; no lee ni escribe nada de otros bots durante esta fase. Por eso el orden _entre_ bots no cambia lo que calcula cada ADN. (Lo único compartido es el generador de números aleatorios: si usás [[op:rnd]], el número que te toca depende de cuántos bots lo usaron antes que vos.)

## Cuánto cuesta cada instrucción {#costos}
<!-- 20-VM §1 (tabla de tipos y costos; × COSTMULTIPLIER; resta sin piso), §7 (fracciones por store; store solo si escribe); constants.yaml costes_indices -->

Cada instrucción ejecutada descuenta energía del bot en el momento, según su clase. Los precios son parámetros del escenario (página [[app/parametros-costos]]) y todos se multiplican por el [[param:cost:54]]:

| Clase | Ejemplos | Parámetro |
|---|---|---|
| Número | `10`, `.up` (como dirección) | [[param:cost:0]] |
| Lectura de memoria | `*.eye5`, `*50` | [[param:cost:1]] |
| Operador básico | [[op:add]], [[op:dup]], [[op:rnd]] | [[param:cost:2]] |
| Operador avanzado | [[op:angle]], [[op:dist]], [[op:sqr]] | [[param:cost:3]] |
| Operador de bits | [[op:&]], [[op:<<]] | [[param:cost:4]] |
| Condición | [[op:>]], [[op:=]], [[op:%=]] | [[param:cost:5]] |
| Lógico | [[op:and]], [[op:not]], [[op:dropbool]] | [[param:cost:6]] |
| Store | [[op:store]], [[op:inc]]… | [[param:cost:7]] (ver abajo) |
| Marcador de gen | `cond`, `start`, `else`, `stop` | [[param:cost:9]] |

Algunas reglas finas:

- **Lo que se ignora no se cobra.** Dentro de un gen apagado, números, lecturas, operadores y stores no cuestan nada. Lo que sí se cobra siempre es la parte de condiciones (que hay que evaluar para saber si el gen corre) y los marcadores `cond`, `start`, `else` y `stop`, que se ejecutan aunque el gen esté apagado.
- **Un store que no escribe no cuesta.** Si una condición en línea dejó _falso_ arriba de la pila booleana ([[adn/condiciones]]), el store no corre y no se cobra. Un store a la dirección 0 tampoco hace nada ni cuesta.
- **No todos los stores cuestan lo mismo.** [[op:store]] paga el precio entero; [[op:inc]] y [[op:dec]], la décima parte; [[op:addstore]], [[op:substore]], [[op:multstore]], [[op:divstore]], [[op:ceilstore]] y [[op:floorstore]], la quinta; [[op:rndstore]], [[op:sgnstore]] y [[op:sqrstore]], la séptima; [[op:absstore]] y [[op:negstore]], la octava.
- **Gratis:** [[op:debugint]] y [[op:debugbool]], que solo sirven para mirar.
- **Sin piso.** El intérprete resta sin mirar el saldo: la energía puede quedar negativa durante la fase de ADN. La muerte por falta de energía se decide más adelante en el ciclo ([[simulacion/muerte]]).

### Un ejemplo con números {#ejemplo-costos}
<!-- comprobado en el port con costos 0, 5, 7 y 9 en 1 y multiplicador 1: −6 y −12 por ciclo -->

```adn
' Un gen cuya condición es falsa
cond
  0 1 =
start
  1 50 store
  2 51 store
stop
end
```

Con número, condición, store y marcadores a 1 cada uno, este bot pierde 6 de energía por ciclo: 2 números y una condición en la parte de `cond`, más los tres marcadores. El cuerpo no se cobra. Si cambiás `0 1 =` por `1 1 =`, el cuerpo corre y el gasto sube a 12: se suman 4 números y 2 stores.

## El ADN largo cuesta aunque no corra {#adn-largo}
<!-- 31-ENERGIA §1 (mantenimiento (DnaLen−1)·DNACYCCOST); constants.yaml repro_tax (DnaLen·DNACOPYCOST); 20-VM §2.6 (DnaLen cuenta el end) -->

Además de lo que cobra cada instrucción ejecutada, el mantenimiento de cada ciclo cobra por el _largo_ del ADN, se ejecute o no. El precio es el parámetro [[param:cost:24]], y se paga una vez por cada instrucción del genoma sin contar el `end` final. Un bot como `cond start 1 50 store 2 51 store stop end` tiene 9 instrucciones más el `end`: con ese costo en 1 pierde 9 por ciclo, y los perdería igual con todos sus genes apagados. Podés consultar el largo de tu propio ADN en [[.dnalen]], que cuenta también el `end` (para ese bot vale 10).

El largo vuelve a pesar al reproducirse: el padre paga el costo de [[param:cost:25]] una vez por cada instrucción del genoma (esta vez contando el `end`) al copiarlo para el hijo ([[simulacion/reproduccion]]). Con estos dos costos encendidos, cada instrucción que sobra es energía que el bot no usa para otra cosa.

## ¿Hay un límite de instrucciones? {#limite}
<!-- 20-VM §4 (a <= 32000), §0.1 -->

No hay un tope de energía ni de tiempo: un bot ejecuta todo su ADN cada ciclo aunque se quede sin energía en el camino. El único límite es de posición: el intérprete mira como mucho las primeras 32000 instrucciones del genoma, y lo que esté más allá nunca corre. Como no hay bucles, ningún ADN puede trabar la simulación.

## Qué valores se usan {#valores}
<!-- constants.yaml preset_f1 (COSTSTORE 0.04, CONDCOST 0.004, resto de la VM 0); 10-CICLO §2 paso 7 (costos dinámicos) -->

Los costos dependen del escenario. Las reglas F1, las de las competencias (en Experimentar las aplicás con «Ajustes F1»), cobran 0,04 por store y 0,004 por condición y dejan en 0 los demás costos del ADN, incluido el del largo. Con esas reglas, diez stores por ciclo le cuestan a un bot 0,4 de energía por ciclo; el largo del genoma, nada.

El [[param:cost:54]] puede moverse solo si activás el [[param:cost:56]] ([[app/parametros-costos-dinamicos]]): el motor lo sube o lo baja para llevar la población a un objetivo, y todos los precios de esta página cambian con él. Cómo encaja todo esto con el resto de los gastos del bot está en [[simulacion/energia]].
