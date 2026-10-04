---
titulo: .refeye
resumen: "Cuántas veces lee sus ojos el ADN del bot que estás viendo: la cifra de la firma más usada para reconocer a la propia especie."
etiquetas: [visión, refvars, firma, reconocimiento]
estado: revisada
---
<!-- sysvars.yaml 708; core senses.hpp makeoccurrlist (lecturas *501..*509); probado: firma.txt (refeye 3), firma2.txt (*.eyef no cuenta); Bestiario: 302 de 684 bots comparan *.refeye *.myeye; Animal_Minimalis_4G_Numsgil_-10.03.05.txt -->
A diferencia de las otras cifras de la firma, `.refeye` no cuenta escrituras
sino lecturas: cuántas veces aparece en el ADN del bot visto una lectura de
sus ojos, de `*.eye1` a `*.eye9`. Un bot con `*.eye5` dos veces y `*.eye1` una
vez da 3. La lectura de [[.eyef]] no cuenta.

Es la cifra más popular para reconocer a la propia especie, porque casi todo
bot que caza mira sus ojos varias veces y el número cambia bastante de una
especie a otra. Se compara con la tuya, [[.myeye]]. El truco viene de
_Animal Minimalis_, de Numsgil, y lo usan cientos de bots del Bestiario:

```adn
cond
*.eye5 0 >
*.refeye *.myeye !=
start
-1 .shoot store
stop
```

Como toda la firma (ver [[.refup]]), no se recalcula en cada ciclo, cuenta lo
escrito aunque no se ejecute y vale 0 si no ves nada o si ves un cadáver. Si
dos especies distintas coinciden por casualidad, este bot no las distingue:
para afinar, sumale otra cifra, como [[.refshoot]] o [[.refup]]. El paso a
paso está en [[tutoriales/reconoce-especie]].
