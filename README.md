# usage-bars

Un mod pour Claude Code (app desktop et terminal) qui garde en vue votre usage de tokens : limite des 5 heures, limite hebdomadaire, et un **quota journalier virtuel** (la limite hebdomadaire divisée par 7).

## Ce que ça affiche

Une bande compacte au-dessus de la zone de saisie :

```
5h ▰▰▱▱▱▱▱▱ 23%  Sem ▰▰▰▱▱▱▱▱ 40%  J3/7 ▰▰▰▰▰▱▱▱ 62%  (+7.9%)
```

- **5h** : part de la fenêtre de 5 heures consommée.
- **Sem** : part de la fenêtre hebdomadaire (7 jours) consommée.
- **J3/7** : jour courant de la semaine et part du quota virtuel du jour (100 % / 7 ≈ 14,3 %) déjà consommée.
- **(+7.9%)** : avance (vert) ou retard (rouge) sur le quota cumulé. Rien ne s'affiche quand vous êtes pile dans le quota.

Les barres passent au jaune au-delà de 70 % et au rouge au-delà de 90 %.

Un volet détaillé (avec le temps avant reset) s'ouvre avec la commande `/usage-bars`.

## Comment c'est calculé

Les chiffres viennent des limites de débit (`five_hour`, `seven_day`) renvoyées par la dernière réponse de l'API, lues via `$.session.usage()` et mises à jour à chaque mesure (`session.measure`).

- Début de la semaine = heure de reset hebdomadaire − 7 jours. Le jour N est le nombre de jours entiers écoulés depuis ce début, plus 1 (les jours sont décomptés depuis l'heure de reset, pas depuis minuit).
- Quota cumulé autorisé = N × 100/7 %.
- Avance = quota cumulé autorisé − consommation hebdomadaire. Le calcul est cumulatif : un jour sous-utilisé laisse de l'avance, un jour de dépassement en retire.
- La barre « J » = consommation hebdomadaire − (N−1) × 100/7 %, rapportée à 100/7 % et bornée entre 0 et 100 %.

La bande n'apparaît qu'après la première mesure (donc après votre premier message).

## Installation

Dans un terminal :

```
/plugin install usage-bars --marketplace Valartisant/claude-usage-bars
```

Ou depuis un shell :

```
claude plugin install usage-bars --marketplace Valartisant/claude-usage-bars
```

Dans l'app desktop, où `/plugin` ne fonctionne pas : cliquez sur + à côté de la zone de saisie, puis Plugins, Add marketplace avec `Valartisant/claude-usage-bars`, puis Add plugin.

## Limites

- La bande n'est pas dessinée sur l'app mobile (l'emplacement « au-dessus de la saisie » n'existe que sur terminal et desktop).
- Il n'existe pas d'emplacement dans la barre latérale pour les mods.

## Licence

MIT
