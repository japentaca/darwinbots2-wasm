---
titulo: .eye5dir
resumen: "Turns eye 5 relative to its factory position (straight ahead): positive toward the left, negative toward the right; 1256 is a full turn."
etiquetas: [eyes, vision, configuration]
estado: revisada
---
Shifts the direction of [[.eye5]], which in the factory configuration looks straight ahead along [[.aim]].
It is measured in the same units as `.aim`: a full turn is 1256, a half
turn 628 and 10 degrees about 35. Positive values move the eye to the
left and negative ones to the right. The eye stays attached to the bot: if the bot
turns, the eye turns with it.
<!-- 32-VISION §0.2; sysvars.yaml .eye5dir -->

It is configuration: the engine reads it every cycle but never clears it, so
writing it once is enough. Only the remainder of dividing by 1256 counts, with
its sign: 1256 is equivalent to 0 and 1300 to 44. The change shows in what the eye sees
from the next cycle on.
<!-- sysvars.yaml .eye5dir (persiste); 32-VISION §0.1 -->

This bot turns the front eye around so that it looks backward (628 is a half turn). Since [[.eye5]] is also the factory focus eye, the cells in [[sysvars/ref|what it sees]] now describe what is behind the bot:

```adn
cond
*.robage 0 =
start
628 .eye5dir store
stop
```

To change how much the eye covers, use [[.eye5width]]. The other eyes and
how they are laid out are covered in [[sysvars/ojos]].
