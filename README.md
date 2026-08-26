# Site Office Fournitures

Site vitrine statique (une page, FR/EN). Aucune dépendance, aucun build.

## Contenu

```
index.html      la page complète (HTML + CSS + JS inclus)
assets/         logos, emblème, carte, icônes des 4 familles produits
```

## Déploiement Vercel

1. Pousser ce dossier sur un dépôt Git.
2. Sur Vercel : New Project → importer le dépôt.
3. Framework Preset : **Other**. Build Command : vide. Output Directory : `.` (ou le dossier `site` si vous poussez le projet entier).
4. Deploy, puis brancher le domaine `officefournitures.com` dans Settings → Domains.

En local : ouvrir `index.html` dans un navigateur, ou `npx serve`.

## À compléter

- Mentions légales et confidentialité : les liens du pied de page pointent sur `#mentions` et `#confidentialite`, pages à créer (SIRET / RCS Basse-Terre 483 715 082).
- Pas de formulaire de contact : uniquement téléphone, WhatsApp, email et adresses.

## Modifier le contenu

Chaque texte traduit porte deux attributs, `data-fr` et `data-en` ; le bouton EN/FR du header échange les deux. Si vous modifiez un texte, modifiez aussi son attribut `data-fr` correspondant, sinon la bascule de langue le remplacera par l'ancienne version.

Couleurs de la marque (variables CSS en haut du fichier) : bleu `#0D5A9C`, marine `#123979`, orange `#F15A22`, gris `#5A646E`, filets `#DAE0E6`.
