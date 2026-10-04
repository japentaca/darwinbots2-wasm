---
titulo: .delgene
resumen: "Borra del propio ADN el gen con ese número; el uso clásico es un gen que se borra a sí mismo después de correr."
etiquetas: [genes, ADN, acción]
estado: revisada
---
<!-- sysvars.yaml .delgene (BotDNAManipulation P3, =0 al consumir; blindada contra disparos de memoria y veneno); 35-VIRUS (delgene) -->
Escribí el número de un gen y el motor lo borra del ADN en el mismo ciclo, entero,
de su `cond` a su `stop`. Desde el ciclo siguiente ese código ya no existe:
no corre, no cuesta mantenimiento y no pasa a los hijos. La orden se borra al
usarse, y un número que no corresponde a ningún gen no hace nada. La numeración es
la de [[adn/genes#la-numeracion-de-los-genes]].

El uso más conocido es el gen de un solo uso, que se borra a sí mismo con
[[.thisgene]]:

```adn
' Gen de arranque: corre una vez y desaparece
cond
start
 0 .timer store
 *.thisgene .delgene store
stop
cond
start
 10 .up store
stop
```

<!-- comprobado: .genes pasa de 2 a 1 y .dnalen de 16 a 7 después del primer ciclo -->
Es el patrón de bots del Bestiario como _Saber_ (abyaly, 2008). Después del primer
ciclo [[.genes]] baja de 2 a 1 y [[.dnalen]] se achica.

:::cuidado
Al borrar un gen, los que venían después se corren un número hacia abajo. Si
guardaste números de gen en memoria (para [[.mkvirus]] u otro `.delgene`), ya no
apuntan a lo mismo.
:::

Ningún ataque de afuera puede escribir en `.delgene`: los disparos de memoria la
saltean y el veneno no puede apuntarle. La única forma de que otro te borre un gen
es meterte un virus cuyo código lo haga.
