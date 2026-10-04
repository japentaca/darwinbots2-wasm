---
titulo: .trefeye
resumen: "Cuántas veces el ADN del bot atado lee uno de sus ojos: la cuenta de la firma más usada para reconocer a los de tu especie."
etiquetas: [tref, lazos, firma, especie, ojos]
estado: revisada
---
<!-- sysvars.yaml .trefeye (occurr(8) del atado); core senses.hpp makeoccurrlist (lecturas *501..*509; .eyef es 510 y no cuenta) -->
Cuenta cuántas lecturas de ojos tiene el ADN del bot atado: cada `*.eye1`…`*.eye9`
suma 1 (`*.eyef` no cuenta). Es el [[.myeye]] del otro, leído desde tu lado del
lazo. Como el resto de la firma ([[.trefup]], [[.trefshoot]]…), sale del texto del
ADN y no de lo que se ejecuta, así que solo cambia si el otro muta.

<!-- conteo en port/web/bots: .trefeye en 103 bots; formas más comunes «*.trefeye 0 =», «*.trefeye *.myeye %=», «=» y «!=» -->
Es la sysvar de lazos más usada del Bestiario, casi siempre comparada con la tuya:
`*.trefeye *.myeye =` (o con [[op:%=]], que admite un 10 % de diferencia): si el
atado tiene la misma cantidad de lecturas de ojos que vos, lo más probable es que
sea de tu especie. También aparece mucho `*.trefeye 0 =`, que además es cierto
cuando no hay ningún lazo leído, porque entonces todas las
[[sysvars/tref|tref*]] valen 0.

```adn
' Si el atado no es de mi especie, corto el lazo
cond
*.numties 0 >
*.trefeye *.myeye !=
start
*.tiepres .deltie store
stop
```

El mismo truco con el bot que ves es [[.refeye]]. Otras maneras de reconocer a los
tuyos están en [[tutoriales/reconoce-especie]].
