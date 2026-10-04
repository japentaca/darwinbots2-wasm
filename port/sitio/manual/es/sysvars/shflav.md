---
titulo: .shflav
resumen: "El tipo del disparo que te pegó en el ciclo anterior (−1, −2, −3…, o la dirección de un disparo de memoria); 0 si no te pegó ninguno."
etiquetas: [disparos, sentidos, defensa]
estado: revisada
---
<!-- 32-VISION §5 (taste); 33-SHOTS §3.4; sysvars.yaml 202; core senses.hpp taste/EraseSenses; probado: tira.txt contra blanco.txt (-1 en el blanco, -2 en el tirador), memshot.txt (50), sperm.txt (-8) -->
`.shflav` es el «sabor» del último disparo que te pegó: su tipo, el mismo
número que el tirador escribió en su [[.shoot]]. −1 es alguien que te roba
energía, −3 veneno, −6 alguien que te roba body, y así. Para un disparo de
memoria es la dirección en la que te escribieron; para el esperma, −8. Si no
te pegó nada, vale 0.

Lo escribe el motor cuando el disparo llega, después de que corrió tu ADN, así
que lo leés en el ciclo siguiente; después se borra. Si te pegan varios en el
mismo ciclo, queda el último.

:::cuidado
Un cazador que usa −1 también siente sus propias ganancias. El disparo de
energía vuelve hacia el tirador como un −2, y al llegar le marca `.shflav` en
−2. En la prueba, el blanco leyó −1 y el tirador, −2, en el mismo ciclo. Si tu
bot reacciona a cualquier `.shflav` distinto de 0, va a reaccionar también a
sus propias comidas.
:::

Para saber desde dónde vino, mirá [[.shang]] o las cuatro de dirección
([[.shup]], [[.shdn]], [[.shdx]], [[.shsx]]).

```adn
' me están robando energía: escapo
cond
*.shflav -1 =
start
628 .aimdx store
40 .up store
stop
```
