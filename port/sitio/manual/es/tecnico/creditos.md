---
titulo: Créditos y licencia
resumen: "Quién creó DarwinBots, quién lo mantuvo vivo, quién hizo este port, con qué licencias viaja todo y de dónde salen los bots del Bestiario."
etiquetas: [créditos, licencia, historia, bestiario, comunidad]
estado: revisada
---
Toda simulación que corrés en este sitio se apoya en más de veinte años
de trabajo ajeno. Esta página nombra a quienes lo hicieron y cuenta bajo
qué licencia viaja.

## El original y su comunidad {#original}

DarwinBots lo creó **Carlo Comis** en Italia, en 2002 y 2003. La
pantalla _About_ del programa original todavía saluda en italiano:
_«Robottini genetici!»_, robots genéticos.
<!-- README.md §Historia -->

De ahí en adelante el proyecto pasó de mano en mano: **Purple Youko** y
**Numsgil** lo mantuvieron en 2004 y 2005; **Eric Lockard** (EricL)
tomó el relevo después de la 2.42, en 2006 y 2007; después de la
2.44.01 lo siguieron los miembros del foro de DarwinBots, y después de
la 2.45.1, **Botsareus**, hasta la **2.48.32** que corre acá.
<!-- README.md §Historia (tabla de etapas); LICENSE.md -->

Alrededor del programa creció una comunidad que durante años documentó
el lenguaje del ADN y las variables del sistema en el wiki, discutió
estrategias en el foro, organizó ligas y competencias (F1, F2, F3,
multi-bots…) y, sobre todo, escribió bots. Esa comunidad es la razón de
ser de este port.
<!-- README.md §El proyecto original y su comunidad -->

## Este port {#el-port}

El port no trae firma propia: el README del repositorio lo presenta sin
nombres, como una _reimplementación fiel_ de la 2.48.32, y pone el
mérito donde va: «Todo el mérito del diseño, de la simulación y de los
bots es de ellos; este repositorio solo intenta que su trabajo siga
corriendo en máquinas modernas». Cómo se hizo, paso a paso, está en
[[tecnico/como-esta-hecho]].
<!-- README.md (nota inicial) -->

No fue el primer intento de llevar DarwinBots a plataformas nuevas:
hubo otros, como DarwinbotsC o DarwinBots.Js; este repositorio siguió
su propio camino.
<!-- README.md §Gracias -->

## La licencia {#licencia}

El fuente original es copyright 2003 de Carlo Comis, con modificaciones
de Purple Youko y Numsgil (2004–2005), Eric Lockard (2006–2007) y los
miembros del foro de DarwinBots.
<!-- LICENSE.md; README.md §Licencia -->

En cristiano, la licencia (de estilo BSD, con una vuelta propia) permite
usar y redistribuir el programa, con o sin cambios, siempre que se
cumplan tres condiciones:
<!-- LICENSE.md -->

1. quien reparta el fuente conserve el aviso de copyright y la licencia
   completos;
2. quien reparta binarios incluya ese mismo aviso y la licencia en la
   documentación;
3. sin el acuerdo del autor, la redistribución solo puede ser **no
   comercial** y sin fines de lucro.

Y no da garantía ninguna: el programa se entrega «tal cual es».
<!-- LICENSE.md -->

El port y la especificación son obras derivadas de ese fuente y se
distribuyen bajo la misma licencia, incluida su cláusula de uso no
comercial. Los bots del Bestiario pertenecen a sus autores.
<!-- README.md §Licencia -->

## El Bestiario {#bestiario}

Los 684 bots de la biblioteca los escribió esa comunidad a lo largo de
los años. Ninguno se escribió ni se modificó para este port: se
rastrearon los doce sub-foros del Bestiary del foro (F1, F2, F3, Short,
Multi-Bots, Veggies…), y de cada tema se tomó el ADN publicado por su
autor — el adjunto cuando existía, si no, el bloque de código más
completo del primer mensaje. Solo se normalizaron los caracteres
invisibles que el foro había introducido. Después se sumaron bots del
resto del foro y del wiki.
<!-- README.md §De dónde salen los bots de la demo (sub-foros y proceso); port/README.md §Bestiary (115 extra, 684 en total) -->

Cada bot se validó con el propio motor portado, no con heurísticas: se
carga, se siembra y corre 50 ciclos; se publicó uno por tema y se
quitaron las copias con ADN idéntico. En la biblioteca cada uno conserva
el nombre con que lo publicó su autor, y el índice guarda el enlace al
tema original del foro, donde están la autoría y la discusión.
<!-- README.md §De dónde salen los bots de la demo -->

Si algún bot de la biblioteca es tuyo y preferís que se quite o que se
acredite de otra forma, abrí un _issue_.
<!-- README.md §Gracias -->

## Gracias {#gracias}

A Carlo Comis por la idea y el código original; a Purple Youko, Numsgil,
EricL y Botsareus por mantenerlo vivo; a quienes escribieron el wiki,
que documentó el lenguaje y resolvió dudas que el fuente solo no
alcanzaba a responder; y a cada persona que publicó un bot en el foro.
<!-- README.md §Gracias -->

## Por dónde seguir {#seguir}

- El [wiki de DarwinBots](http://wiki.darwinbots.com/): la documentación
  que escribió la comunidad.
- El [foro de DarwinBots](http://forum.darwinbots.com/): las
  discusiones, las ligas y el Bestiary original.
- El [fuente original en GitHub](https://github.com/darwinbots/Darwinbots2):
  el Visual Basic 6 de la 2.48.32, tal como se publicó.
  <!-- README.md §El proyecto original y su comunidad, §Historia -->
