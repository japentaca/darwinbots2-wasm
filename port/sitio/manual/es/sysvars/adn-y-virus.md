---
titulo: ADN y virus
resumen: "Las sysvars para que el bot se mire el propio ADN, se borre genes y fabrique y dispare virus que inyectan un gen en otros bots."
etiquetas: [ADN, genes, virus, delgene]
estado: revisada
---
Este grupo junta dos cosas que trabajan sobre el ADN mismo, no sobre la memoria.

<!-- sysvars.yaml .dnalen .genes .thisgene .delgene; 20-VM §5.6 -->
**Mirarse el ADN.** [[.dnalen]] dice cuántas palabras tiene el ADN, [[.genes]]
cuántos genes, y [[.thisgene]] el número del gen que se está ejecutando. Las tres
las mantiene el motor y cambian cuando el ADN cambia: por una mutación, por un
virus que se metió o por un gen borrado. La numeración de los genes está en
[[adn/genes#la-numeracion-de-los-genes]].

**Cambiarlo.** [[.delgene]] borra un gen del propio ADN. El truco más conocido es un
gen que se borra a sí mismo después de correr una vez, con [[.thisgene]].

<!-- 35-VIRUS §0.2-§0.3, §1, §2, §3 (fabricación, incubación 2·largo, disparo al azar, inserción, baba, cadáveres inmunes) -->
**Virus.** Un bot puede copiar uno de sus genes en un virus y dispararlo. El ciclo
completo es:

1. Escribís el número del gen en [[.mkvirus]]. El motor copia el gen (cobra energía
   por su largo) y empieza a incubarlo.
2. [[.vtimer]] cuenta la incubación hacia atrás: dura el doble de palabras que
   tiene el gen. Al llegar a 1 se queda esperando.
3. Escribís la fuerza del disparo en [[.vshoot]]. Con el virus listo, sale hacia
   una dirección al azar.
4. Si toca a otro bot, el gen se inserta entre dos de sus genes, elegidos al azar,
   y desde el ciclo siguiente corre como uno más de los suyos.

Un gen que hace que la víctima también fabrique y dispare virus se propaga como una
epidemia. La baba ([[.slime]]) frena los virus débiles, y los cadáveres no se
infectan. Un bot con cloroplastos no puede fabricar virus: si lo intenta, pierde
los cloroplastos. Todo el detalle está en [[simulacion/virus]].

```adn
' Fabrica un virus con el gen 3 y lo dispara apenas está listo
cond
 *.vtimer 0 =
start
 3 .mkvirus store
stop
cond
 *.vtimer 1 =
start
 50 .vshoot store
stop
' Gen 3: lo que va a ejecutar la víctima
cond
start
 314 .aimdx store
stop
```
