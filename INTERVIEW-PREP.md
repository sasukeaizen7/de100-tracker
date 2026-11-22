# Préparation d'entretien — Data / AI Engineer

Basé sur tes projets réels (chiffres tirés de tes README). Cible principale : **Quadratic** (conseil data & IA, Paris : data governance & engineering, AI/data science, DevOps), mais le guide marche pour n'importe quel poste data engineer / analytics engineer.

---

## 1. Ton positionnement en une phrase

> « Je construis toute la chaîne de la donnée : ingestion, modélisation, qualité et gouvernance, orchestration, puis restitution (dashboard, API, agent IA). Ce qui me différencie, c'est que je **vérifie mes résultats** : mes tests ont trouvé de vrais bugs dans mes propres pipelines, et mes règles de qualité sont validées sur 1,3 million de produits réels. »

### Pitch 2 minutes (FR)
« Je suis ingénieur ESTIN en IA et data science, en fin de cursus, avec un master web marketing en parallèle à Paris. Côté expérience, j'ai fait de la vision par ordinateur et de l'OCR sur des données portuaires réelles au BMT, et je co-fonde SnapTextAI, une startup d'OCR intelligent.

Côté data engineering, j'ai bâti un portfolio de projets de bout en bout. Le plus récent est une couche de **gouvernance et qualité sur 1,28 million de produits Open Food Facts** : 17 règles métier, chacune avec une sévérité et un responsable, un niveau de confiance par produit, de l'historique SCD2, un rapport Power BI et un agent IA qui répond en langage naturel *et dit quelle part des données il a exclue et pourquoi*. Avant, j'ai fait un pipeline Vélib' temps réel : Airflow, S3, entrepôt, dbt, monitoring, Terraform, CI. J'ai aussi réalisé 18 projets SQL analytiques et répliqué une étude VLDB d'Amazon Redshift sur 441 millions de requêtes.

Ce que je retiens de tout ça : une règle qui alerte trop est aussi dangereuse qu'une règle qui n'alerte jamais, et les chiffres doivent toujours être recoupés. C'est ce qui m'intéresse dans le conseil : rendre la donnée fiable pour qu'on puisse décider avec. »

### Pitch (EN, 45 s)
"I build the whole data chain: ingestion, modelling, quality and governance, orchestration, then delivery through dashboards, APIs and AI agents. My most recent project is a governance layer on 1.28 M French food products: 17 business rules with severity and owner, a trust level per product, and an AI agent that says how reliable the data behind each answer is. What I care about is verifying results: my own tests caught real bugs in my pipelines, and I'll show you how."

---

## 2. Carte des compétences → preuves

| Compétence | Preuve concrète | Où |
|---|---|---|
| **SQL avancé** | CTE récursifs (plus court chemin Bellman-Ford vérifié contre Dijkstra), division relationnelle, gaps & islands, `ASOF`, `LATERAL`, `ROLLUP/CUBE`, fenêtres `RANGE`, régression en SQL (Gutenberg–Richter b=1,02, R² 0,998) | `sql-portfolio/` (18 projets) |
| **Performance Postgres** | Benchmarks d'index avant/après (médiane de 5 `EXPLAIN ANALYZE`, résultats identiques exigés) : B-tree, composite, partiel, covering, BRIN, GIN trigram, GiST k-NN ; **3 cas « aucun gain » documentés** | projets 01, 03, 15 |
| **Modélisation** | Star schema, SCD type 2 (MERGE testé), contraintes PK/FK/UNIQUE/CHECK | `de100-portfolio/02`, `03` |
| **dbt** | Sources, seeds, incrémental avec contrat, snapshots, macros, 56 tests dont tests unitaires | `04-dbt-analytics`, `food-data-governance` |
| **Orchestration** | Airflow 3 : sensor, dynamic task mapping, XCom, retries, planification par Asset | `05`, `07`, `11` |
| **Big data** | PySpark sur 20 M de courses NYC : partitionnement Parquet, broadcast join, AQE, skew, caching | `06-pyspark` |
| **Streaming** | Kafka : topic 3 partitions, consumer group, résultats exactly-once, dead-letter queue | `09` |
| **Lakehouse** | Delta medallion bronze/silver/gold, MERGE, change data feed, schema evolution, time travel | `10` |
| **Data lake / cloud** | Zones S3, job type Glue, catalogue, SQL type Athena, moindre privilège **prouvé par test** | `08` |
| **IaC / CI** | Terraform (rôles, grants), GitHub Actions (lint, tests de 8 projets, 3 builds dbt, validation Terraform) | `infra/`, `.github/` |
| **Qualité & gouvernance** | 17 règles (sévérité, owner, dimension), glossaire, owners, lignée dbt, exposures, contrat, audit des requêtes de l'agent | `food-data-governance/` |
| **IA / agents** | Agent text-to-SQL Claude + version locale Ollama (qwen3:8b), garde-fous (read-only, 1 SELECT, 50 lignes, tables publiées seulement, **vérification des nombres dans le code**) | `food-data-governance/agent` |
| **BI** | Power BI : modèle 7 tables / 6 relations, mesures DAX, 5 pages | `food-data-governance/powerbi` |
| **Recherche / rigueur** | Réplication VLDB 2024 (29 claims : 17 confirmés, 7 partiels, 5 non) + réplication Redbench VLDB 2026 (22 confirmés, 8 proches, 5 non) | `redset-replication`, `redbench-replication` |
| **Full-stack** | NestJS 11 + React + PostgreSQL ; JWT + refresh tokens rotatifs, SSE, isolation multi-utilisateurs testée, extension Chrome MV3 ; déployé Vercel / Render / Neon | `backend/`, `web/`, `extension/`, `portfolio-app/` |
| **ML / CV** | YOLOv8/v9 + CNN/CRNN pour plaques et codes conteneurs (BMT), OCR (SnapTextAI) | CV |
| **Pédagogie** | Cours SQL interactif : 67 pages, PostgreSQL en WebAssembly (PGlite), exercices auto-corrigés | `sql-academy/` |

---

## 3. Tes 8 meilleures histoires (Situation → Action → Résultat → Leçon)

### 1. Les règles de qualité qui alertaient trop *(la meilleure, à placer à coup sûr)*
- **Situation** : première exécution du projet gouvernance.
- **Problème** : « kJ ≠ 4,184 × kcal » signalait **14,8 %** des produits, et l'eau minérale était marquée « sans tableau nutritionnel ».
- **Action** : j'ai cherché pourquoi. Les étiquettes calculent kJ et kcal séparément avec des facteurs UE différents (lipides 37/9 = 4,11 ; glucides 17/4 = 4,25) → un ratio correct se situe entre 4,0 et 4,25. Règle recadrée sur 3,5–5,0 → **5,6 %**. Pour l'eau : le règlement UE 1169/2011 exempte eau, alcool, fruits/légumes frais, épices, sel, thé, café, vinaigre, miel → R08 passe de 28,8 % à **12,8 %**.
- **Leçon** : une règle qui alerte trop est aussi nuisible qu'une qui n'alerte jamais, les gens arrêtent de lire. Chaque cas a un test de régression.

### 2. Les 3 393 « annulations » qui étaient des casses de stock
- Mon projet d'ingestion détectait les annulations par quantité négative ; dbt par préfixe de facture. Les tests croisés étaient en désaccord. Cause : des écritures de stock. Résultat : un `line_type` à 3 valeurs dans les deux projets.
- **Message** : le recoupement de deux implémentations indépendantes trouve des bugs qu'aucun test unitaire ne verrait.

### 3. L'agent IA qui inventait des chiffres (qwen3:8b)
- Raisonnement activé : bons chiffres, **mauvaise explication** (accusait une règle mineure).
- Raisonnement coupé : 5× plus rapide mais **inventait** « 20 000 produits caution » au lieu de 214 815.
- Erreur de **grain** : sommait les échecs de règles (283 060) au lieu de compter les produits (259 653) → j'ai publié une métrique prête (`dq_exclusion_reasons`) au lieu de laisser l'agent la recalculer.
- Final : **vérification des nombres dans le code**, pas dans le prompt.
- **Message** : on ne fait pas confiance à un LLM pour la justesse d'un chiffre ; on le contraint (tools limités, métriques pré-calculées, contrôle déterministe).

### 4. Les deux stations Vélib' à 410 bornes
- Un test de plage a échoué. Ce n'était pas du bruit : des mégastations temporaires (Invalides, Concorde). Elles ont maintenant leur propre catégorie.
- Le contrôle de capacité est un **warning**, pas une erreur : bloquer le pipeline pour le bruit de la source arrêterait tout pour rien.

### 5. Le dataset marketing sans colonne année
- Spark reconstruit l'année à partir de l'ordre des lignes, résultat conforme à la plage documentée. Bon exemple de débrouillardise + validation par une source externe.

### 6. Réplication VLDB : savoir dire « non confirmé »
- Étude Amazon Redshift, 441 M de requêtes : 17 confirmés, 7 partiels, **5 non**. Ex. : seulement 30,5 % de selects (paper : 48,9 %).
- Ajout original : un cache de résultats **idéal** répondrait à 63,1 % des selects (le cache réel : 33,6 %), validé car le modèle classe 97,5 % des vrais hits comme hits.
- Redbench : le code de tracé des auteurs ne mesure que les 1 000 premières requêtes par défaut → répétition ≈ 1 % au lieu de 73 %.
- **Message** : rigueur scientifique, esprit critique, capacité de lire un papier et d'en vérifier les chiffres.

### 7. Les index qui ne servent à rien
- Dans mes benchmarks Postgres : prédicat non-sargable, filtre peu sélectif, lookup à 5 % de la table → **pas de gain**, documenté. Un index n'est pas magique, on mesure.

### 8. Les pièges SQL dans les données réelles
- Somme de toutes les lignes = CO₂ mondial **surcompté 6,4×** (agrégats mélangés aux pays) ; 9 443 crimes avec un faux timestamp 00:00 ; jointure qui gonfle de 29 % (fan-out) ; aéroports américains étiquetés africains ; essais nucléaires dans un catalogue de séismes ; 296 films « parfaits » à 5,0 avec 1–2 votes (→ moyenne bayésienne).
- **Message** : première étape = contrôler le grain et la qualité, avant toute analyse.

---

## 4. Questions techniques probables et réponses ancrées dans tes projets

### SQL & Postgres
- **`WHERE` / `HAVING`, `RANK` / `DENSE_RANK` / `ROW_NUMBER`** : bases. Cite RFM (03) : `ntile()` sur valeurs égales coupait arbitrairement, remplacé pour des scores déterministes ; tout classement a un tie-breaker.
- **Un index n'est pas utilisé, pourquoi ?** Prédicat non-sargable (fonction sur la colonne), faible sélectivité (le planner préfère un seq scan), statistiques périmées, type/collation différent, ordre des colonnes d'un index composite. Appuie-toi sur tes 3 cas « no gain ».
- **Quel index pour quoi ?** B-tree (égalité/plage), BRIN (grande table corrélée à l'ordre physique, ex. temps), GIN trigram (`LIKE '%x%'`), GiST (k-NN géographique), partiel (sous-ensemble fréquent), covering `INCLUDE` (index-only scan), hash (égalité seule).
- **Comment mesurer ?** `EXPLAIN (ANALYZE, BUFFERS)`, médiane de plusieurs runs, **résultats identiques exigés** avant/après.
- **Fan-out de jointure** : une jointure 1-N avant agrégation multiplie les lignes ; contrôler le grain, agréger avant de joindre (projet 18 : +29 %).
- **Séries consécutives** : gaps & islands (différence de `row_number`), utilisé sur les séries de victoires F1.

### Modélisation
- **Star schema vs 3NF** : star pour l'analytique (lecture), 3NF pour l'OLTP. Tu as fait star + SCD2.
- **SCD1/2/3** : SCD2 = nouvelle ligne avec `valid_from/valid_to/is_current` ; faite avec MERGE testé et en dbt snapshot.
- **Grain d'une table de faits** : toujours le déclarer en premier (CO₂ : surcomptage ×6,4 faute de grain).

### dbt
- **Incrémental** : `delete+insert` sur `(snapshot_id, station_id)` rend les chevauchements inoffensifs (idempotent) ; sinon rebuild de ~216 k lignes/jour × mois toutes les 10 min.
- **Tests génériques vs unitaires vs contrats** : contrat = noms/types imposés à la build (`dq_rule_summary`).
- **Freshness** : un test dbt ne voit pas qu'aucun run n'a eu lieu → DAG de monitoring externe.

### Airflow / orchestration
- **Idempotence et reprise** : capture et chargement séparés ; le chargement reprend *tous* les snapshots non chargés (compare le bucket au journal de chargement) → pas de backfill manuel.
- **Pourquoi un Asset ?** dbt tourne dès que de nouvelles données arrivent, jamais après un chargement raté.
- **Pourquoi garder le brut en S3 ?** L'API n'a pas d'historique ; la zone brute est la source de vérité pour tout reconstruire.
- **L'échec d'une alerte ne lève pas d'exception** : l'alerte est d'abord écrite en table, sinon on masque le problème d'origine.

### Spark
- **Broadcast join** si une table est petite ; **AQE** ajuste partitions/jointures à l'exécution ; **skew** : salting ou AQE skew join ; **partition pruning** via Parquet partitionné ; `cache()` seulement si réutilisé. Tu as un lab de performance mesuré.
- **Spark vs DuckDB** : DuckDB suffit pour des centaines de millions de lignes sur une machine (Redset 441 M sur laptop) ; Spark quand ça ne tient plus ou pour du distribué.

### Kafka
- **Exactly-once** : producteur idempotent + consumer qui écrit de façon idempotente (upsert sur clé) dans Postgres. **Dead-letter queue** pour les messages invalides ; **clé de partition** pour l'ordre par entité.

### Delta / Lakehouse
- **MERGE, CDF, time travel, schema evolution** ; medallion : bronze brut → silver nettoyé/dédupliqué → gold métier.

### Gouvernance & qualité (cœur de Quadratic)
- **Dimensions de qualité** : complétude, validité, cohérence, unicité, fraîcheur, exactitude. Associe-les à tes règles (R04 complétude, R01 validité GS1, R13 cohérence, R16 fraîcheur).
- **Sévérité + owner** : bloquant / majeur / mineur / info ; chaque règle a un responsable. Niveau de confiance par produit (trusted / caution / untrusted : 79,6 % / 16,8 % / 3,5 %).
- **Golden record** : sur 1 809 produits avec deux jeux de valeurs (fabricant et contributeur), 10,5 % divergent.
- **« Checked » vs « failed »** : seuls les produits concernés par la règle comptent au dénominateur (pas de faux « pass »).
- **Accès contrôlé** : `publish.py` → seules les tables marquées `published` sont visibles ; audit de chaque requête de l'agent.
- **Priorisation** : produits avec problèmes = 20,4 % du catalogue mais 8,8 % des scans → corriger d'abord les plus consultés.

### IA / LLM
- **Garde-fous d'un agent text-to-SQL** : DB read-only sans accès fichier/réseau, un seul SELECT, limite de lignes, tables publiées uniquement, journal d'audit, vérification des nombres en code.
- **Claude vs modèle local** : local = gratuit, hors ligne, données confidentielles ; mais moins fiable (ton tableau d'essais).

### Backend / sécurité (si poste full-stack ou mixte)
- **Tokens** : access JWT 15 min ; refresh `<sessionId>.<secret>` haché en base, rotation à chaque usage avec 30 s de grâce, rejeu → session révoquée ; chaque requête vérifie la ligne de session (révocation instantanée).
- **Cookie** httpOnly + `SameSite=Strict`, en-tête `X-DE92-Client` requis.
- **Autorisation** applicative : toute requête scopée par `userId`, tests d'isolation inter-utilisateurs (anti-IDOR).
- **Images** : type vérifié sur les octets, URL signées HMAC. **SSE** : événements « quelque chose a changé », le client refetch.
- **Vitest + SWC** : esbuild perd les métadonnées de décorateurs dont Nest a besoin ; Jest bloquait avec PGlite.

### Cloud / DevOps
- **Mapping local → cloud** (sois prêt à dessiner) : SeaweedFS → S3 ; Postgres → Snowflake (`COPY INTO` depuis stage) ; Airflow Docker → MWAA/Astronomer ; alertes → CloudWatch + SNS → Slack ; Terraform provider Snowflake pour rôles et grants.
- **Moindre privilège** : rôle dashboard en lecture seule sur les marts, refus sur le schéma brut (testé).

---

## 5. Questions pièges / points faibles

| Question | Réponse honnête et solide |
|---|---|
| « Pas d'expérience en production ? » | Vrai pour les pipelines : ce sont des projets perso (le BMT et la startup sont d'autres types de travail). Mais je les ai construits avec ce qu'on exige en prod : idempotence, tests, CI, monitoring, IaC, moindre privilège. Cite 1–2 bugs trouvés par les tests. |
| « Tout tourne en local, pas sur le vrai cloud ? » | Choix assumé : coût zéro, reproductible. Chaque README dit quel service AWS/Snowflake/Databricks chaque brique remplace ; je sais dessiner la migration. Le portfolio web est déployé (Vercel, Render, Neon). |
| « Pourquoi DuckDB et pas Snowflake/BigQuery ? » | Pour l'analytique mono-machine jusqu'à des centaines de millions de lignes, plus simple et rapide ; je sais où ça s'arrête (concurrence, multi-utilisateurs, gouvernance fine). |
| « Pourquoi autant de domaines (OCR, web, data) ? » | Profil chaîne complète : livrer la donnée jusqu'à l'utilisateur. Mon centre de gravité reste data engineering / qualité. |
| « Ton point faible ? » | Peu d'exposition à un grand entrepôt cloud managé en prod et au travail dans une grande équipe d'ingénieurs : je veux l'apprendre en mission. Reste factuel. |
| « Un échec ? » | Histoire n°1 (règle à 14,8 %) : erreur → diagnostic → correction → test de régression. |
| « Un LLM peut-il remplacer ça ? » | Non pour la fiabilité chiffrée (tes essais qwen3:8b) ; oui comme interface si les chiffres sont calculés et contrôlés par du code. |

**Chiffres** : ne cite que ceux de ce document (tous issus de tes README). Si on te questionne sur un détail que tu ne retrouves pas, dis « je le vérifie dans le repo ». Rappel de tes consignes : pas de « 100 jours » ni de data.gouv.fr dans le discours.

---

## 6. Questions à poser à l'entreprise

1. Quelle part des missions est ingénierie vs gouvernance vs data science ?
2. Quelles stacks reviennent chez vos clients (Snowflake, Databricks, GCP, Azure) ?
3. Comment mesurez-vous et livrez-vous la qualité de données à un client (règles, SLA, ownership) ?
4. Comment sont accompagnés les juniors sur leurs premières missions ?
5. Quels projets IA/agents sont en cours, et comment gérez-vous leur fiabilité ?
6. Comment se passent la montée en compétences et les certifications ?

---

## 7. Plan de révision (3 jours)

**J-3 : fond**
- Relire les `LEARN.md` de `03-project-1-ingestion`, `04-dbt-analytics`, `05-airflow`, `09-kafka`, `10-medallion`, `11-final-project` et `food-data-governance/LEARN.md`.
- Refaire de tête le schéma `bronze → silver → quality → gold → serving → agent`.

**J-2 : pratique**
- Dire le pitch FR et EN à voix haute, chronométré.
- Raconter chaque histoire en 90 s sans notes.
- Dessiner : pipeline Vélib' + équivalent cloud ; un SCD2 ; le flux d'un refresh token.
- 5 exercices SQL à main levée : cohortes, top-N par groupe, gaps & islands, CTE récursif, fenêtre glissante (les exercices de `sql-academy` sont corrigés).

**J-1 : démo et logistique**
- Démo de 3 min sans lancer le pipeline : rapport Power BI, `images/rule_failures.png`, une question à l'agent.
- Vérifier que le portfolio en ligne et le GitHub sont accessibles ; Render gratuit s'endort après 15 min, ouvre-le avant.
- Relire le CV : chaque ligne doit être défendable. Dormir.

---

## 8. Mini-quiz (réponds sans regarder)

1. Pourquoi 14,8 % était trop élevé, et quelle plage de ratio kJ/kcal est correcte ?
2. Différence entre compter des échecs de règles et des produits ? (283 060 vs 259 653)
3. Pourquoi capture et chargement sont-ils séparés dans le pipeline Vélib' ?
4. Comment un refresh token est-il protégé contre le rejeu ?
5. Trois cas où un index ne sert à rien.
6. Pourquoi l'agent vérifie-t-il les nombres dans le code et pas dans le prompt ?
7. Que prouve la réplication Redset, et quel est ton résultat original ?
8. Comment un test dbt et un DAG de monitoring se complètent-ils ?
9. Que fait ton SCD2 quand un attribut change ?
10. Comment passerais-tu le pipeline Vélib' sur AWS + Snowflake ?
