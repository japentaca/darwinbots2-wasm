---
titulo: What it sees (ref*)
resumen: "The ref* sysvars describe what is in front of the focus eye: its DNA signature, its energy and body, where it is and how it moves."
etiquetas: [vision, refvars, recognition, eyes]
estado: revisada
---
<!-- 32-VISION §1-2, §4; 21-MEMORIA §3 (régimen A); core senses.hpp lookoccurr, physics.hpp Repel3 -->
The eyes ([[.eye5]] and its neighbors) only tell you _how close_ something is. To
know _what_ it is, there are the `ref*` sysvars: every cycle the engine copies into them
data about the object the focus eye sees, which is [[.eye5]] unless you
change it with [[.focuseye]]. If that eye sees several things, the closest one wins.

They come in three families:

- **The DNA signature.** [[.refup]], [[.refdn]], [[.refsx]], [[.refdx]],
  [[.refaimdx]], [[.refaimsx]], [[.refshoot]], [[.refeye]] and [[.reftie]]
  count how many times certain words appear in the other bot's DNA. Bots
  of the same species have the same signature, so by comparing it with yours
  ([[sysvars/my|the my* sysvars]]) you can tell whether it is one of your own.
- **The state.** [[.refnrg]], [[.refbody]], [[.refshell]], [[.refage]],
  [[.refkills]], [[.refpoison]], [[.refvenom]], [[.refmulti]] and [[.reffixed]].
- **Position and movement.** [[.refxpos]], [[.refypos]], [[.refaim]],
  [[.refvel]], [[.refveldx]], their opposites [[.refveldn]] and [[.refvelsx]], and
  [[.refvelscalar]]. [[.reftype]] says whether what you see is a bot or a shape.

The rules are the same for all of them. They arrive one cycle late, like
any sense. They are cleared to 0 before being rewritten, so if the focus eye
sees nothing they are all 0. And they are also filled in when you collide with another bot,
even if you aren't looking at it.

The most-used combination comes from _Animal Minimalis_, by Numsgil, in the
Bestiary: if what it sees isn't of its species, it copies its movement so as not to
lose it and shoots it. Here it is condensed into a single gene:

```adn
cond
*.eye5 0 >
*.refeye *.myeye !=
start
*.refveldx .dx store
*.refvel 30 add .up store
-1 .shoot store
stop
```

The full explanation of sight is in [[simulacion/vision]] and recognition step by
step is in [[tutoriales/reconoce-especie]].
