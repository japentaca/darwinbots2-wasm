---
titulo: .multi
resumen: "Vale 1 si el bot es multicelular (tiene o tuvo un lazo endurecido y todavía conserva algún lazo); si no, 0."
etiquetas: [lazos, multicelular, sentidos]
estado: revisada
---
Un bot pasa a ser multicelular cuando uno de sus lazos se endurece: eso pasa a
los 19 ciclos de un lazo creado con [[.tie]], y les ocurre a los dos extremos a
la vez. El lazo de nacimiento nunca se endurece, así que padre e hijo no son
multicelulares solo por haber nacido juntos.

<!-- sysvars.yaml .multi (regang = 1; = 0 sin ties); 34-TIES §0.4, §3; port/core ties.hpp TieHooke (corre en los dos extremos, ambos con last = −20); comprobado con probar-adn: padre e hijo pasan a 1 en el mismo ciclo -->

Ser multicelular habilita cosas: compartir con [[.sharenrg]] y sus parientes,
fijar ángulo y largo de los lazos endurecidos ([[.fixang]], [[.fixlen]],
[[.stifftie]], [[.tieang1]]…), y pagar menos por fabricar caparazón y baba.

<!-- 34-TIES §2 (sharing y geometría solo multibot), §3 (costes divididos por numties+1) -->

Vuelve a 0 recién cuando el bot se queda sin ningún lazo. Si se corta el lazo
endurecido pero queda otro, sigue en 1.

<!-- 34-TIES §3 (False cuando numties llega a 0; no hay más escritores) -->

```adn
' una vez multicelular, repartir la energía parejo con cada compañero
cond
*.multi 1 =
start
50 .sharenrg store
stop
```

Recordá que el reparto solo lo hace el bot que creó el lazo (ver
[[.sharenrg]]).
