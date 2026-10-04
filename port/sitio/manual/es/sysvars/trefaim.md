---
titulo: .trefaim
resumen: "Hacia dónde apunta el bot atado: una copia de su .aim."
etiquetas: [tref, lazos, orientacion]
estado: revisada
---
<!-- sysvars.yaml .trefaim (= mem(18) del atado), .aim; core ties.hpp ReadTRefVars; atraso comprobado con probar-adn -->
Es el [[.aim]] del bot atado: su orientación absoluta, de 0 a 1255 (una vuelta
entera son 1256). Como la posición, va un ciclo detrás de lo que el compañero lee
de sí mismo. Con [[.setaim]] podés copiarla para apuntar hacia el mismo lado que
él, algo útil para que un grupo atado se mueva en la misma dirección.

En este ejemplo solo el hijo copia el rumbo de su padre (el atado mayor que él,
como en [[.trefage]]):

```adn
' Apunta hacia donde apunta el atado, si es mi padre
cond
*.numties 0 >
*.trefage *.robage >
start
*.trefaim .setaim store
stop
```

Cuando el padre cambia de rumbo, el `.aim` del hijo lo alcanza dos ciclos después:
uno porque `.trefaim` llega con atraso y otro porque el giro de [[.setaim]] se ve en
`.aim` recién al ciclo siguiente.

:::cuidado
Si los dos extremos del lazo copian el rumbo del otro, ninguno gira por su cuenta: se
quedan copiándose. Peor aún con un recién nacido, cuyo `.aim` vale 0 en su primer
ciclo (ver [[.aim]]): el padre lee ese 0 y se pone a apuntar a la derecha de la
pantalla. Hacé que copie uno solo.
:::

Para el ángulo del lazo mismo, usá [[.tieang]].
