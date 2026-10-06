---
titulo: La firma propia (my*)
resumen: "Once contadores que el motor saca del ADN del propio bot (cuántas veces mueve, gira, dispara, mira…) y que sirven para reconocer a los de la misma especie."
etiquetas: [especie, reconocimiento, ref, firma]
estado: revisada
---
Estas celdas no miden nada del mundo: cuentan cosas del propio ADN. [[.myup]]
dice cuántas veces el ADN escribe en [[.up]], [[.myeye]] cuántas veces lee un
ojo, [[.myties]] cuántas veces aparece el número de [[.tie]], y así. Juntas son
una especie de firma del genoma.
<!-- sysvars.yaml .myup….myvenom; 32-VISION §4 -->

Su uso es compararlas con lo que se ve. Cuando un bot mira a otro, las celdas
de [[sysvars/ref|lo que se ve]] traen los mismos contadores, pero del ADN del
otro: [[.refup]] frente a `.myup`, [[.refeye]] frente a `.myeye`, [[.reftie]]
frente a `.myties`. Si coinciden, lo más probable es que sea de la misma
especie. La comparación más usada del Bestiario, por lejos, es
`*.refeye *.myeye !=`, «lo que veo no es de los míos»:

```adn
' marcar en la celda 60 cuando lo que hay adelante es de otra especie
cond
*.eye5 0 >
*.refeye *.myeye !=
start
1 60 store
stop
```

Es una prueba aproximada: dos especies distintas pueden tener la misma cuenta, y
una mutación puede cambiar la de un pariente. Por eso muchos bots comparan dos o
tres contadores a la vez. El tutorial [[tutoriales/reconoce-especie]] lo
desarrolla.

Ojo con los cadáveres: llegan con toda la firma en 0, así que frente a uno
`*.refeye *.myeye !=` da verdadero, como si fuera de otra especie. Lo mismo
pasa con un obstáculo, que se distingue porque pone [[.reftype]] en 1.
<!-- 32-VISION §2 notas (corpses: occurr borrado), lookoccurrShape (firma en 0) -->

## Cuándo se calculan {#cuando}

El motor las calcula cuando el ADN cambia: al cargar el bot, al nacer, cuando
un virus le agrega o le quita un gen y cuando muta. No las vuelve a escribir en
cada ciclo, así que el bot puede pisarlas; pero lo que ven los demás sale de la
cuenta del motor, no de la celda, así que escribir en ellas no sirve para
disfrazarse.
<!-- sysvars.yaml .myup (borra: no), .refup (= occurr del visto); port/README.md B6-9 -->

:::nota
En el DarwinBots original una mutación en vida no rehacía la cuenta: quedaba
vieja hasta el próximo parto, virus o carga, y así lo describe la spec del
original. El port la rehace en el momento.
:::
