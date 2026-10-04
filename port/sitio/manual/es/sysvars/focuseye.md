---
titulo: .focuseye
resumen: "Elige cuál de los nueve ojos tiene el foco: el que se copia en .eyef y el que decide qué describen las celdas ref*."
etiquetas: [ojos, visión, focuseye, ref]
estado: revisada
---
Un número que elige el ojo con foco. En 0 el foco es [[.eye5]]; cada unidad
corre el foco un ojo hacia la derecha y cada unidad negativa uno hacia la
izquierda:

| `.focuseye` | −4 | −3 | −2 | −1 | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|---|---|---|---|
| Ojo con foco | [[.eye1]] | [[.eye2]] | [[.eye3]] | [[.eye4]] | `.eye5` | [[.eye6]] | [[.eye7]] | [[.eye8]] | [[.eye9]] |

Fuera de ese rango no da error, pero la cuenta es rara: el motor le suma 4, le
saca el signo y se queda con el resto de dividir por 9. Así 5 vuelve a `.eye1`,
y −5 da `.eye2` igual que −3. Mejor quedarse entre −4 y 4.
<!-- 32-VISION §2.6 y notas: Abs(x+4) Mod 9 -->

El ojo con foco hace dos cosas. Su valor se copia en [[.eyef]], y lo más cercano
que ve es lo que describen las celdas de [[sysvars/ref|lo que se ve]]
([[.refeye]], [[.refnrg]], [[.refxpos]]…). Si el ojo con foco no ve nada, esas
celdas quedan en 0 aunque otro ojo esté viendo algo (salvo que el bot esté
chocando con otro: un choque también las llena).
<!-- 32-VISION §1, §4; sysvars.yaml .refup (borra EraseLookOccurr) -->

Es configuración: el motor la lee pero nunca la borra, así que alcanza con
escribirla una vez.<!-- sysvars.yaml .focuseye (persiste) --> Este bot pone el foco en el ojo de la izquierda y guarda en
la celda 50 la energía de lo que ese ojo ve:

```adn
cond
*.robage 0 =
start
-4 .focuseye store
stop

cond
*.eyef 0 >
start
*.refnrg 50 store
stop
```
