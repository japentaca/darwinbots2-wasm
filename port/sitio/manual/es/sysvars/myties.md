---
titulo: .myties
resumen: "Cuántas veces aparece en el ADN del propio bot el número de .tie (330), se use como se use: parte de la firma para reconocer a la propia especie."
etiquetas: [especie, reconocimiento, firma, lazos]
estado: revisada
---
Un contador sacado del propio ADN: cuántas veces aparece el número 330, que es
la dirección de [[.tie]]. A diferencia de [[.myup]] y sus hermanas, no hace
falta que vaya seguido de un store: cuenta cualquier aparición, sea `.tie` o
`330` escrito a mano, como dirección o como valor. Un `*.tie` (con asterisco),
en cambio, no suma.
<!-- sysvars.yaml .myties (literales 330), .reftie; makeoccurrlist -->

Su pareja es [[.reftie]], la misma cuenta pero del ADN del bot que se está
viendo. Suele servir para distinguir bots que arman lazos de los que no, o
como un segundo control además de [[.myeye]]:

```adn
' de los míos según dos contadores: marcar 1 en la celda 60
cond
*.eye5 0 >
*.refeye *.myeye =
*.reftie *.myties =
start
1 60 store
stop
```

El motor la calcula cuando el ADN cambia (al cargar, al nacer, por un virus o
una mutación; ver [[sysvars/my#cuando]]), no en cada ciclo. Si el bot escribe en ella, su valor cambia
para él, pero los demás siguen viendo la cuenta original. Más sobre estos
contadores en [[sysvars/my]].
