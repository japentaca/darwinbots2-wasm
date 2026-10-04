---
titulo: .refbody
resumen: "El body del bot que estás viendo, de 0 a 32000: su tamaño, y lo que le podés sacar con un disparo de body."
etiquetas: [visión, refvars, body]
estado: revisada
---
<!-- sysvars.yaml 688; 32-VISION §2; 33-SHOTS §5 (-6 releasebod: corpse ×4); 30-FISICA §0.4 (masa = body/1000 + shell/200 + cloroplastos) y FindRadius (radio según body) -->
`.refbody` es el body del bot que ve tu ojo con foco, lo que ese bot lee en su
[[.body]]. Del body dependen casi toda su masa y su tamaño, y es lo que se
lleva un disparo de body ([[.shoot]] en −6).

Un cadáver conserva su body real (y su [[.refnrg]]), aunque su firma de ADN
quede en 0. Por eso algo con body y [[.refeye]] en 0 suele ser un cadáver o
un bot que no mira, como muchos vegetales. Y los disparos de body contra un
cadáver rinden más que contra un bot vivo (ver [[simulacion/disparos]]).

Si no ves nada, vale 0.

```adn
' algo grande que no lee sus ojos: le saco body
cond
*.eye5 0 >
*.refeye 0 =
*.refbody 500 >
start
-6 .shoot store
stop
```
