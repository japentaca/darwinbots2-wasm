---
titulo: .timer
resumen: "Un reloj que suma 1 por ciclo, que podés escribir y que el hijo hereda del padre: sirve para sincronizar a un linaje."
etiquetas: [reloj, herencia, sentido, memoria]
estado: revisada
---
<!-- sysvars.yaml .timer (Ageing P5 +1, wrap 32000 → −32000; semilla al azar; heredado al nacer); 36-REPRO §2 -->
El motor le suma 1 al final de cada ciclo a lo que haya en `.timer`. A diferencia de
[[.robage]], el valor es tuyo: si escribís 0, el ciclo siguiente leés 1, y sigue
contando desde ahí. Cuando pasa de 32000 salta a −32000 y sigue subiendo.

Dos detalles de dónde arranca:

- Un bot cargado al empezar la simulación recibe un valor al azar.
- Un hijo nace con el valor que tenía su padre (o su madre, en la reproducción
  sexual) y sigue la misma cuenta. Es, con la memoria genética, lo único de la
  memoria que se hereda (ver [[adn/memoria#al-nacer]]).

Por eso es la herramienta para que todo un linaje actúe a la vez: los descendientes
de un mismo fundador comparten el reloj sin hablarse.

```adn
' Cada 100 ciclos de reloj, media vuelta
cond
 *.timer 100 mod 0 =
start
 628 .aimdx store
stop
```

Todos los hijos de este bot giran en los mismos ciclos que él. Si preferís contar
desde el nacimiento de cada uno, poné el reloj en 0 al nacer con
`0 .timer store` dentro de un gen con `*.robage 0 =`.

<!-- opcodes.yaml mod (signo del dividendo); comprobado: −250 100 mod da −50 -->
Ojo con [[op:mod]] y los números negativos: con el reloj en −250, `100 mod` da −50,
no 50. La comparación con 0 funciona igual.
