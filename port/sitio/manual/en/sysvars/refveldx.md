---
titulo: .refveldx
resumen: "How fast what you are looking at is moving sideways: positive toward your right, negative toward your left."
etiquetas: [vision, refvars, velocity, pursuit]
estado: revisada
---
<!-- sysvars.yaml 697; core senses.hpp lookoccurr (componente lateral menos mi veldx); probado: apunta.txt contra lateral.txt (blanco hacia mi izquierda: refveldx negativa) -->
`.refveldx` is the lateral component of the velocity of the bot your focus eye
sees, measured with respect to the direction you are looking and relative to your own sideways
movement ([[.veldx]]). Positive: it is drifting off to your right. Negative: to
your left. Its opposite is [[.refvelsx]].

It uses the same convention as [[.dx]], so copying it there makes you follow
the other's sideways movement and not lose it from your front eye. It is half
of the pursuit trick of [[.refvel]]:

```adn
cond
*.eye5 0 >
start
*.refveldx .dx store
stop
```

If you want to aim instead of moving, the alternative is to turn: a large value
of `.refveldx` warns that the target is about to leave the eye. For precise aiming,
look at [[.refxpos]]. If you see nothing, it is 0.
