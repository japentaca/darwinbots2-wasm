---
titulo: .myeye
resumen: "Cuántas veces el ADN del propio bot lee un ojo (*.eye1 a *.eye9): el contador más usado para reconocer a la propia especie."
etiquetas: [especie, reconocimiento, firma, ojos]
estado: revisada
---
Un contador sacado del propio ADN: cuántas lecturas de ojos hay en el genoma,
es decir, cuántas veces aparece `*.eye1`, `*.eye2`… hasta `*.eye9`, estén en
las condiciones o en el cuerpo de un gen. Cuenta la lectura con asterisco (o su
número, como `*505`); un `.eye5` sin asterisco no suma, y [[.eyef]] tampoco,
aunque sea un ojo.
<!-- sysvars.yaml .myeye; makeoccurrlist: lecturas de 501..509 -->

Su pareja es [[.refeye]], la misma cuenta pero del bot que se está viendo. Es
la comparación preferida para reconocer especies, porque casi todos los bots
leen ojos y cada diseño lo hace una cantidad distinta de veces; en el Bestiario
`*.refeye *.myeye` aparece más que cualquier otro par. El ejemplo guarda 1 en la
celda 60 cuando lo que tiene adelante es de otra especie:
<!-- sysvars.yaml .refeye; Bestiario: 1601 apariciones del par contra ≤148 de cualquier otro -->

```adn
cond
*.eye5 0 >
*.refeye *.myeye !=
start
1 60 store
stop
```

Este mismo gen ya suma uno a `.myeye` (por el `*.eye5`); los genes que agregues
o saques cambian la cuenta, y con ella la firma.

El motor la calcula cuando el ADN cambia (al cargar, al nacer, por un virus o
una mutación; ver [[sysvars/my#cuando]]), no en cada ciclo. Si el bot escribe en ella, su valor cambia
para él, pero los demás siguen viendo la cuenta original. Más sobre estos
contadores en [[sysvars/my]].
