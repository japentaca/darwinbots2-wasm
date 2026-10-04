---
titulo: Reproducción
resumen: "Las órdenes para tener hijos, sola o con pareja, y el sentido que avisa que el bot fue fecundado."
etiquetas: [reproducción, hijos, sexual, asexual]
estado: revisada
---
<!-- 36-REPRO §2 (reparto de nrg, body, chlr, waste y pwaste por per; tie de nacimiento) -->
Un bot tiene hijos escribiendo un porcentaje: la parte de sus recursos que le pasa al
hijo. `50 .repro store` lo parte en dos mitades; `10 .repro store` tiene un hijo
chico y se queda con casi todo. El hijo se lleva ese porcentaje de la energía, del
cuerpo, de los cloroplastos y de los desechos, y nace pegado al padre, unido a él
por un lazo de nacimiento.

Hay tres formas:

- [[.repro]]: asexual. El hijo es una copia del padre, con las mutaciones normales.
- [[.mrepro]]: asexual, pero el hijo muta mucho más. Sirve para explorar.
- [[.sexrepro]]: sexual. Necesita estar fecundado (lo dice [[.fertilized]]) por el
  esperma de otro bot, y el ADN del hijo mezcla el de los dos.

<!-- 36-REPRO §0.4, §0.5, §2 (Mod 100, persistencia hasta el éxito, impuestos y DNACOPYCOST) -->
Las tres comparten tres reglas que conviene tener presentes:

- **El porcentaje se toma módulo 100.** `100 .repro store` es 0 y nunca produce un
  hijo; `150` equivale a 50.
- **La orden queda escrita hasta que sale bien.** Si el parto falla (no hay lugar
  libre delante del bot, que es donde aparece el hijo, poco cuerpo, sin energía), el motor no la borra y se reintenta solo
  en cada ciclo. Para cancelarla, escribí 0.
- **Tiene un costo.** Se pierde un poco de energía en el traspaso y, según la
  configuración, el parto cobra además por el largo del ADN copiado
  ([[param:cost:25]]).

<!-- 21-MEMORIA §5; 36-REPRO §2 (hereda timer y memoria genética); comprobado: el hijo lee .nrg en su primer ciclo y .body y .robage en 0 -->
El hijo nace con la memoria en 0, salvo el [[.timer]] y la memoria genética (ver
[[adn/memoria#al-nacer]]). En su primer ciclo ya lee su [[.nrg]], pero [[.body]] y
[[.robage]] le dan 0. Todo el proceso está en [[simulacion/reproduccion]].

Una idea de uso: reproducirse cuando sobra energía, con un porcentaje que deje al
padre en condiciones de seguir.

```adn
' Cuando junta energía, tiene un hijo con un tercio
cond
 *.nrg 6000 >
 *.body 500 >
start
 33 .repro store
stop
```
