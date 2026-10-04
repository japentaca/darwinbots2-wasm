---
titulo: Memoria (memloc, memval y genética)
resumen: "Las direcciones para espiar la memoria de otro bot (por la vista o por un lazo) y las de la memoria genética, la que pasa de padres a hijos."
etiquetas: [memoria, espionaje, epigenética, herencia]
estado: revisada
---
<!-- 21-MEMORIA §3 (memloc y tmemloc persisten), §5 (memoria genética), §6 (mem 0); sysvars.yaml 473-476; Bestiario: EyeBot_F3_Moonfisher_17-01-2009.txt -->
Este grupo junta tres cosas que tienen que ver con la memoria del bot más allá de
sus propias variables.

**Espiar la memoria de otro.** Dos pares de sysvars te dejan leer una celda
cualquiera de la memoria de otro bot. Con [[.memloc]] elegís la dirección y en
[[.memval]] aparece lo que tiene el bot que estás viendo; con [[.tmemloc]] y
[[.tmemval]] es lo mismo, pero con el bot que tenés atado por un lazo. Las dos
direcciones (`memloc` y `tmemloc`) son de configuración: las escribís una vez y
quedan.

El uso más común en el Bestiario es reconocer a los de tu especie: si apuntás
`.memloc` a [[.dnalen]], `.memval` te dice el largo del ADN del otro, y lo comparás
con el tuyo. Así lo hace, por ejemplo, EyeBot de Moonfisher:

```adn
' Una sola vez: espiar el largo del ADN del bot que veo
cond
*.memloc 0 =
start
.dnalen .memloc store
stop

' Si lo que veo tiene mi mismo largo de ADN, la celda 50 vale 1
cond
*.eye5 0 >
*.memval *.dnalen =
start
1 50 store
stop
```

También sirve para leer variables privadas de un aliado (su celda 50, por ejemplo)
o lo que el otro ve con sus ojos.

**La memoria genética.** Las celdas 971 a 990 no tienen nombre, pero el motor las
copia del padre al hijo: las [[sysvars/mem-971-975|971–975]] al nacer, y las
[[sysvars/mem-976-990|976–990]] de a una por ciclo mientras el hijo siga atado a su
padre. Junto con el [[.timer]], son lo único de la memoria que se hereda; la explicación completa está en
[[adn/memoria#memoria-genetica]].

**La dirección 0.** No la alcanza el ADN; el motor la usa como basurero para los
ataques que apuntan a [[.delgene]]. Ver [[sysvars/mem-0]].
