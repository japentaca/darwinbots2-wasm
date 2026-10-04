---
titulo: .refup
resumen: "Cuántas veces escribe en .up el ADN del bot que estás viendo: una de las cifras de su firma, para reconocer especies."
etiquetas: [visión, refvars, firma, reconocimiento]
estado: revisada
---
<!-- sysvars.yaml 701; core senses.hpp makeoccurrlist (número 1..7 seguido de un store), lookoccurr; probado: firma.txt, firma2.txt; opcodes.yaml stores (tipo 7: store, inc, addstore…); README B6-9 (la mutación en vida rehace la firma); 32-VISION §2 (corpses: occurr borrado); revisor: mira.txt contra firma.txt (refup 2, refdx 1, refeye 3, reftie 2) y firma2.txt (refup 1, refshoot 2, refeye 1) -->
`.refup` es la primera cifra de la _firma_ del bot que ve tu ojo con foco:
cuenta cuántas veces aparece en su ADN la dirección de [[.up]] justo antes de
una palabra de escritura ([[op:store]], [[op:inc]], [[op:addstore]]…). Un bot
con `5 .up store` y `0 .up store` da 2.

Fijate que cuenta lo que está _escrito_, no lo que se ejecuta: un gen cuyas
condiciones nunca se cumplen suma igual. Y como `.up` es solo el número 1,
`5 1 store` también cuenta. La cifra no se recalcula en cada ciclo: el motor la
saca cuando el ADN del otro cambia (al cargarse, al nacer, al mutar o con un
virus), igual que tus [[sysvars/my|propias cifras]].

Sola dice poco; su gracia está en compararla con tu propia cifra, [[.myup]],
igual que las otras cifras de la firma ([[.refdn]], [[.refsx]], [[.refdx]],
[[.refaimdx]], [[.refaimsx]], [[.refshoot]], [[.refeye]], [[.reftie]]). Si
coinciden varias, lo más probable es que sea de tu especie. Un cadáver tiene
la firma en 0.

```adn
' no le disparo a lo que se mueve como yo
cond
*.eye5 0 >
*.refup *.myup !=
start
-1 .shoot store
stop
```
