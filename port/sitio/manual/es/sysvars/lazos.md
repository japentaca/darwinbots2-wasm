---
titulo: Lazos
resumen: "Las celdas para atarse a otro bot, hablar y pasar recursos por el lazo, darle forma y, con lazos endurecidos, armar organismos multicelulares."
etiquetas: [lazos, tie, multicelular, comunicación]
estado: revisada
---
Un _lazo_ (tie) es un resorte entre dos bots. Hay dos formas de tener uno: al
nacer, padre e hijo quedan atados por un lazo que se corta solo a los 100 ciclos;
y con [[.tie]], que ata al bot que estás viendo. Un lazo hecho con `.tie` se
endurece a los 19 ciclos y desde ahí los dos bots son _multicelulares_
([[.multi]]): pueden compartir recursos y fijar la forma del lazo.

<!-- 34-TIES §0.4 (last = 100 nacimiento, −20 .tie → regang a los 19 ciclos), §3 (Multibot); port/core: TieHooke corre en los dos extremos, comprobado con probar-adn (los dos pasan a .multi 1 en el mismo ciclo) -->

Cada lazo tiene un número, su _puerto_, y cada extremo lo conoce por un número
distinto: quien lo crea usa el valor que puso en `.tie`; el otro, el número de
orden del lazo entre los suyos. [[.tiepres]] dice el puerto del último lazo creado
y [[.numties]] cuántos tenés. Casi todas las órdenes actúan sobre el lazo que
elegís con [[.tienum]] (o, si lo dejás en 0, sobre el de `.tiepres`).

<!-- 34-TIES §0.2 (puerto asimétrico), §2 (tabla de operaciones y gates) -->

Las celdas se agrupan así:

- **Atar y soltar:** [[.tie]], [[.deltie]], [[.numties]], [[.tiepres]], [[.multi]].
- **Escribir y transferir por el lazo:** [[.tienum]], [[.tieloc]], [[.tieval]].
  Con `.tieloc` positivo escribís en la memoria del otro; con `-1`, `-3`, `-4` o
  `-6` le pasás o le sacás energía, veneno, desecho o cuerpo.
- **Medir:** [[.tieang]] y [[.tielen]] (el lazo de `.tiepres`), y [[.tieang1]] a
  `.tieang4` y [[.tielen1]] a `.tielen4` (los cuatro primeros, en un
  multicelular).
- **Dar forma** (solo lazos endurecidos): [[.fixang]], [[.fixlen]], [[.stifftie]]
  y, escribiendo, `.tieang1`…`.tielen4`.
- **Compartir** (solo multicelulares): [[.sharenrg]], [[.sharewaste]],
  [[.shareshell]], [[.shareslime]] y [[.sharechlr]].
- **Leer al otro:** [[.readtie]] elige de qué lazo vienen las celdas de
  [[sysvars/tref|lo que se siente por un lazo]].

La receta básica de un organismo: el hijo, apenas nace, se ata al padre con
`.tie`; veinte ciclos después los dos son multicelulares y el hijo, que es quien
creó el lazo, reparte la energía con `.sharenrg`. Ese es el detalle a cuidar:
compartir solo funciona desde el bot que creó el lazo. El funcionamiento completo
está en [[simulacion/lazos]].

<!-- 34-TIES §2 (sharing solo en ties no-back), §2.1; comprobado con probar-adn: con 90 .sharenrg en los dos, solo el del hijo mueve energía -->
